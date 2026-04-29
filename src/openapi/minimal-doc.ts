import { collectSchemaClosure } from "./ref-collector.js";
import type { HttpMethod, JsonSchemaObject, OpenApiDocument } from "./types.js";

export function buildMinimalDocument(
  document: OpenApiDocument,
  path: string,
  method: HttpMethod,
): OpenApiDocument {
  const operation = document.paths[path]?.[method];
  if (operation === undefined) {
    throw new Error(`Operation not found: ${method.toUpperCase()} ${path}`);
  }

  const operationClone = structuredClone(operation);
  const schemas = collectSchemaClosure(document, operationClone);
  const minimalDocument: OpenApiDocument = {
    openapi: document.openapi,
    info: {
      title: document.info.title,
      version: document.info.version,
    },
    paths: {
      [path]: {
        [method]: operationClone,
      },
    },
  };

  if (Object.keys(schemas).length > 0) {
    minimalDocument.components = { schemas: schemas as Record<string, JsonSchemaObject> };
  }

  return minimalDocument;
}
