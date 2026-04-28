import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readApifoxConfig } from "../src/config/apifox-config.ts";

describe("readApifoxConfig", () => {
  it("returns defaults and provided values", () => {
    const config = readApifoxConfig({
      APIFOX_ACCESS_TOKEN: "token-1",
      APIFOX_PROJECT_ID: "123",
      APIFOX_BRANCH_ID: "10",
      APIFOX_MODULE_ID: "20",
      APIFOX_TIMEOUT_MS: "3000",
    });

    assert.equal(config.apiBaseUrl, "https://api.apifox.com");
    assert.equal(config.accessToken, "token-1");
    assert.equal(config.projectId, "123");
    assert.equal(config.branchId, 10);
    assert.equal(config.moduleId, 20);
    assert.equal(config.timeoutMs, 3000);
  });

  it("reports missing access token only when required", () => {
    const config = readApifoxConfig({});
    assert.deepEqual(config.missingForRequest({ requireProjectId: true }), [
      "APIFOX_ACCESS_TOKEN",
      "APIFOX_PROJECT_ID",
    ]);
  });

  it("uses explicit project id instead of env project id", () => {
    const config = readApifoxConfig({ APIFOX_ACCESS_TOKEN: "token-1" });
    assert.deepEqual(config.missingForRequest({ projectId: "abc", requireProjectId: true }), []);
  });
});
