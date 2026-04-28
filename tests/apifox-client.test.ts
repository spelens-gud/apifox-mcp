import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApifoxClient } from "../src/apifox/apifox-client.ts";

describe("createApifoxClient", () => {
  it("exports OpenAPI with project, branch, and module options", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com/",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.exportOpenApi({
      projectId: "p1",
      branchId: 2,
      moduleId: 3,
      scope: { type: "ALL" },
    });

    assert.equal(calls[0]?.url, "https://api.example.com/v1/projects/p1/export-openapi");
    assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, "Bearer token-1");
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      scope: { type: "ALL" },
      exportFormat: "JSON",
      oasVersion: "3.1",
      branchId: 2,
      moduleId: 3,
    });
  });

  it("imports OpenAPI with safe defaults", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ data: { counters: { endpointUpdated: 1 } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.importOpenApi({
      projectId: "p1",
      document: { openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} },
    });

    assert.equal(calls[0]?.url, "https://api.example.com/v1/projects/p1/import-openapi");
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      input: "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"x\",\"version\":\"1\"},\"paths\":{}}",
      options: {
        endpointOverwriteBehavior: "AUTO_MERGE",
        schemaOverwriteBehavior: "AUTO_MERGE",
        deleteUnmatchedResources: false,
        updateFolderOfChangedEndpoint: false,
        prependBasePath: false,
      },
    });
  });

  it("throws clear errors for non-2xx responses", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ message: "bad token" }), { status: 401 });

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await assert.rejects(client.exportOpenApi({ projectId: "p1", scope: { type: "ALL" } }), /Apifox API request failed: 401/);
  });
});
