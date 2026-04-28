import type { HttpMethod, JsonSchemaObject, OpenApiDocument } from "./types.js";

export interface FieldPatchInput {
  path: string;
  method: HttpMethod;
  contentType: string;
  fieldPath: string;
  schema: JsonSchemaObject;
  required?: boolean;
}

export interface ResponseFieldPatchInput extends FieldPatchInput {
  status: string;
}

export interface FieldPatchResult {
  action: "added" | "updated";
}

export function patchRequestBodyField(
  document: OpenApiDocument,
  input: FieldPatchInput,
): FieldPatchResult {
  const operation = document.paths[input.path]?.[input.method];
  if (operation === undefined) {
    throw new Error(`Operation not found: ${input.method.toUpperCase()} ${input.path}`);
  }

  const schema = operation.requestBody?.content?.[input.contentType]?.schema;
  if (schema === undefined) {
    throw new Error(`Request body schema not found: ${input.method.toUpperCase()} ${input.path} ${input.contentType}`);
  }

  return patchField(document, schema, input);
}

export function patchResponseField(
  document: OpenApiDocument,
  input: ResponseFieldPatchInput,
): FieldPatchResult {
  const operation = document.paths[input.path]?.[input.method];
  if (operation === undefined) {
    throw new Error(`Operation not found: ${input.method.toUpperCase()} ${input.path}`);
  }

  const schema = operation.responses?.[input.status]?.content?.[input.contentType]?.schema;
  if (schema === undefined) {
    throw new Error(
      `Response schema not found: ${input.method.toUpperCase()} ${input.path} ${input.status} ${input.contentType}`,
    );
  }

  return patchField(document, schema, input);
}

function patchField(
  document: OpenApiDocument,
  rootSchema: JsonSchemaObject,
  input: FieldPatchInput,
): FieldPatchResult {
  const targetSchema = resolvePatchTarget(document, rootSchema);
  const parts = input.fieldPath.split(".").filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error("Field path must not be empty");
  }

  let current = ensureObjectSchema(targetSchema);
  for (const part of parts.slice(0, -1)) {
    let next = current.properties[part];
    if (next === undefined) {
      next = {
        type: "object",
        properties: {},
      };
      current.properties[part] = next;
    }

    current = ensureObjectSchema(next);
  }

  const leaf = parts.at(-1);
  if (leaf === undefined) {
    throw new Error("Field path must not be empty");
  }

  const action: FieldPatchResult["action"] = current.properties[leaf] === undefined ? "added" : "updated";
  current.properties[leaf] = {
    ...(current.properties[leaf] ?? {}),
    ...structuredClone(input.schema),
  };

  if (input.required === true) {
    current.required = [leaf];
  }

  return { action };
}

function resolvePatchTarget(
  document: OpenApiDocument,
  schema: JsonSchemaObject,
): JsonSchemaObject {
  if (schema.$ref === undefined) {
    return schema;
  }

  const name = parseComponentSchemaRef(schema.$ref);
  const target = document.components?.schemas?.[name];
  if (target === undefined) {
    throw new Error(`Referenced schema not found: ${schema.$ref}`);
  }

  return target;
}

function parseComponentSchemaRef(ref: string): string {
  const prefix = "#/components/schemas/";
  if (!ref.startsWith(prefix) || ref.length === prefix.length) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  return decodeURIComponent(ref.slice(prefix.length));
}

function ensureObjectSchema(schema: JsonSchemaObject): JsonSchemaObject & {
  properties: Record<string, JsonSchemaObject>;
} {
  schema.type = "object";
  schema.properties ??= {};
  return schema as JsonSchemaObject & { properties: Record<string, JsonSchemaObject> };
}
