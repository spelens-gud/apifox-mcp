import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJsonDiff } from "../build/openapi/diff.js";
import { buildMinimalDocument } from "../build/openapi/minimal-doc.js";
import { collectSchemaClosure, collectSchemaRefs } from "../build/openapi/ref-collector.js";
import type { OpenApiDocument } from "../src/openapi/types.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("OpenAPI minimal document generation", () => {
  it("keeps only the requested operation and required schema refs", () => {
    const minimal = buildMinimalDocument(petstoreOpenApi, "/pets", "post");

    assert.deepEqual(Object.keys(minimal.paths), ["/pets"]);
    assert.deepEqual(Object.keys(minimal.paths["/pets"] ?? {}), ["post"]);
    assert.equal(minimal.paths["/pets"]?.post?.operationId, "createPet");
    assert.equal(minimal.paths["/pets"]?.get, undefined);
    assert.deepEqual(Object.keys(minimal.components?.schemas ?? {}), ["Pet"]);
    assert.deepEqual(minimal.components?.schemas?.Pet, petstoreOpenApi.components?.schemas?.Pet);
  });

  it("creates a simple JSON line diff", () => {
    assert.equal(
      createJsonDiff({ a: 1, b: 2 }, { a: 1, b: 3 }),
      `--- before
+++ after
-  "b": 2
+  "b": 3`,
    );
  });

  it("omits unchanged trailing lines from JSON line diff insertions", () => {
    const diff = createJsonDiff({ a: 1, z: 9 }, { a: 1, b: 2, z: 9 });

    assert.equal(
      diff,
      `--- before
+++ after
+  "b": 2,`,
    );
  });

  it("rejects a missing operation", () => {
    assert.throws(
      () => buildMinimalDocument(petstoreOpenApi, "/pets", "delete"),
      /Operation not found: DELETE \/pets/,
    );
  });

  it("includes transitive schema refs", () => {
    const document: OpenApiDocument = {
      openapi: "3.0.3",
      info: {
        title: "Nested",
        version: "1.0.0",
      },
      paths: {
        "/pets": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/Pet",
                  },
                },
              },
            },
            responses: {},
          },
        },
      },
      components: {
        schemas: {
          Category: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
          Pet: {
            type: "object",
            properties: {
              category: {
                $ref: "#/components/schemas/Category",
              },
            },
          },
        },
      },
    };

    const minimal = buildMinimalDocument(document, "/pets", "post");

    assert.deepEqual(Object.keys(minimal.components?.schemas ?? {}), ["Category", "Pet"]);
    assert.deepEqual(minimal.components?.schemas?.Category, document.components?.schemas?.Category);
  });

  it("rejects missing schema refs with a clear error", () => {
    const document = structuredClone(petstoreOpenApi);
    document.paths["/pets"]!.post!.requestBody!.content!["application/json"]!.schema = {
      $ref: "#/components/schemas/Missing",
    };

    assert.throws(
      () => buildMinimalDocument(document, "/pets", "post"),
      /Schema ref not found: Missing/,
    );
  });

  it("ignores non-enumerable refs", () => {
    const schema = {};
    Object.defineProperty(schema, "$ref", {
      value: "#/components/schemas/Hidden",
      enumerable: false,
    });

    assert.deepEqual(collectSchemaRefs(schema), []);
  });

  it("does not resolve dangerous schema refs from inherited object properties", () => {
    const document: OpenApiDocument = {
      openapi: "3.0.3",
      info: {
        title: "Unsafe",
        version: "1.0.0",
      },
      paths: {},
      components: {
        schemas: {},
      },
    };

    assert.throws(
      () => collectSchemaClosure(document, { $ref: "#/components/schemas/constructor" }),
      /Unsupported schema ref|Schema ref not found/,
    );
  });

  it("collects cyclic refs without looping forever", () => {
    const document: OpenApiDocument = {
      openapi: "3.0.3",
      info: {
        title: "Cyclic",
        version: "1.0.0",
      },
      paths: {},
      components: {
        schemas: {
          A: {
            type: "object",
            properties: {
              b: { $ref: "#/components/schemas/B" },
            },
          },
          B: {
            type: "object",
            properties: {
              a: { $ref: "#/components/schemas/A" },
            },
          },
        },
      },
    };

    const collected = collectSchemaClosure(document, { $ref: "#/components/schemas/A" });

    assert.deepEqual(Object.keys(collected), ["A", "B"]);
    assert.deepEqual(collected.A, document.components?.schemas?.A);
    assert.deepEqual(collected.B, document.components?.schemas?.B);
  });

  it("rejects raw slash, encoded slash, and invalid escape schema refs while collecting", () => {
    for (const ref of [
      "#/components/schemas/A/B",
      "#/components/schemas/A%2FB",
      "#/components/schemas/A~2B",
    ]) {
      assert.throws(
        () => collectSchemaRefs({ $ref: ref }),
        /Unsupported schema ref/,
      );
    }
  });
});
