import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { assertToolResponse, withTestClient } from "./helpers/test-client.ts";

const apifoxEnvKeys = [
  "APIFOX_ACCESS_TOKEN",
  "APIFOX_PROJECT_ID",
  "APIFOX_BRANCH_ID",
  "APIFOX_MODULE_ID",
  "APIFOX_TIMEOUT_MS",
  "APIFOX_API_BASE_URL",
] as const;

function createChildEnv(overrides: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  for (const key of apifoxEnvKeys) {
    delete env[key];
  }

  return { ...env, ...overrides };
}

async function withEmptyCwd<T>(callback: (cwd: string) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(tmpdir(), "apifox-mcp-test-"));
  try {
    return await callback(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

function readRequestBody(request: IncomingMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    request.on("data", () => {});
    request.on("end", resolve);
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function withApifoxApi<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  let importAttempts = 0;
  const server = createServer((request, response) => {
    void (async () => {
      await readRequestBody(request);

      if (request.url === "/v1/projects/project-1/export-openapi") {
        sendJson(response, 200, {
          openapi: "3.1.0",
          info: { title: "Test API", version: "1.0.0" },
          paths: {
            "/pets": {
              get: {
                responses: { "200": { description: "ok" } },
              },
            },
          },
        });
        return;
      }

      if (request.url === "/v1/projects/project-1/import-openapi") {
        importAttempts += 1;
        if (importAttempts === 1) {
          sendJson(response, 500, { message: "temporary import failure" });
          return;
        }

        sendJson(response, 200, { data: { counters: { endpointUpdated: 1 } } });
        return;
      }

      sendJson(response, 404, { message: "not found" });
    })().catch((error: unknown) => {
      sendJson(response, 500, { message: String(error) });
    });
  });

  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    return await callback(`http://127.0.0.1:${String(address.port)}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

function parseJsonResponse(response: { content: Array<{ type: string; text?: string }> }): unknown {
  assert.equal(response.content[0]?.type, "text");
  return JSON.parse(response.content[0]?.text ?? "");
}

describe("Apifox tools", () => {
  it("lists Apifox tools", async () => {
    await withTestClient(async (client) => {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name).sort();

      assert.deepEqual(names, [
        "apifox_apply_change",
        "apifox_discard_change",
        "apifox_export_openapi",
        "apifox_get_endpoint",
        "apifox_preview_request_body_field_change",
        "apifox_preview_request_param_change",
        "apifox_preview_response_field_change",
        "apifox_search_endpoints",
      ]);
    });
  });

  it("reports missing configuration for search", async () => {
    await withEmptyCwd(async (cwd) => {
      await withTestClient(async (client) => {
        const response = await client.callTool("apifox_search_endpoints", { path: "/pets" });

        assertToolResponse(
          response,
          "Missing required Apifox configuration: APIFOX_ACCESS_TOKEN, APIFOX_PROJECT_ID",
        );
      }, { cwd, env: createChildEnv() });
    });
  });

  it("keeps a pending change when apply import fails", async () => {
    await withEmptyCwd(async (cwd) => {
      await withApifoxApi(async (baseUrl) => {
        await withTestClient(async (client) => {
          const preview = await client.callTool("apifox_preview_request_param_change", {
            path: "/pets",
            method: "get",
            location: "query",
            name: "limit",
            schema: { type: "integer" },
          });
          const previewBody = parseJsonResponse(preview) as { changeId: string };

          const failedApply = await client.callTool("apifox_apply_change", { changeId: previewBody.changeId });
          assert.equal(failedApply.isError, true);

          const retriedApply = await client.callTool("apifox_apply_change", { changeId: previewBody.changeId });
          const retriedBody = parseJsonResponse(retriedApply) as { applied: boolean };

          assert.equal(retriedBody.applied, true);
        }, {
          cwd,
          env: createChildEnv({
            APIFOX_ACCESS_TOKEN: "token-1",
            APIFOX_PROJECT_ID: "project-1",
            APIFOX_API_BASE_URL: baseUrl,
          }),
        });
      });
    });
  });
});
