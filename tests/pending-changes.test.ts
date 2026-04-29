import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingChangeStore } from "../build/pending/pending-changes.js";
import type { OpenApiDocument } from "../src/openapi/types.ts";

const document: OpenApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Pending",
    version: "1.0.0",
  },
  paths: {},
};

describe("pending change store", () => {
  it("creates, reads, consumes, and removes a change", () => {
    const store = createPendingChangeStore(() => "change-1");

    const change = store.create({
      projectId: "project-1",
      summary: "Add empty document",
      diff: "--- before\n+++ after",
      document,
    });

    assert.equal(change.changeId, "change-1");
    assert.equal(store.get("change-1")?.summary, "Add empty document");

    const consumed = store.consume("change-1");

    assert.equal(consumed?.changeId, "change-1");
    assert.equal(consumed?.summary, "Add empty document");
    assert.equal(store.get("change-1"), undefined);
  });

  it("discards changes", () => {
    const store = createPendingChangeStore(() => "change-1");

    store.create({
      projectId: "project-1",
      summary: "Add empty document",
      diff: "--- before\n+++ after",
      document,
    });

    assert.equal(store.discard("change-1"), true);
    assert.equal(store.discard("missing"), false);
  });
});
