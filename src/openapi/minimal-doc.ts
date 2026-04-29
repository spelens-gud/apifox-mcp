import { collectSchemaClosure } from "./ref-collector.js";
import type { HttpMethod, JsonSchemaObject, OpenApiDocument } from "./types.js";

const componentRefPrefix = "#/components/";
const unsafeComponentNames = new Set(["__proto__", "constructor", "prototype"]);

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

  const componentRefs = collectComponentRefs(operationClone);
  addReferencedComponents(minimalDocument, document, componentRefs);

  return minimalDocument;
}

function addReferencedComponents(
  minimalDocument: OpenApiDocument,
  sourceDocument: OpenApiDocument,
  initialRefs: Array<ComponentRef>,
): void {
  const pendingRefs = [...initialRefs];
  const visited = new Set<string>();

  while (pendingRefs.length > 0) {
    const ref = pendingRefs.shift();
    if (ref === undefined) {
      continue;
    }

    const visitKey = `${ref.section}/${ref.name}`;
    if (visited.has(visitKey)) {
      continue;
    }

    visited.add(visitKey);
    const component = readComponent(sourceDocument, ref);
    writeComponent(minimalDocument, ref, component);
    pendingRefs.push(...collectComponentRefs(component));
    pendingRefs.sort(compareComponentRefs);
  }
}

type ComponentRef = {
  section: string;
  name: string;
};

function collectComponentRefs(value: unknown): Array<ComponentRef> {
  const refs = new Map<string, ComponentRef>();
  collectComponentRefsInto(value, refs);
  return [...refs.values()].sort(compareComponentRefs);
}

function collectComponentRefsInto(value: unknown, refs: Map<string, ComponentRef>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectComponentRefsInto(item, refs);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === "$ref" && typeof item === "string" && item.startsWith(componentRefPrefix)) {
      const ref = parseComponentRef(item);
      refs.set(`${ref.section}/${ref.name}`, ref);
    }

    collectComponentRefsInto(item, refs);
  }
}

function parseComponentRef(ref: string): ComponentRef {
  const rest = ref.slice(componentRefPrefix.length);
  const [section, ...nameParts] = rest.split("/");
  if (section === undefined || section === "" || nameParts.length !== 1) {
    throw new Error(`Unsupported component ref: ${ref}`);
  }

  const name = decodeComponentName(nameParts[0] ?? "", ref);
  if (unsafeComponentNames.has(name)) {
    throw new Error(`Unsupported component ref: ${ref}`);
  }

  return { section, name };
}

function decodeComponentName(encodedName: string, ref: string): string {
  if (encodedName === "" || encodedName.includes("%2F") || encodedName.includes("%2f")) {
    throw new Error(`Unsupported component ref: ${ref}`);
  }

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(encodedName);
  } catch (error) {
    throw new Error(`Unsupported component ref: ${ref}`, { cause: error });
  }

  if (decodedName.includes("/")) {
    throw new Error(`Unsupported component ref: ${ref}`);
  }

  const invalidEscape = /~(?![01])/.exec(decodedName);
  if (invalidEscape !== null) {
    throw new Error(`Unsupported component ref: ${ref}`);
  }

  return decodedName.replaceAll("~1", "/").replaceAll("~0", "~");
}

function readComponent(sourceDocument: OpenApiDocument, ref: ComponentRef): unknown {
  const components = sourceDocument.components;
  if (components === undefined || !hasOwnProperty(components, ref.section)) {
    throw new Error(`Component ref not found: ${ref.section}/${ref.name}`);
  }

  const section = components[ref.section];
  if (!isRecord(section) || !hasOwnProperty(section, ref.name)) {
    throw new Error(`Component ref not found: ${ref.section}/${ref.name}`);
  }

  return structuredClone(section[ref.name]);
}

function writeComponent(minimalDocument: OpenApiDocument, ref: ComponentRef, component: unknown): void {
  minimalDocument.components ??= {};
  const components = minimalDocument.components as Record<string, Record<string, unknown>>;
  components[ref.section] ??= {};
  const section = components[ref.section];
  if (section === undefined) {
    throw new Error(`Component section not found after initialization: ${ref.section}`);
  }

  section[ref.name] = component;
}

function compareComponentRefs(left: ComponentRef, right: ComponentRef): number {
  return `${left.section}/${left.name}`.localeCompare(`${right.section}/${right.name}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwnProperty<TObject extends object>(
  object: TObject,
  key: PropertyKey,
): key is keyof TObject {
  return Object.hasOwn(object, key);
}
