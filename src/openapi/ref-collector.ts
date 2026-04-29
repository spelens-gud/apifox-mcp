import type { OpenApiDocument } from "./types.js";

const COMPONENT_SCHEMA_REF_PREFIX = "#/components/schemas/";
const UNSAFE_COMPONENT_NAMES = new Set(["__proto__", "constructor", "prototype"]);

export function collectSchemaRefs(value: unknown): string[] {
  const refs = new Set<string>();
  collectSchemaRefsInto(value, refs);
  return [...refs].sort();
}

export function collectSchemaClosure(document: OpenApiDocument, root: unknown): Record<string, unknown> {
  const collectedSchemas = new Map<string, unknown>();
  const visitedNames = new Set<string>();
  const pendingRefs = collectSchemaRefs(root);
  const schemas = document.components?.schemas;

  while (pendingRefs.length > 0) {
    const ref = pendingRefs.shift();
    if (ref === undefined) {
      continue;
    }

    const name = parseComponentSchemaRef(ref);
    if (visitedNames.has(name)) {
      continue;
    }

    if (!isRecord(schemas) || !hasOwnProperty(schemas, name)) {
      throw new Error(`Schema ref not found: ${name}`);
    }

    const schema = schemas[name];
    visitedNames.add(name);
    collectedSchemas.set(name, structuredClone(schema));

    for (const nestedRef of collectSchemaRefs(schema)) {
      pendingRefs.push(nestedRef);
    }

    pendingRefs.sort();
  }

  const sortedSchemas: Record<string, unknown> = {};
  for (const [name, schema] of [...collectedSchemas.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    sortedSchemas[name] = schema;
  }

  return sortedSchemas;
}

function collectSchemaRefsInto(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaRefsInto(item, refs);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref") {
      const ref = item;
      if (typeof ref === "string" && ref.startsWith(COMPONENT_SCHEMA_REF_PREFIX)) {
        parseComponentSchemaRef(ref);
        refs.add(ref);
      }
    }
    collectSchemaRefsInto(item, refs);
  }
}

function parseComponentSchemaRef(ref: string): string {
  if (!ref.startsWith(COMPONENT_SCHEMA_REF_PREFIX) || ref.length === COMPONENT_SCHEMA_REF_PREFIX.length) {
    throw new Error(`Unsupported schema ref: ${ref}`);
  }

  const encodedName = ref.slice(COMPONENT_SCHEMA_REF_PREFIX.length);
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
  if (UNSAFE_COMPONENT_NAMES.has(name)) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwnProperty<T extends object>(
  object: T,
  key: PropertyKey,
): key is keyof T {
  return Object.hasOwn(object, key);
}
