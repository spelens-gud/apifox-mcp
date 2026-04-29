import type { OpenApiDocument } from "./types.js";

const COMPONENT_SCHEMA_REF_PREFIX = "#/components/schemas/";

export function collectSchemaRefs(value: unknown): string[] {
  const refs = new Set<string>();
  collectSchemaRefsInto(value, refs);
  return [...refs].sort();
}

export function collectSchemaClosure(document: OpenApiDocument, root: unknown): Record<string, unknown> {
  const collectedSchemas: Record<string, unknown> = {};
  const visitedNames = new Set<string>();
  const pendingRefs = collectSchemaRefs(root);

  while (pendingRefs.length > 0) {
    const ref = pendingRefs.shift();
    if (ref === undefined) {
      continue;
    }

    const name = parseComponentSchemaRef(ref);
    if (visitedNames.has(name)) {
      continue;
    }

    const schema = document.components?.schemas?.[name];
    if (schema === undefined) {
      throw new Error(`Schema ref not found: ${name}`);
    }

    visitedNames.add(name);
    collectedSchemas[name] = structuredClone(schema);

    for (const nestedRef of collectSchemaRefs(schema)) {
      pendingRefs.push(nestedRef);
    }

    pendingRefs.sort();
  }

  return Object.fromEntries(Object.entries(collectedSchemas).sort(([left], [right]) => left.localeCompare(right)));
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

  if (Object.hasOwn(value, "$ref")) {
    const ref = value.$ref;
    if (typeof ref === "string" && ref.startsWith(COMPONENT_SCHEMA_REF_PREFIX)) {
      parseComponentSchemaRef(ref);
      refs.add(ref);
    }
  }

  for (const item of Object.values(value)) {
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

  return unescapeJsonPointerSegment(decodedName, ref);
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
