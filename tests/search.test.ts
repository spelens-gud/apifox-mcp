import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

const searchModuleUrl = new URL("../src/openapi/search.ts", import.meta.url).href;
const typesModuleUrl = new URL("../src/openapi/types.ts", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./types.js" && context.parentURL === searchModuleUrl) {
      return {
        shortCircuit: true,
        url: typesModuleUrl,
      };
    }

    return nextResolve(specifier, context);
  },
});

const { findOperation, listMethodsForPath, searchEndpoints } = await import("../src/openapi/search.ts");

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
