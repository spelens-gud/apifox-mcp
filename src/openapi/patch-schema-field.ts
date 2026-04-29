import type { HttpMethod, JsonSchemaObject, OpenApiDocument } from "./types.js";

const unsafeComponentNames = new Set(["__proto__", "constructor", "prototype"]);

export type FieldPatchInput = {
  path: string;
  method: HttpMethod;
  contentType: string;
  fieldPath: string;
  schema: JsonSchemaObject;
  required?: boolean;
}

export type ResponseFieldPatchInput = {
  status: string;
} & FieldPatchInput

export type FieldPatchResult = {
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
    let next = hasOwnProperty(current.properties, part) ? current.properties[part] : undefined;
    if (next === undefined) {
      next = {
        type: "object",
        properties: {},
      };
      current.properties[part] = next;
    }

    current = ensureObjectSchema(resolvePatchTarget(document, next), `field path segment "${part}"`);
  }

  const leaf = parts.at(-1);
  if (leaf === undefined) {
    throw new Error("Field path must not be empty");
  }

  return applyLeafPatch(current, leaf, input);
}

function applyLeafPatch(
  schema: JsonSchemaObject & { properties: Record<string, JsonSchemaObject> },
  leaf: string,
  input: FieldPatchInput,
): FieldPatchResult {
  const existingLeaf = hasOwnProperty(schema.properties, leaf) ? schema.properties[leaf] : undefined;
  const action: FieldPatchResult["action"] = existingLeaf === undefined ? "added" : "updated";
  schema.properties[leaf] = {
    ...(existingLeaf ?? {}),
    ...structuredClone(input.schema),
  };

  updateRequiredFields(schema, leaf, input.required);
  return { action };
}

function updateRequiredFields(schema: JsonSchemaObject, leaf: string, required: boolean | undefined): void {
  if (required === true) {
    schema.required ??= [];
    if (!schema.required.includes(leaf)) {
      schema.required.push(leaf);
    }
    return;
  }

  if (required === false && schema.required !== undefined) {
    schema.required = schema.required.filter((requiredField) => requiredField !== leaf);
  }
}

function parseFieldPath(fieldPath: string): Array<string> {
  if (fieldPath.length === 0 || fieldPath.startsWith(".") || fieldPath.endsWith(".") || fieldPath.includes("..")) {
    throw new Error(`Invalid field path: ${fieldPath}`);
  }

  const parts = fieldPath.split(".");
  for (const part of parts) {
    if (isDangerousObjectKey(part)) {
      throw new Error(`Invalid field path: ${fieldPath}; dangerous segment: ${part}`);
    }
  }

  return parts;
}

function resolvePatchTarget(
  document: OpenApiDocument,
  schema: JsonSchemaObject,
): JsonSchemaObject {
  if (schema.$ref === undefined) {
    return schema;
  }

  const name = parseComponentSchemaRef(schema.$ref);
  const schemas = document.components?.schemas;
  if (schemas === undefined || !hasOwnProperty(schemas, name)) {
    throw new Error(`Referenced schema not found: ${schema.$ref}`);
  }

  const target = schemas[name];
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

  if (decodedName.includes("/")) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  const name = unescapeJsonPointerSegment(decodedName, ref);
  if (unsafeComponentNames.has(name)) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  return name;
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

function isDangerousObjectKey(segment: string): boolean {
  return segment === "__proto__" || segment === "prototype" || segment === "constructor";
}

function hasOwnProperty<T extends object>(
  object: T,
  key: PropertyKey,
): boolean {
  return Object.hasOwn(object, key);
}
