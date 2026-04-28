import type { HttpMethod, JsonSchemaObject, OpenApiDocument, OpenApiParameter } from "./types.js";

export interface PatchRequestParameterInput {
  path: string;
  method: HttpMethod;
  name: string;
  location: OpenApiParameter["in"];
  required?: boolean;
  description?: string;
  schema: JsonSchemaObject;
}

export interface PatchResult {
  action: "added" | "updated";
  path: string;
  method: HttpMethod;
}

export function patchRequestParameter(
  document: OpenApiDocument,
  input: PatchRequestParameterInput,
): PatchResult {
  const operation = document.paths[input.path]?.[input.method];
  if (operation === undefined) {
    throw new Error(`Operation not found: ${input.method.toUpperCase()} ${input.path}`);
  }

  operation.parameters ??= [];

  const existing = operation.parameters.find(
    (parameter) => parameter.name === input.name && parameter.in === input.location,
  );
  const next: OpenApiParameter = {
    name: input.name,
    in: input.location,
    ...(input.required === undefined ? {} : { required: input.required }),
    ...(input.description === undefined ? {} : { description: input.description }),
    schema: input.schema,
  };

  if (existing !== undefined) {
    Object.assign(existing, next);
    return { action: "updated", path: input.path, method: input.method };
  }

  operation.parameters.push(next);
  return { action: "added", path: input.path, method: input.method };
}
