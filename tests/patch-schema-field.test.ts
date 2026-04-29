import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";
import { patchRequestBodyField, patchResponseField } from "../build/openapi/patch-schema-field.js";

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

  it("rejects malformed field paths", () => {
    for (const fieldPath of [".age", "age.", "profile..score"]) {
      const document = structuredClone(petstoreOpenApi);

      assert.throws(
        () =>
          patchRequestBodyField(document, {
            path: "/pets",
            method: "post",
            contentType: "application/json",
            fieldPath,
            schema: { type: "integer" },
          }),
        new RegExp(`Invalid field path: ${fieldPath.replaceAll(".", "\\.")}`),
      );
    }
  });

  it("rejects dangerous field path segments without polluting Object.prototype", () => {
    for (const fieldPath of ["__proto__.score", "constructor.score", "prototype.score"]) {
      const document = structuredClone(petstoreOpenApi);

      assert.throws(
        () =>
          patchRequestBodyField(document, {
            path: "/pets",
            method: "post",
            contentType: "application/json",
            fieldPath,
            schema: { type: "integer" },
          }),
        new RegExp(`Invalid field path: ${fieldPath.replaceAll(".", "\\.")}; dangerous segment: ${fieldPath.split(".")[0]}`),
      );
      assert.equal((Object.prototype as Record<string, unknown>).score, undefined);
    }
  });

  it("does not read or reuse inherited properties while patching", () => {
    const document = structuredClone(petstoreOpenApi);
    const inheritedProfile = {
      type: "object",
      properties: {
        inheritedScore: { type: "string" },
      },
    };
    const properties = Object.create({ profile: inheritedProfile }) as Record<string, unknown>;
    properties.id = document.components!.schemas!.Pet!.properties!.id;
    properties.name = document.components!.schemas!.Pet!.properties!.name;
    document.components!.schemas!.Pet!.properties = properties;

    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "profile.score",
      schema: { type: "number" },
    });

    assert.deepEqual(result, { action: "added" });
    assert.equal(Object.hasOwn(properties, "profile"), true);
    assert.notEqual(properties.profile, inheritedProfile);
    assert.equal(document.components?.schemas?.Pet?.properties?.profile?.properties?.score?.type, "number");
    assert.equal(inheritedProfile.properties.inheritedScore.type, "string");
    assert.equal((Object.prototype as Record<string, unknown>).score, undefined);
  });

  it("patches inline request body schemas", () => {
    const document = structuredClone(petstoreOpenApi);
    const inlineSchema = {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    };
    document.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = inlineSchema;

    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "age",
      schema: { type: "integer" },
    });

    assert.deepEqual(result, { action: "added" });
    assert.equal(inlineSchema.properties.age?.type, "integer");
  });

  it("rejects unsupported and missing refs", () => {
    const unsupportedRefDocument = structuredClone(petstoreOpenApi);
    unsupportedRefDocument.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/requestBodies/Pet",
    };

    assert.throws(
      () =>
        patchRequestBodyField(unsupportedRefDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "age",
          schema: { type: "integer" },
        }),
      /Unsupported schema ref: #\/components\/requestBodies\/Pet/,
    );

    const rawSlashRefDocument = structuredClone(petstoreOpenApi);
    rawSlashRefDocument.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/schemas/Pet/Extra",
    };

    assert.throws(
      () =>
        patchRequestBodyField(rawSlashRefDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "age",
          schema: { type: "integer" },
        }),
      /Unsupported schema ref: #\/components\/schemas\/Pet\/Extra/,
    );

    const encodedSlashRefDocument = structuredClone(petstoreOpenApi);
    encodedSlashRefDocument.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/schemas/Pet%2FProfile",
    };

    assert.throws(
      () =>
        patchRequestBodyField(encodedSlashRefDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "age",
          schema: { type: "integer" },
        }),
      /Unsupported schema ref: #\/components\/schemas\/Pet%2FProfile/,
    );

    const missingRefDocument = structuredClone(petstoreOpenApi);
    missingRefDocument.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/schemas/Missing",
    };

    assert.throws(
      () =>
        patchRequestBodyField(missingRefDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "age",
          schema: { type: "integer" },
        }),
      /Referenced schema not found: #\/components\/schemas\/Missing/,
    );
  });

  it("resolves JSON Pointer escaped component schema refs", () => {
    const document = structuredClone(petstoreOpenApi);
    document.components!.schemas!["Pet/Profile"] = {
      type: "object",
      properties: {},
    };
    document.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/schemas/Pet~1Profile",
    };

    patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "score",
      schema: { type: "number" },
    });

    assert.equal(document.components?.schemas?.["Pet/Profile"]?.properties?.score?.type, "number");
  });

  it("rejects non-object root and intermediate schemas without mutating them", () => {
    const rootDocument = structuredClone(petstoreOpenApi);
    const rootSchema = { type: "array", items: { type: "string" } };
    rootDocument.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = rootSchema;

    assert.throws(
      () =>
        patchRequestBodyField(rootDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "age",
          schema: { type: "integer" },
        }),
      /Expected object schema at root schema, got array/,
    );
    assert.deepEqual(rootSchema, { type: "array", items: { type: "string" } });

    const intermediateDocument = structuredClone(petstoreOpenApi);
    intermediateDocument.components!.schemas!.Pet!.properties!.profile = { type: "string" };

    assert.throws(
      () =>
        patchRequestBodyField(intermediateDocument, {
          path: "/pets",
          method: "post",
          contentType: "application/json",
          fieldPath: "profile.score",
          schema: { type: "number" },
        }),
      /Expected object schema at field path segment "profile", got string/,
    );
    assert.deepEqual(intermediateDocument.components?.schemas?.Pet?.properties?.profile, { type: "string" });
  });

  it("clones input schema before writing it to the document", () => {
    const document = structuredClone(petstoreOpenApi);
    const schema = {
      type: "object",
      properties: {
        value: { type: "string" },
      },
    };

    patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "metadata",
      schema,
    });
    schema.properties.value.type = "number";

    assert.equal(document.components?.schemas?.Pet?.properties?.metadata?.properties?.value?.type, "string");
  });
});
