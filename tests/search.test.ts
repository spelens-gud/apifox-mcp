import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findOperation, listMethodsForPath, searchEndpoints } from "../src/openapi/search.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("OpenAPI endpoint search", () => {
  it("returns only matching endpoint for path and method filters", () => {
    const results = searchEndpoints(petstoreOpenApi, { path: "/pets", method: "get" });

    assert.deepEqual(results, [
      {
        path: "/pets",
        method: "get",
        summary: "List pets",
        operationId: "listPets",
        tags: ["pet"],
      },
    ]);
  });

  it("returns endpoints matching keyword by operation metadata", () => {
    const results = searchEndpoints(petstoreOpenApi, { keyword: "user" });

    assert.deepEqual(
      results.map((result) => result.operationId),
      ["getUser"],
    );
  });

  it("lists methods available for a path in HTTP method order", () => {
    assert.deepEqual(listMethodsForPath(petstoreOpenApi, "/pets"), ["get", "post"]);
  });

  it("finds an operation by path and method", () => {
    const operation = findOperation(petstoreOpenApi, "/pets", "post");

    assert.equal(operation?.summary, "Create pet");
  });
});
