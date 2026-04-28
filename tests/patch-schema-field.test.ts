import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchRequestBodyField, patchResponseField } from "../build/openapi/patch-schema-field.js";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("OpenAPI schema field patching", () => {
  it("adds a request body field", () => {
    const document = structuredClone(petstoreOpenApi);

    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "age",
      schema: { type: "integer", default: 1, description: "Pet age" },
      required: true,
    });

    assert.deepEqual(result, { action: "added" });
    assert.equal(document.components?.schemas?.Pet?.properties?.age?.type, "integer");
    assert.deepEqual(document.components?.schemas?.Pet?.required, ["id", "name", "age"]);
  });

  it("adds a nested response field", () => {
    const document = structuredClone(petstoreOpenApi);

    const result = patchResponseField(document, {
      path: "/users/{userId}",
      method: "get",
      status: "200",
      contentType: "application/json",
      fieldPath: "profile.score",
      schema: { type: "number", default: 1 },
    });

    assert.deepEqual(result, { action: "added" });
    assert.equal(document.components?.schemas?.User?.properties?.profile?.type, "object");
    assert.equal(document.components?.schemas?.User?.properties?.profile?.properties?.score?.type, "number");
    assert.equal(document.components?.schemas?.User?.properties?.profile?.properties?.score?.default, 1);
  });

  it("updates an existing field", () => {
    const document = structuredClone(petstoreOpenApi);

    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "name",
      schema: { type: "string", description: "Display name" },
    });

    assert.deepEqual(result, { action: "updated" });
    assert.equal(document.components?.schemas?.Pet?.properties?.name?.description, "Display name");
  });

  it("does not duplicate required fields", () => {
    const document = structuredClone(petstoreOpenApi);

    patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "name",
      schema: { type: "string", description: "Display name" },
      required: true,
    });

    patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "name",
      schema: { type: "string", description: "Public display name" },
      required: true,
    });

    assert.deepEqual(document.components?.schemas?.Pet?.required, ["id", "name"]);
  });
});
