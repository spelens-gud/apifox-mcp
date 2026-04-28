import type { HttpMethod, OpenApiDocument, OpenApiOperation } from "./types.js";

const typesModulePath = import.meta.url.endsWith(".ts") ? "./types.ts" : "./types.js";
const { HTTP_METHODS } = (await import(new URL(typesModulePath, import.meta.url).href)) as typeof import("./types.js");

export interface EndpointSearchInput {
  path?: string;
  method?: HttpMethod;
  keyword?: string;
}

export interface EndpointSearchResult {
  path: string;
  method: HttpMethod;
  summary?: string;
  operationId?: string;
  tags?: string[];
}

export function searchEndpoints(document: OpenApiDocument, input: EndpointSearchInput): EndpointSearchResult[] {
  const keyword = input.keyword?.toLowerCase();
  const results: EndpointSearchResult[] = [];

  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (input.path !== undefined && !path.includes(input.path)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      if (input.method !== undefined && method !== input.method) {
        continue;
      }

      const operation = pathItem[method];
      if (operation === undefined) {
        continue;
      }

      if (keyword !== undefined && !matchesKeyword(path, operation, keyword)) {
        continue;
      }

      results.push({
        path,
        method,
        summary: operation.summary,
        operationId: operation.operationId,
        tags: operation.tags,
      });
    }
  }

  return results;
}

export function listMethodsForPath(document: OpenApiDocument, path: string): HttpMethod[] {
  const pathItem = document.paths[path];
  if (pathItem === undefined) {
    return [];
  }

  return HTTP_METHODS.filter((method) => pathItem[method] !== undefined);
}

export function findOperation(
  document: OpenApiDocument,
  path: string,
  method: HttpMethod,
): OpenApiOperation | undefined {
  return document.paths[path]?.[method];
}

function matchesKeyword(path: string, operation: OpenApiOperation, keyword: string): boolean {
  return [path, operation.summary, operation.operationId, ...(operation.tags ?? [])].some((value) =>
    value?.toLowerCase().includes(keyword),
  );
}
