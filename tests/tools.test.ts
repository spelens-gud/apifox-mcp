import assert from "node:assert/strict";
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

async function withoutApifoxEnv<T>(callback: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of apifoxEnvKeys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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
    await withoutApifoxEnv(async () => {
      await withTestClient(async (client) => {
        const response = await client.callTool("apifox_search_endpoints", { path: "/pets" });

        assertToolResponse(
          response,
          "Missing required Apifox configuration: APIFOX_ACCESS_TOKEN, APIFOX_PROJECT_ID",
        );
      });
    });
  });
});
