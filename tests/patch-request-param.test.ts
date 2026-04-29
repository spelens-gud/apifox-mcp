import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";
import { patchRequestParameter } from "../build/openapi/patch-request-param.js";

describe("OpenAPI request parameter patching", () => {
  it("adds a query parameter to an operation", () => {
    const document = structuredClone(petstoreOpenApi);

    const result = patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      name: "page",
      location: "query",
      schema: { type: "integer", default: 1 },
      required: false,
      description: "Page number",
    });

    assert.deepEqual(result, { action: "added", path: "/pets", method: "get" });
    assert.deepEqual(document.paths["/pets"]?.get?.parameters?.at(-1), {
      name: "page",
      in: "query",
      required: false,
      description: "Page number",
      schema: { type: "integer", default: 1 },
    });
  });

  it("updates an existing query parameter without duplicating it", () => {
    const document = structuredClone(petstoreOpenApi);

    const result = patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      name: "limit",
      location: "query",
      schema: { type: "integer", default: 20 },
      description: "Max items",
    });

    const parameters = document.paths["/pets"]?.get?.parameters ?? [];

    assert.deepEqual(result, { action: "updated", path: "/pets", method: "get" });
    assert.equal(parameters.filter((parameter) => parameter.name === "limit" && parameter.in === "query").length, 1);
    assert.deepEqual(parameters.find((parameter) => parameter.name === "limit" && parameter.in === "query"), {
      name: "limit",
      in: "query",
      description: "Max items",
      schema: { type: "integer", default: 20 },
    });
  });

  it("preserves existing parameter extension fields when updating schema and description", () => {
    const document = structuredClone(petstoreOpenApi);
    const parameters = document.paths["/pets"]?.get?.parameters ?? [];
    const limit = parameters.find((parameter) => parameter.name === "limit" && parameter.in === "query");

    assert.ok(limit);
    Object.assign(limit, {
      examples: {
        small: { value: 5 },
      },
      deprecated: true,
      style: "form",
      explode: false,
    });

    patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      name: "limit",
      location: "query",
      schema: { type: "integer", default: 25 },
      description: "Updated max items",
    });

    assert.deepEqual(parameters.find((parameter) => parameter.name === "limit" && parameter.in === "query"), {
      name: "limit",
      in: "query",
      description: "Updated max items",
      schema: { type: "integer", default: 25 },
      examples: {
        small: { value: 5 },
      },
      deprecated: true,
      style: "form",
      explode: false,
    });
  });

  it("clones schema input when adding a parameter", () => {
    const document = structuredClone(petstoreOpenApi);
    const schemaInput = { type: "integer", default: 1 };

    patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      name: "page",
      location: "query",
      schema: schemaInput,
    });

    schemaInput.default = 99;

    assert.deepEqual(document.paths["/pets"]?.get?.parameters?.at(-1)?.schema, {
      type: "integer",
      default: 1,
    });
  });

  it("clones schema input when updating a parameter", () => {
    const document = structuredClone(petstoreOpenApi);
    const schemaInput = { type: "integer", default: 20 };

    patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      name: "limit",
      location: "query",
      schema: schemaInput,
    });

    schemaInput.default = 99;

    assert.deepEqual(
      document.paths["/pets"]?.get?.parameters?.find(
        (parameter) => parameter.name === "limit" && parameter.in === "query",
      )?.schema,
      {
        type: "integer",
        default: 20,
      },
    );
  });

  it("rejects a missing target operation", () => {
    const document = structuredClone(petstoreOpenApi);

    assert.throws(
      () =>
        patchRequestParameter(document, {
          path: "/missing",
          method: "get",
          name: "limit",
          location: "query",
          schema: { type: "integer" },
        }),
      /Operation not found/,
    );
  });
});
