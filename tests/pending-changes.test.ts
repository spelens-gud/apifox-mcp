import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingChangeStore } from "../build/pending/pending-changes.js";
import type { OpenApiDocument } from "../src/openapi/types.ts";

function createDocument(): OpenApiDocument {
  return {
    openapi: "3.0.3",
    info: {
      title: "Pending",
      version: "1.0.0",
    },
    paths: {
      "/pets": {
        get: {
          summary: "List pets",
          responses: {
            "200": {
              description: "Pets returned",
            },
          },
        },
      },
    },
  };
}

function setPetSummary(document: OpenApiDocument, summary: string): void {
  const operation = document.paths["/pets"]?.get;
  assert.ok(operation);
  operation.summary = summary;
}

function getPetSummary(document: OpenApiDocument): string | undefined {
  return document.paths["/pets"]?.get?.summary;
}

describe("pending change store", () => {
  it("creates, reads, consumes, and removes a change", () => {
    const store = createPendingChangeStore(() => "change-1");

    const change = store.create({
      projectId: "project-1",
      summary: "Add empty document",
      diff: "--- before\n+++ after",
      document: createDocument(),
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
      document: createDocument(),
    });

    assert.equal(store.discard("change-1"), true);
    assert.equal(store.discard("missing"), false);
  });

  it("isolates stored documents from input and returned object mutations", () => {
    const store = createPendingChangeStore(() => "change-1");
    const inputDocument = createDocument();

    const created = store.create({
      projectId: "project-1",
      summary: "Add pets endpoint",
      diff: "--- before\n+++ after",
      document: inputDocument,
    });

    setPetSummary(inputDocument, "Mutated input");
    const readAfterInputMutation = store.get("change-1");
    assert.ok(readAfterInputMutation);
    assert.equal(getPetSummary(readAfterInputMutation.document), "List pets");

    setPetSummary(created.document, "Mutated create return");
    const readAfterCreateReturnMutation = store.get("change-1");
    assert.ok(readAfterCreateReturnMutation);
    assert.equal(getPetSummary(readAfterCreateReturnMutation.document), "List pets");

    const firstRead = store.get("change-1");
    assert.ok(firstRead);
    setPetSummary(firstRead.document, "Mutated get return");

    const secondRead = store.get("change-1");
    assert.ok(secondRead);
    assert.equal(getPetSummary(secondRead.document), "List pets");
  });

  it("returns cloned documents from consume", () => {
    const store = createPendingChangeStore(() => "change-1");

    store.create({
      projectId: "project-1",
      summary: "Add pets endpoint",
      diff: "--- before\n+++ after",
      document: createDocument(),
    });

    const readBeforeConsume = store.get("change-1");
    const consumed = store.consume("change-1");

    assert.ok(readBeforeConsume);
    assert.ok(consumed);

    setPetSummary(consumed.document, "Mutated consume return");

    assert.equal(getPetSummary(readBeforeConsume.document), "List pets");
    assert.equal(store.get("change-1"), undefined);
  });

  it("returns undefined when consuming a missing change", () => {
    const store = createPendingChangeStore(() => "change-1");

    assert.equal(store.consume("missing"), undefined);
  });
});
