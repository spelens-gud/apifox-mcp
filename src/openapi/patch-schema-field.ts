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
  const parts = parseFieldPath(input.fieldPath);

  let current = ensureObjectSchema(targetSchema, "root schema");
  for (const part of parts.slice(0, -1)) {
    let next = current.properties[part];
    if (next === undefined) {
      next = {
        type: "object",
        properties: {},
      };
      current.properties[part] = next;
    }

    current = ensureObjectSchema(next, `field path segment "${part}"`);
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
    current.required ??= [];
    if (!current.required.includes(leaf)) {
      current.required.push(leaf);
    }
  }

  return { action };
}

function parseFieldPath(fieldPath: string): string[] {
  if (fieldPath.length === 0 || fieldPath.startsWith(".") || fieldPath.endsWith(".") || fieldPath.includes("..")) {
    throw new Error(`Invalid field path: ${fieldPath}`);
  }

  return fieldPath.split(".");
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

  const encodedName = ref.slice(prefix.length);
  if (encodedName.includes("/")) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch (error) {
    throw new Error(`Unsupported schema ref: ${ref}`, { cause: error });
  }

  return unescapeJsonPointerSegment(decodedName, ref);
}

function unescapeJsonPointerSegment(segment: string, ref: string): string {
  const invalidEscape = /~(?![01])/.exec(segment);
  if (invalidEscape !== null) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function ensureObjectSchema(
  schema: JsonSchemaObject,
  context: string,
): JsonSchemaObject & {
  properties: Record<string, JsonSchemaObject>;
} {
  if (schema.type !== undefined && schema.type !== "object") {
    throw new Error(`Expected object schema at ${context}, got ${schema.type}`);
  }

  if (schema.type === undefined && schema.properties === undefined) {
    schema.type = "object";
  }

  schema.properties ??= {};
  return schema as JsonSchemaObject & { properties: Record<string, JsonSchemaObject> };
}
