import { HTTP_METHODS, type HttpMethod, type OpenApiDocument, type OpenApiOperation } from "./types.js";

export type EndpointSearchInput = {
  path?: string;
  method?: HttpMethod;
  keyword?: string;
}

export type EndpointSearchResult = {
  path: string;
  method: HttpMethod;
  summary?: string;
  operationId?: string;
  tags?: Array<string>;
}

export function searchEndpoints(document: OpenApiDocument, input: EndpointSearchInput): Array<EndpointSearchResult> {
  const keyword = input.keyword?.toLowerCase();
  const results: Array<EndpointSearchResult> = [];

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

export function listMethodsForPath(document: OpenApiDocument, path: string): Array<HttpMethod> {
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
