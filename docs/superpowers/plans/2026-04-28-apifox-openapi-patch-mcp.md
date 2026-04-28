# Apifox OpenAPI Patch MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that safely previews and applies precise OpenAPI patches to Apifox interfaces.

**Architecture:** Start from `upstream TypeScript MCP template`, keep its official MCP SDK transport and auto-registration system, and replace demo modules with Apifox-specific tools. Core logic lives in pure modules for config, Apifox API calls, OpenAPI search, patching, minimal document generation, diffing, and pending changes.

**Tech Stack:** Node.js 20.11+, TypeScript, `@modelcontextprotocol/sdk`, Zod, Express HTTP transport, Node `node:test`, ESLint.

---

## File Structure

- Create/replace from template: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.eslint.json`, `eslint.config.mjs`, `dev.js`, `mcp.json`, `.nvmrc`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `src/index.ts`, `src/server/boot.ts`, `src/registry/*`, `tests/helpers/*`
- Delete template demos after import: `src/tools/demo-tool.ts`, `src/resources/system-info.ts`, `src/resources/timestamp.ts`, `src/prompts/code-analyzer.ts`, `src/prompts/generate-readme.ts`, related tests
- Create: `src/config/apifox-config.ts` for environment parsing
- Create: `src/apifox/apifox-client.ts` for OpenAPI import/export HTTP calls
- Create: `src/apifox/types.ts` for Apifox request/response types
- Create: `src/openapi/types.ts` for narrow OpenAPI object types
- Create: `src/openapi/search.ts` for endpoint search and method lookup
- Create: `src/openapi/ref-collector.ts` for `$ref` dependency traversal
- Create: `src/openapi/minimal-doc.ts` for target-operation import documents
- Create: `src/openapi/patch-request-param.ts` for parameter changes
- Create: `src/openapi/patch-schema-field.ts` for request/response schema field changes
- Create: `src/openapi/diff.ts` for deterministic JSON diff text
- Create: `src/pending/pending-changes.ts` for process-local pending changes
- Create: `src/tools/apifox-search-endpoints.ts`
- Create: `src/tools/apifox-get-endpoint.ts`
- Create: `src/tools/apifox-export-openapi.ts`
- Create: `src/tools/apifox-preview-request-param-change.ts`
- Create: `src/tools/apifox-preview-request-body-field-change.ts`
- Create: `src/tools/apifox-preview-response-field-change.ts`
- Create: `src/tools/apifox-apply-change.ts`
- Create: `src/tools/apifox-discard-change.ts`
- Create: `tests/fixtures/petstore-openapi.ts`
- Create: `tests/config.test.ts`, `tests/apifox-client.test.ts`, `tests/search.test.ts`, `tests/patch-request-param.test.ts`, `tests/patch-schema-field.test.ts`, `tests/minimal-doc.test.ts`, `tests/pending-changes.test.ts`, `tests/tools.test.ts`
- Modify: `README.md` for usage and MCP config
- Modify: `.gitignore` to include `.env`, `.env.local`, `node_modules`, `build`, logs, and editor files

## Task 1: Import and Normalize the TypeScript MCP Template

**Files:**
- Create/modify: root template files listed in File Structure
- Delete: template demo resources/prompts/tools and tests after baseline verification
- Test: baseline `npm run build`, `npm test`

- [ ] **Step 1: Import the template contents**

Run:

```bash
tmp_dir="$(mktemp -d)"
git clone --depth 1 https://github.com/upstream TypeScript MCP template "$tmp_dir/template"
rsync -a --exclude .git --exclude docs "$tmp_dir/template/" ./
rm -rf "$tmp_dir"
```

Expected: root contains `src/index.ts`, `src/server/boot.ts`, `src/registry`, `package.json`, and test helpers.

- [ ] **Step 2: Restore existing docs**

Run:

```bash
git checkout -- docs/superpowers/specs/2026-04-28-apifox-openapi-patch-mcp-design.md docs/superpowers/plans/2026-04-28-apifox-openapi-patch-mcp.md
```

Expected: design and plan files remain present after template import.

- [ ] **Step 3: Rename package and commands**

Modify `package.json`:

```json
{
  "name": "apifox-openapi-patch-mcp",
  "version": "0.1.0",
  "description": "MCP server for safe Apifox OpenAPI patch previews and apply flows",
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.ts\"",
    "test:watch": "node --test --watch \"tests/**/*.test.ts\"",
    "build": "tsc && chmod 755 build/index.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "inspect": "npm run build && npx @modelcontextprotocol/inspector node build/index.js",
    "inspect:http": "npm run build && npx @modelcontextprotocol/inspector http://localhost:3000/mcp",
    "dev": "npm run build && node dev",
    "serve:stdio": "npm run build && APIFOX_MCP_TRANSPORT=stdio node build/index.js",
    "serve:http": "npm run build && APIFOX_MCP_TRANSPORT=http PORT=3000 node build/index.js"
  },
  "bin": {
    "apifox-openapi-patch-mcp": "./build/index.js"
  },
  "files": ["build"],
  "engines": {
    "node": ">=20.11.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "fast-glob": "^3.3.3",
    "zod": "^3.25.0"
  }
}
```

Keep the template dev dependencies unless versions conflict with the imported lockfile.

- [ ] **Step 4: Update server identity**

Modify `src/server/boot.ts`:

```ts
const transportMode =
  mode ?? (process.env.APIFOX_MCP_TRANSPORT as TransportMode | undefined) ?? "stdio";

const server = new McpServer({
  name: "apifox-openapi-patch-mcp",
  version: "0.1.0",
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
    completions: {},
  },
});
```

Also change log lines from `template server` to `Apifox OpenAPI Patch MCP`.

- [ ] **Step 5: Run baseline verification**

Run:

```bash
npm install
npm run build
npm test
```

Expected: template baseline builds and tests pass before demo modules are removed.

- [ ] **Step 6: Commit template baseline**

Run:

```bash
git add .
git commit -m "chore: import typescript mcp starter"
```

Expected: commit contains template baseline plus package rename.

## Task 2: Add Configuration Parsing

**Files:**
- Create: `src/config/apifox-config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/config.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readApifoxConfig } from "../src/config/apifox-config.ts";

describe("readApifoxConfig", () => {
  it("returns defaults and provided values", () => {
    const config = readApifoxConfig({
      APIFOX_ACCESS_TOKEN: "token-1",
      APIFOX_PROJECT_ID: "123",
      APIFOX_BRANCH_ID: "10",
      APIFOX_MODULE_ID: "20",
      APIFOX_TIMEOUT_MS: "3000",
    });

    assert.equal(config.apiBaseUrl, "https://api.apifox.com");
    assert.equal(config.accessToken, "token-1");
    assert.equal(config.projectId, "123");
    assert.equal(config.branchId, 10);
    assert.equal(config.moduleId, 20);
    assert.equal(config.timeoutMs, 3000);
  });

  it("reports missing access token only when required", () => {
    const config = readApifoxConfig({});
    assert.deepEqual(config.missingForRequest({ requireProjectId: true }), [
      "APIFOX_ACCESS_TOKEN",
      "APIFOX_PROJECT_ID",
    ]);
  });

  it("uses explicit project id instead of env project id", () => {
    const config = readApifoxConfig({ APIFOX_ACCESS_TOKEN: "token-1" });
    assert.deepEqual(config.missingForRequest({ projectId: "abc", requireProjectId: true }), []);
  });
});
```

- [ ] **Step 2: Run config tests to verify failure**

Run:

```bash
npm test -- tests/config.test.ts
```

Expected: fails because `src/config/apifox-config.ts` does not exist.

- [ ] **Step 3: Implement config parser**

Create `src/config/apifox-config.ts`:

```ts
export interface ApifoxConfig {
  apiBaseUrl: string;
  accessToken?: string;
  projectId?: string;
  branchId?: number;
  moduleId?: number;
  timeoutMs: number;
  missingForRequest(input?: { projectId?: string; requireProjectId?: boolean }): string[];
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readApifoxConfig(env: NodeJS.ProcessEnv = process.env): ApifoxConfig {
  const config = {
    apiBaseUrl: env.APIFOX_API_BASE_URL ?? "https://api.apifox.com",
    accessToken: env.APIFOX_ACCESS_TOKEN,
    projectId: env.APIFOX_PROJECT_ID,
    branchId: optionalNumber(env.APIFOX_BRANCH_ID),
    moduleId: optionalNumber(env.APIFOX_MODULE_ID),
    timeoutMs: optionalNumber(env.APIFOX_TIMEOUT_MS) ?? 15000,
  };

  return {
    ...config,
    missingForRequest(input = {}) {
      const missing: string[] = [];
      if (!config.accessToken) {
        missing.push("APIFOX_ACCESS_TOKEN");
      }
      if (input.requireProjectId && !input.projectId && !config.projectId) {
        missing.push("APIFOX_PROJECT_ID");
      }
      return missing;
    },
  };
}
```

- [ ] **Step 4: Run config tests**

Run:

```bash
npm test -- tests/config.test.ts
```

Expected: config tests pass.

- [ ] **Step 5: Commit config parser**

Run:

```bash
git add src/config/apifox-config.ts tests/config.test.ts
git commit -m "feat: add apifox config parser"
```

## Task 3: Implement Apifox Client

**Files:**
- Create: `src/apifox/types.ts`
- Create: `src/apifox/apifox-client.ts`
- Test: `tests/apifox-client.test.ts`

- [ ] **Step 1: Write failing client tests**

Create `tests/apifox-client.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createApifoxClient } from "../src/apifox/apifox-client.ts";

describe("createApifoxClient", () => {
  it("exports OpenAPI with project, branch, and module options", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.exportOpenApi({
      projectId: "p1",
      branchId: 2,
      moduleId: 3,
      scope: { type: "ALL" },
    });

    assert.equal(calls[0]?.url, "https://api.example.com/v1/projects/p1/export-openapi");
    assert.equal((calls[0]?.init.headers as Record<string, string>).Authorization, "Bearer token-1");
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      scope: { type: "ALL" },
      exportFormat: "JSON",
      oasVersion: "3.1",
      branchId: 2,
      moduleId: 3,
    });
  });

  it("imports OpenAPI with safe defaults", async () => {
    const bodies: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ data: { counters: { endpointUpdated: 1 } } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await client.importOpenApi({
      projectId: "p1",
      document: { openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} },
    });

    assert.deepEqual(bodies[0], {
      input: "{\"openapi\":\"3.1.0\",\"info\":{\"title\":\"x\",\"version\":\"1\"},\"paths\":{}}",
      options: {
        endpointOverwriteBehavior: "AUTO_MERGE",
        schemaOverwriteBehavior: "AUTO_MERGE",
        deleteUnmatchedResources: false,
        updateFolderOfChangedEndpoint: false,
        prependBasePath: false,
      },
    });
  });

  it("throws clear errors for non-2xx responses", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "bad token" }), { status: 401 });

    const client = createApifoxClient({
      apiBaseUrl: "https://api.example.com",
      accessToken: "token-1",
      timeoutMs: 1000,
      fetchImpl,
    });

    await assert.rejects(
      client.exportOpenApi({ projectId: "p1", scope: { type: "ALL" } }),
      /Apifox API request failed: 401/
    );
  });
});
```

- [ ] **Step 2: Run client tests to verify failure**

Run:

```bash
npm test -- tests/apifox-client.test.ts
```

Expected: fails because Apifox client files do not exist.

- [ ] **Step 3: Implement Apifox types**

Create `src/apifox/types.ts`:

```ts
import type { OpenApiDocument } from "../openapi/types.js";

export type ExportScope =
  | { type: "ALL"; excludedByTags?: string[] }
  | { type: "SELECTED_ENDPOINTS"; selectedEndpointIds: number[]; excludedByTags?: string[] }
  | { type: "SELECTED_FOLDERS"; selectedFolderIds: number[]; excludedByTags?: string[] };

export interface ExportOpenApiInput {
  projectId: string;
  scope: ExportScope;
  branchId?: number;
  moduleId?: number;
}

export interface ImportOpenApiInput {
  projectId: string;
  document: OpenApiDocument;
  targetBranchId?: number;
  moduleId?: number;
}

export interface ImportOpenApiResult {
  data?: {
    counters?: Record<string, number>;
  };
}
```

- [ ] **Step 4: Add narrow OpenAPI type used by client**

Create `src/openapi/types.ts`:

```ts
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace";

export interface JsonSchemaObject {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  $ref?: string;
  additionalProperties?: boolean | JsonSchemaObject;
  [key: string]: unknown;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchemaObject }>;
    required?: boolean;
    [key: string]: unknown;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: JsonSchemaObject }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: JsonSchemaObject;
  [key: string]: unknown;
}

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info: { title?: string; version?: string; [key: string]: unknown };
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  components?: {
    schemas?: Record<string, JsonSchemaObject>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const HTTP_METHODS: readonly HttpMethod[] = [
  "get", "post", "put", "patch", "delete", "head", "options", "trace",
] as const;
```

- [ ] **Step 5: Implement client**

Create `src/apifox/apifox-client.ts`:

```ts
import type { ExportOpenApiInput, ImportOpenApiInput, ImportOpenApiResult } from "./types.js";
import type { OpenApiDocument } from "../openapi/types.js";

interface ClientOptions {
  apiBaseUrl: string;
  accessToken: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export interface ApifoxClient {
  exportOpenApi(input: ExportOpenApiInput): Promise<OpenApiDocument>;
  importOpenApi(input: ImportOpenApiInput): Promise<ImportOpenApiResult>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Apifox API request failed: ${response.status} ${text}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

export function createApifoxClient(options: ClientOptions): ApifoxClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetchImpl(joinUrl(options.apiBaseUrl, path), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return await parseJsonResponse(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async exportOpenApi(input) {
      const body = {
        scope: input.scope,
        exportFormat: "JSON",
        oasVersion: "3.1",
        ...(input.branchId === undefined ? {} : { branchId: input.branchId }),
        ...(input.moduleId === undefined ? {} : { moduleId: input.moduleId }),
      };
      return await postJson(`/v1/projects/${input.projectId}/export-openapi`, body) as OpenApiDocument;
    },
    async importOpenApi(input) {
      const body = {
        input: JSON.stringify(input.document),
        options: {
          endpointOverwriteBehavior: "AUTO_MERGE",
          schemaOverwriteBehavior: "AUTO_MERGE",
          deleteUnmatchedResources: false,
          updateFolderOfChangedEndpoint: false,
          prependBasePath: false,
          ...(input.targetBranchId === undefined ? {} : { targetBranchId: input.targetBranchId }),
          ...(input.moduleId === undefined ? {} : { moduleId: input.moduleId }),
        },
      };
      return await postJson(`/v1/projects/${input.projectId}/import-openapi`, body) as ImportOpenApiResult;
    },
  };
}
```

- [ ] **Step 6: Run client tests**

Run:

```bash
npm test -- tests/apifox-client.test.ts
```

Expected: client tests pass.

- [ ] **Step 7: Commit client**

Run:

```bash
git add src/apifox src/openapi/types.ts tests/apifox-client.test.ts
git commit -m "feat: add apifox openapi client"
```

## Task 4: Implement Endpoint Search

**Files:**
- Create: `tests/fixtures/petstore-openapi.ts`
- Create: `src/openapi/search.ts`
- Test: `tests/search.test.ts`

- [ ] **Step 1: Create fixture**

Create `tests/fixtures/petstore-openapi.ts`:

```ts
import type { OpenApiDocument } from "../../src/openapi/types.js";

export const petstoreOpenApi: OpenApiDocument = {
  openapi: "3.1.0",
  info: { title: "Petstore", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        summary: "List pets",
        operationId: "listPets",
        tags: ["pet"],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Pet" } } } } } },
      },
      post: {
        summary: "Create pet",
        operationId: "createPet",
        tags: ["pet"],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } },
        responses: { "201": { description: "created", content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } } },
      },
    },
    "/users/{userId}": {
      get: {
        summary: "Get user",
        operationId: "getUser",
        tags: ["user"],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } },
      },
    },
  },
  components: {
    schemas: {
      Pet: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      User: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
    },
  },
};
```

- [ ] **Step 2: Write failing search tests**

Create `tests/search.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findOperation, listMethodsForPath, searchEndpoints } from "../src/openapi/search.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("searchEndpoints", () => {
  it("finds endpoints by path and method", () => {
    const results = searchEndpoints(petstoreOpenApi, { path: "/pets", method: "get" });
    assert.deepEqual(results.map((item) => `${item.method} ${item.path}`), ["get /pets"]);
  });

  it("finds endpoints by keyword across summary, operationId, and tags", () => {
    const results = searchEndpoints(petstoreOpenApi, { keyword: "user" });
    assert.deepEqual(results.map((item) => item.operationId), ["getUser"]);
  });

  it("lists methods for a path", () => {
    assert.deepEqual(listMethodsForPath(petstoreOpenApi, "/pets"), ["get", "post"]);
  });

  it("finds one operation", () => {
    const operation = findOperation(petstoreOpenApi, "/pets", "post");
    assert.equal(operation?.summary, "Create pet");
  });
});
```

- [ ] **Step 3: Run search tests to verify failure**

Run:

```bash
npm test -- tests/search.test.ts
```

Expected: fails because `src/openapi/search.ts` does not exist.

- [ ] **Step 4: Implement search**

Create `src/openapi/search.ts`:

```ts
import { HTTP_METHODS, type HttpMethod, type OpenApiDocument, type OpenApiOperation } from "./types.js";

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

function includesText(value: string | undefined, needle: string): boolean {
  return value?.toLowerCase().includes(needle) ?? false;
}

function operationMatches(path: string, method: HttpMethod, operation: OpenApiOperation, input: EndpointSearchInput): boolean {
  if (input.path && !path.includes(input.path)) {
    return false;
  }
  if (input.method && method !== input.method) {
    return false;
  }
  if (input.keyword) {
    const needle = input.keyword.toLowerCase();
    return includesText(path, needle)
      || includesText(operation.summary, needle)
      || includesText(operation.operationId, needle)
      || operation.tags?.some((tag) => includesText(tag, needle)) === true;
  }
  return true;
}

export function searchEndpoints(document: OpenApiDocument, input: EndpointSearchInput): EndpointSearchResult[] {
  const results: EndpointSearchResult[] = [];
  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation || !operationMatches(path, method, operation, input)) {
        continue;
      }
      results.push({ path, method, summary: operation.summary, operationId: operation.operationId, tags: operation.tags });
    }
  }
  return results;
}

export function listMethodsForPath(document: OpenApiDocument, path: string): HttpMethod[] {
  const pathItem = document.paths[path];
  if (!pathItem) {
    return [];
  }
  return HTTP_METHODS.filter((method) => pathItem[method] !== undefined);
}

export function findOperation(document: OpenApiDocument, path: string, method: HttpMethod): OpenApiOperation | undefined {
  return document.paths[path]?.[method];
}
```

- [ ] **Step 5: Run search tests**

Run:

```bash
npm test -- tests/search.test.ts
```

Expected: search tests pass.

- [ ] **Step 6: Commit search**

Run:

```bash
git add src/openapi/search.ts tests/search.test.ts tests/fixtures/petstore-openapi.ts
git commit -m "feat: add openapi endpoint search"
```

## Task 5: Implement Request Parameter Patching

**Files:**
- Create: `src/openapi/patch-request-param.ts`
- Test: `tests/patch-request-param.test.ts`

- [ ] **Step 1: Write failing parameter patch tests**

Create `tests/patch-request-param.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchRequestParameter } from "../src/openapi/patch-request-param.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("patchRequestParameter", () => {
  it("adds a query parameter", () => {
    const document = structuredClone(petstoreOpenApi);
    const result = patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      location: "query",
      name: "page",
      schema: { type: "integer", default: 1 },
      required: false,
      description: "Page number",
    });

    assert.equal(result.action, "added");
    const param = document.paths["/pets"]?.get?.parameters?.find((item) => item.name === "page");
    assert.deepEqual(param, {
      name: "page",
      in: "query",
      required: false,
      description: "Page number",
      schema: { type: "integer", default: 1 },
    });
  });

  it("updates an existing parameter instead of duplicating it", () => {
    const document = structuredClone(petstoreOpenApi);
    const result = patchRequestParameter(document, {
      path: "/pets",
      method: "get",
      location: "query",
      name: "limit",
      schema: { type: "integer", default: 20 },
      description: "Max items",
    });

    assert.equal(result.action, "updated");
    const params = document.paths["/pets"]?.get?.parameters?.filter((item) => item.name === "limit" && item.in === "query");
    assert.equal(params?.length, 1);
    assert.equal(params?.[0]?.description, "Max items");
    assert.deepEqual(params?.[0]?.schema, { type: "integer", default: 20 });
  });

  it("rejects missing target operation", () => {
    const document = structuredClone(petstoreOpenApi);
    assert.throws(() => patchRequestParameter(document, {
      path: "/missing",
      method: "get",
      location: "query",
      name: "page",
      schema: { type: "integer" },
    }), /Operation not found/);
  });
});
```

- [ ] **Step 2: Run parameter patch tests to verify failure**

Run:

```bash
npm test -- tests/patch-request-param.test.ts
```

Expected: fails because patch module does not exist.

- [ ] **Step 3: Implement parameter patcher**

Create `src/openapi/patch-request-param.ts`:

```ts
import type { HttpMethod, JsonSchemaObject, OpenApiDocument, OpenApiParameter } from "./types.js";

export interface PatchRequestParameterInput {
  path: string;
  method: HttpMethod;
  location: OpenApiParameter["in"];
  name: string;
  schema: JsonSchemaObject;
  required?: boolean;
  description?: string;
}

export interface PatchResult {
  action: "added" | "updated";
  path: string;
  method: HttpMethod;
}

export function patchRequestParameter(document: OpenApiDocument, input: PatchRequestParameterInput): PatchResult {
  const operation = document.paths[input.path]?.[input.method];
  if (!operation) {
    throw new Error(`Operation not found: ${input.method.toUpperCase()} ${input.path}`);
  }

  operation.parameters ??= [];
  const existing = operation.parameters.find((param) => param.name === input.name && param.in === input.location);
  const next: OpenApiParameter = {
    name: input.name,
    in: input.location,
    ...(input.required === undefined ? {} : { required: input.required }),
    ...(input.description === undefined ? {} : { description: input.description }),
    schema: input.schema,
  };

  if (existing) {
    Object.assign(existing, next);
    return { action: "updated", path: input.path, method: input.method };
  }

  operation.parameters.push(next);
  return { action: "added", path: input.path, method: input.method };
}
```

- [ ] **Step 4: Run parameter patch tests**

Run:

```bash
npm test -- tests/patch-request-param.test.ts
```

Expected: parameter patch tests pass.

- [ ] **Step 5: Commit parameter patcher**

Run:

```bash
git add src/openapi/patch-request-param.ts tests/patch-request-param.test.ts
git commit -m "feat: add request parameter patching"
```

## Task 6: Implement Schema Field Patching

**Files:**
- Create: `src/openapi/patch-schema-field.ts`
- Test: `tests/patch-schema-field.test.ts`

- [ ] **Step 1: Write failing schema field tests**

Create `tests/patch-schema-field.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchRequestBodyField, patchResponseField } from "../src/openapi/patch-schema-field.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("patch-schema-field", () => {
  it("adds a request body field", () => {
    const document = structuredClone(petstoreOpenApi);
    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "age",
      schema: { type: "integer", default: 1, description: "Pet age" },
      required: true,
    });

    assert.equal(result.action, "added");
    const schema = document.components?.schemas?.Pet;
    assert.equal(schema?.properties?.age?.type, "integer");
    assert.deepEqual(schema?.required, ["age"]);
  });

  it("adds a nested response field", () => {
    const document = structuredClone(petstoreOpenApi);
    const result = patchResponseField(document, {
      path: "/users/{userId}",
      method: "get",
      statusCode: "200",
      contentType: "application/json",
      fieldPath: "profile.score",
      schema: { type: "number", default: 1 },
    });

    assert.equal(result.action, "added");
    const user = document.components?.schemas?.User;
    assert.equal(user?.properties?.profile?.type, "object");
    assert.equal(user?.properties?.profile?.properties?.score?.type, "number");
  });

  it("updates an existing field", () => {
    const document = structuredClone(petstoreOpenApi);
    const result = patchRequestBodyField(document, {
      path: "/pets",
      method: "post",
      contentType: "application/json",
      fieldPath: "name",
      schema: { type: "string", description: "Display name" },
    });

    assert.equal(result.action, "updated");
    assert.equal(document.components?.schemas?.Pet?.properties?.name?.description, "Display name");
  });
});
```

- [ ] **Step 2: Run schema field tests to verify failure**

Run:

```bash
npm test -- tests/patch-schema-field.test.ts
```

Expected: fails because schema patch module does not exist.

- [ ] **Step 3: Implement schema field patcher**

Create `src/openapi/patch-schema-field.ts`:

```ts
import type { HttpMethod, JsonSchemaObject, OpenApiDocument } from "./types.js";

interface FieldPatchInput {
  path: string;
  method: HttpMethod;
  contentType: string;
  fieldPath: string;
  schema: JsonSchemaObject;
  required?: boolean;
}

interface ResponseFieldPatchInput extends FieldPatchInput {
  statusCode: string;
}

export interface FieldPatchResult {
  action: "added" | "updated";
}

function resolveSchemaRef(document: OpenApiDocument, schema: JsonSchemaObject | undefined): JsonSchemaObject {
  if (!schema) {
    throw new Error("Schema not found");
  }
  if (!schema.$ref) {
    return schema;
  }
  const match = schema.$ref.match(/^#\/components\/schemas\/([^/]+)$/);
  if (!match) {
    throw new Error(`Unsupported schema ref: ${schema.$ref}`);
  }
  const name = decodeURIComponent(match[1] ?? "");
  const resolved = document.components?.schemas?.[name];
  if (!resolved) {
    throw new Error(`Schema ref not found: ${schema.$ref}`);
  }
  return resolved;
}

function ensureObjectSchema(schema: JsonSchemaObject): void {
  schema.type ??= "object";
  schema.properties ??= {};
}

function patchField(root: JsonSchemaObject, fieldPath: string, schema: JsonSchemaObject, required?: boolean): FieldPatchResult {
  const segments = fieldPath.split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("fieldPath must not be empty");
  }

  let current = root;
  for (const segment of segments.slice(0, -1)) {
    ensureObjectSchema(current);
    const next = current.properties?.[segment] ?? { type: "object", properties: {} };
    current.properties![segment] = next;
    current = next;
  }

  ensureObjectSchema(current);
  const leaf = segments[segments.length - 1]!;
  const action = current.properties?.[leaf] ? "updated" : "added";
  current.properties![leaf] = { ...(current.properties?.[leaf] ?? {}), ...schema };

  if (required === true) {
    current.required ??= [];
    if (!current.required.includes(leaf)) {
      current.required.push(leaf);
    }
  }

  return { action };
}

export function patchRequestBodyField(document: OpenApiDocument, input: FieldPatchInput): FieldPatchResult {
  const operation = document.paths[input.path]?.[input.method];
  const media = operation?.requestBody?.content?.[input.contentType];
  const schema = resolveSchemaRef(document, media?.schema);
  return patchField(schema, input.fieldPath, input.schema, input.required);
}

export function patchResponseField(document: OpenApiDocument, input: ResponseFieldPatchInput): FieldPatchResult {
  const operation = document.paths[input.path]?.[input.method];
  const media = operation?.responses?.[input.statusCode]?.content?.[input.contentType];
  const schema = resolveSchemaRef(document, media?.schema);
  return patchField(schema, input.fieldPath, input.schema, input.required);
}
```

- [ ] **Step 4: Run schema field tests**

Run:

```bash
npm test -- tests/patch-schema-field.test.ts
```

Expected: schema field tests pass.

- [ ] **Step 5: Commit schema field patcher**

Run:

```bash
git add src/openapi/patch-schema-field.ts tests/patch-schema-field.test.ts
git commit -m "feat: add schema field patching"
```

## Task 7: Build Minimal Documents and Diffs

**Files:**
- Create: `src/openapi/ref-collector.ts`
- Create: `src/openapi/minimal-doc.ts`
- Create: `src/openapi/diff.ts`
- Test: `tests/minimal-doc.test.ts`

- [ ] **Step 1: Write failing minimal document tests**

Create `tests/minimal-doc.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJsonDiff } from "../src/openapi/diff.ts";
import { buildMinimalDocument } from "../src/openapi/minimal-doc.ts";
import { petstoreOpenApi } from "./fixtures/petstore-openapi.ts";

describe("minimal-doc", () => {
  it("keeps one operation and required component refs", () => {
    const minimal = buildMinimalDocument(petstoreOpenApi, "/pets", "post");
    assert.deepEqual(Object.keys(minimal.paths), ["/pets"]);
    assert.deepEqual(Object.keys(minimal.paths["/pets"] ?? {}), ["post"]);
    assert.deepEqual(Object.keys(minimal.components?.schemas ?? {}), ["Pet"]);
  });

  it("creates deterministic diff text", () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1, b: 3 };
    assert.equal(createJsonDiff(before, after), [
      "--- before",
      "+++ after",
      "-  \"b\": 2",
      "+  \"b\": 3",
    ].join("\\n"));
  });
});
```

- [ ] **Step 2: Run minimal doc tests to verify failure**

Run:

```bash
npm test -- tests/minimal-doc.test.ts
```

Expected: fails because minimal document modules do not exist.

- [ ] **Step 3: Implement ref collector**

Create `src/openapi/ref-collector.ts`:

```ts
import type { OpenApiDocument } from "./types.js";

export function collectSchemaRefs(value: unknown): string[] {
  const refs = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if ("$ref" in node && typeof (node as { $ref?: unknown }).$ref === "string") {
      const ref = (node as { $ref: string }).$ref;
      const match = ref.match(/^#\/components\/schemas\/([^/]+)$/);
      if (match?.[1]) {
        refs.add(decodeURIComponent(match[1]));
      }
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
      visit(child);
    }
  };
  visit(value);
  return [...refs].sort();
}

export function collectSchemaClosure(document: OpenApiDocument, root: unknown): Record<string, unknown> {
  const collected: Record<string, unknown> = {};
  const queue = collectSchemaRefs(root);
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (collected[name]) {
      continue;
    }
    const schema = document.components?.schemas?.[name];
    if (!schema) {
      throw new Error(`Schema ref not found: ${name}`);
    }
    collected[name] = structuredClone(schema);
    for (const nested of collectSchemaRefs(schema)) {
      if (!collected[nested]) {
        queue.push(nested);
      }
    }
  }
  return collected;
}
```

- [ ] **Step 4: Implement minimal document builder**

Create `src/openapi/minimal-doc.ts`:

```ts
import type { HttpMethod, OpenApiDocument } from "./types.js";
import { collectSchemaClosure } from "./ref-collector.js";

export function buildMinimalDocument(document: OpenApiDocument, path: string, method: HttpMethod): OpenApiDocument {
  const operation = document.paths[path]?.[method];
  if (!operation) {
    throw new Error(`Operation not found: ${method.toUpperCase()} ${path}`);
  }
  const operationClone = structuredClone(operation);
  const schemas = collectSchemaClosure(document, operationClone);
  return {
    openapi: document.openapi ?? "3.1.0",
    info: {
      title: document.info.title ?? "Apifox OpenAPI Patch",
      version: document.info.version ?? "1.0.0",
    },
    paths: {
      [path]: {
        [method]: operationClone,
      },
    },
    ...(Object.keys(schemas).length === 0 ? {} : { components: { schemas } }),
  };
}
```

- [ ] **Step 5: Implement simple deterministic diff**

Create `src/openapi/diff.ts`:

```ts
export function createJsonDiff(before: unknown, after: unknown): string {
  const beforeLines = JSON.stringify(before, null, 2).split("\\n");
  const afterLines = JSON.stringify(after, null, 2).split("\\n");
  const output = ["--- before", "+++ after"];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < max; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      continue;
    }
    if (beforeLine !== undefined) {
      output.push(`-${beforeLine}`);
    }
    if (afterLine !== undefined) {
      output.push(`+${afterLine}`);
    }
  }
  return output.join("\\n");
}
```

- [ ] **Step 6: Run minimal document tests**

Run:

```bash
npm test -- tests/minimal-doc.test.ts
```

Expected: minimal document tests pass.

- [ ] **Step 7: Run lint and fix unused code**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 8: Commit minimal document support**

Run:

```bash
git add src/openapi/ref-collector.ts src/openapi/minimal-doc.ts src/openapi/diff.ts tests/minimal-doc.test.ts
git commit -m "feat: add minimal openapi document generation"
```

## Task 8: Implement Pending Changes

**Files:**
- Create: `src/pending/pending-changes.ts`
- Test: `tests/pending-changes.test.ts`

- [ ] **Step 1: Write failing pending change tests**

Create `tests/pending-changes.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingChangeStore } from "../src/pending/pending-changes.ts";

describe("pending changes", () => {
  it("creates, reads, applies, and removes changes", () => {
    const store = createPendingChangeStore(() => "change-1");
    const change = store.create({
      projectId: "p1",
      summary: "Add query parameter page",
      diff: "+ page",
      document: { openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} },
    });

    assert.equal(change.changeId, "change-1");
    assert.equal(store.get("change-1")?.summary, "Add query parameter page");
    assert.equal(store.consume("change-1")?.changeId, "change-1");
    assert.equal(store.get("change-1"), undefined);
  });

  it("discards changes", () => {
    const store = createPendingChangeStore(() => "change-1");
    store.create({
      projectId: "p1",
      summary: "x",
      diff: "diff",
      document: { openapi: "3.1.0", info: { title: "x", version: "1" }, paths: {} },
    });

    assert.equal(store.discard("change-1"), true);
    assert.equal(store.discard("change-1"), false);
  });
});
```

- [ ] **Step 2: Run pending tests to verify failure**

Run:

```bash
npm test -- tests/pending-changes.test.ts
```

Expected: fails because pending store does not exist.

- [ ] **Step 3: Implement pending store**

Create `src/pending/pending-changes.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { OpenApiDocument } from "../openapi/types.js";

export interface PendingChangeInput {
  projectId: string;
  targetBranchId?: number;
  moduleId?: number;
  summary: string;
  diff: string;
  document: OpenApiDocument;
}

export interface PendingChange extends PendingChangeInput {
  changeId: string;
  createdAt: string;
}

export interface PendingChangeStore {
  create(input: PendingChangeInput): PendingChange;
  get(changeId: string): PendingChange | undefined;
  consume(changeId: string): PendingChange | undefined;
  discard(changeId: string): boolean;
}

export function createPendingChangeStore(idFactory: () => string = randomUUID): PendingChangeStore {
  const changes = new Map<string, PendingChange>();
  return {
    create(input) {
      const change: PendingChange = {
        ...input,
        changeId: idFactory(),
        createdAt: new Date().toISOString(),
      };
      changes.set(change.changeId, change);
      return change;
    },
    get(changeId) {
      return changes.get(changeId);
    },
    consume(changeId) {
      const change = changes.get(changeId);
      if (change) {
        changes.delete(changeId);
      }
      return change;
    },
    discard(changeId) {
      return changes.delete(changeId);
    },
  };
}

export const pendingChanges = createPendingChangeStore();
```

- [ ] **Step 4: Run pending tests**

Run:

```bash
npm test -- tests/pending-changes.test.ts
```

Expected: pending tests pass.

- [ ] **Step 5: Commit pending store**

Run:

```bash
git add src/pending/pending-changes.ts tests/pending-changes.test.ts
git commit -m "feat: add pending change store"
```

## Task 9: Register Apifox MCP Tools

**Files:**
- Create all `src/tools/apifox-*.ts` files listed in File Structure
- Test: `tests/tools.test.ts`
- Modify/delete: remove template demo modules and tests

- [ ] **Step 1: Write tool integration tests**

Create `tests/tools.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withTestClient, assertToolResponse } from "./helpers/test-client.ts";

describe("Apifox tools", () => {
  it("lists Apifox tools", async () => {
    await withTestClient(async (client) => {
      const response = await client.listTools();
      const names = response.tools.map((tool) => tool.name).sort();
      assert(names.includes("apifox_search_endpoints"));
      assert(names.includes("apifox_preview_request_param_change"));
      assert(names.includes("apifox_apply_change"));
      assert(!names.includes("demo-tool"));
    });
  });

  it("reports missing configuration for search", async () => {
    await withTestClient(async (client) => {
      const response = await client.callTool("apifox_search_endpoints", { path: "/pets" });
      assertToolResponse(response, "Missing required Apifox configuration: APIFOX_ACCESS_TOKEN, APIFOX_PROJECT_ID");
    });
  });
});
```

- [ ] **Step 2: Run tool tests to verify failure**

Run:

```bash
npm test -- tests/tools.test.ts
```

Expected: fails because Apifox tools are not registered.

- [ ] **Step 3: Create shared tool helpers**

Create `src/tools/tool-helpers.ts`:

```ts
import { readApifoxConfig } from "../config/apifox-config.js";
import { createApifoxClient } from "../apifox/apifox-client.js";

export function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonResponse(value: unknown) {
  return textResponse(JSON.stringify(value, null, 2));
}

export function requireApifox(projectId?: string) {
  const config = readApifoxConfig();
  const missing = config.missingForRequest({ projectId, requireProjectId: true });
  if (missing.length > 0 || !config.accessToken) {
    return { error: `Missing required Apifox configuration: ${missing.join(", ")}` };
  }
  return {
    config,
    projectId: projectId ?? config.projectId!,
    client: createApifoxClient({
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.accessToken,
      timeoutMs: config.timeoutMs,
    }),
  };
}
```

- [ ] **Step 4: Implement search tool**

Create `src/tools/apifox-search-endpoints.ts`:

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { searchEndpoints } from "../openapi/search.js";
import { jsonResponse, requireApifox, textResponse } from "./tool-helpers.js";

const module: RegisterableModule = {
  type: "tool",
  name: "apifox_search_endpoints",
  description: "Search Apifox OpenAPI endpoints by path, method, or keyword",
  register(server: McpServer) {
    server.tool("apifox_search_endpoints", this.description!, {
      projectId: z.string().optional(),
      path: z.string().optional(),
      method: z.enum(["get", "post", "put", "patch", "delete", "head", "options", "trace"]).optional(),
      keyword: z.string().optional(),
    }, async (args) => {
      const ready = requireApifox(args.projectId);
      if ("error" in ready) {
        return textResponse(ready.error);
      }
      const document = await ready.client.exportOpenApi({
        projectId: ready.projectId,
        branchId: ready.config.branchId,
        moduleId: ready.config.moduleId,
        scope: { type: "ALL" },
      });
      return jsonResponse(searchEndpoints(document, args));
    });
  },
};

export default module;
```

- [ ] **Step 5: Implement get endpoint tool**

Create `src/tools/apifox-get-endpoint.ts`:

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { findOperation, listMethodsForPath } from "../openapi/search.js";
import { jsonResponse, requireApifox, textResponse } from "./tool-helpers.js";

const module: RegisterableModule = {
  type: "tool",
  name: "apifox_get_endpoint",
  description: "Read one Apifox OpenAPI endpoint operation by path and method",
  register(server: McpServer) {
    server.tool("apifox_get_endpoint", this.description!, {
      projectId: z.string().optional(),
      path: z.string().min(1),
      method: z.enum(["get", "post", "put", "patch", "delete", "head", "options", "trace"]).optional(),
    }, async (args) => {
      const ready = requireApifox(args.projectId);
      if ("error" in ready) {
        return textResponse(ready.error);
      }
      const document = await ready.client.exportOpenApi({
        projectId: ready.projectId,
        branchId: ready.config.branchId,
        moduleId: ready.config.moduleId,
        scope: { type: "ALL" },
      });
      const methods = listMethodsForPath(document, args.path);
      if (!args.method) {
        return jsonResponse({ clarificationRequired: true, availableMethods: methods });
      }
      const operation = findOperation(document, args.path, args.method);
      return operation ? jsonResponse(operation) : jsonResponse({ found: false, availableMethods: methods });
    });
  },
};

export default module;
```

- [ ] **Step 6: Implement export tool**

Create `src/tools/apifox-export-openapi.ts`:

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterableModule } from "../registry/types.js";
import { jsonResponse, requireApifox, textResponse } from "./tool-helpers.js";

const scopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ALL"), excludedByTags: z.array(z.string()).optional() }),
  z.object({
    type: z.literal("SELECTED_ENDPOINTS"),
    selectedEndpointIds: z.array(z.number()),
    excludedByTags: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("SELECTED_FOLDERS"),
    selectedFolderIds: z.array(z.number()),
    excludedByTags: z.array(z.string()).optional(),
  }),
]);

const module: RegisterableModule = {
  type: "tool",
  name: "apifox_export_openapi",
  description: "Export OpenAPI from Apifox with an explicit scope",
  register(server: McpServer) {
    server.tool("apifox_export_openapi", this.description!, {
      projectId: z.string().optional(),
      scope: scopeSchema.default({ type: "ALL" }),
    }, async (args) => {
      const ready = requireApifox(args.projectId);
      if ("error" in ready) {
        return textResponse(ready.error);
      }
      const document = await ready.client.exportOpenApi({
        projectId: ready.projectId,
        branchId: ready.config.branchId,
        moduleId: ready.config.moduleId,
        scope: args.scope,
      });
      return jsonResponse(document);
    });
  },
};

export default module;
```

- [ ] **Step 7: Implement preview tools**

Create the three preview tool files. Each tool must:

1. Validate required fields in Zod.
2. Export OpenAPI with `ALL`.
3. Clone the original document.
4. Apply the relevant patch.
5. Build a minimal document.
6. Create a diff between original and patched operation.
7. Store a pending change.
8. Return `changeId`, summary, and diff.

Core handler pattern:

```ts
const beforeOperation = structuredClone(document.paths[args.path]?.[args.method]);
const result = patchRequestParameter(document, {
  path: args.path,
  method: args.method,
  location: args.location,
  name: args.name,
  schema: args.schema,
  required: args.required,
  description: args.description,
});
const afterOperation = document.paths[args.path]?.[args.method];
const minimal = buildMinimalDocument(document, args.path, args.method);
const diff = createJsonDiff(beforeOperation, afterOperation);
const change = pendingChanges.create({
  projectId: ready.projectId,
  targetBranchId: ready.config.branchId,
  moduleId: ready.config.moduleId,
  summary: `${result.action} ${args.location} parameter ${args.name} on ${args.method.toUpperCase()} ${args.path}`,
  diff,
  document: minimal,
});
return jsonResponse({ changeId: change.changeId, summary: change.summary, diff });
```

- [ ] **Step 8: Implement apply and discard tools**

Create `src/tools/apifox-apply-change.ts`:

```ts
const change = pendingChanges.consume(args.changeId);
if (!change) {
  return jsonResponse({ applied: false, error: "Pending change not found. Run preview again." });
}
const result = await ready.client.importOpenApi({
  projectId: change.projectId,
  targetBranchId: change.targetBranchId,
  moduleId: change.moduleId,
  document: change.document,
});
return jsonResponse({ applied: true, summary: change.summary, result });
```

Create `src/tools/apifox-discard-change.ts`:

```ts
const discarded = pendingChanges.discard(args.changeId);
return jsonResponse({ discarded });
```

- [ ] **Step 9: Remove template demo modules**

Run:

```bash
rm -f src/tools/demo-tool.ts src/resources/system-info.ts src/resources/timestamp.ts src/prompts/code-analyzer.ts src/prompts/generate-readme.ts
rm -f related demo tests
```

Expected: only Apifox tools remain registered.

- [ ] **Step 10: Run tool tests**

Run:

```bash
npm test -- tests/tools.test.ts
```

Expected: tool list and missing-configuration tests pass.

- [ ] **Step 11: Commit tools**

Run:

```bash
git add src/tools tests/tools.test.ts
git rm --ignore-unmatch src/tools/demo-tool.ts src/resources/system-info.ts src/resources/timestamp.ts src/prompts/code-analyzer.ts src/prompts/generate-readme.ts related demo tests
git commit -m "feat: register apifox mcp tools"
```

## Task 10: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `mcp.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update `.gitignore`**

Ensure `.gitignore` contains:

```gitignore
.DS_Store
node_modules
build
dist
.env
.env.local
.env.*.local
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
.idea
.vscode
```

- [ ] **Step 2: Update `mcp.json` sample**

Modify `mcp.json`:

```json
{
  "mcpServers": {
    "Apifox OpenAPI Patch": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {
        "APIFOX_ACCESS_TOKEN": "<access-token>",
        "APIFOX_PROJECT_ID": "<project-id>",
        "APIFOX_MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

- [ ] **Step 3: Update `README.md`**

Include:

```md
# Apifox OpenAPI Patch MCP

This MCP server lets AI clients search Apifox OpenAPI documents, preview request/response schema changes, and apply approved changes through Apifox OpenAPI import.

## Safety Model

Read tools execute immediately. Write-like tools create a preview and `changeId`. Only `apifox_apply_change` writes to Apifox.

## Required Environment

- `APIFOX_ACCESS_TOKEN`
- `APIFOX_PROJECT_ID`

Optional:

- `APIFOX_API_BASE_URL`
- `APIFOX_BRANCH_ID`
- `APIFOX_MODULE_ID`
- `APIFOX_TIMEOUT_MS`

## Local Commands

```bash
npm install
npm run build
npm run serve:stdio
```

## Example Workflow

1. Call `apifox_search_endpoints`.
2. Call `apifox_preview_request_param_change`.
3. Review `diff`.
4. Call `apifox_apply_change` with `changeId`.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Inspect MCP server**

Run:

```bash
npm run inspect
```

Expected: Inspector starts and lists the Apifox tools. Stop the inspector after confirming tool list.

- [ ] **Step 6: Commit docs and verification fixes**

Run:

```bash
git add README.md mcp.json .gitignore package.json package-lock.json src tests
git commit -m "docs: document apifox mcp usage"
```

## Self-Review Checklist

- Spec requirement "template baseline" is covered by Task 1.
- Spec requirement "direct read tools" is covered by Task 9.
- Spec requirement "preview-first writes" is covered by Tasks 8 and 9.
- Spec requirement "safe import options" is covered by Task 3.
- Spec requirement "no guessing missing key fields" is covered by Zod schemas in Task 9 and config/search behavior in Tasks 2 and 4.
- Spec requirement "request parameter patching" is covered by Task 5.
- Spec requirement "request body and response field patching" is covered by Task 6.
- Spec requirement "minimal OpenAPI document and refs" is covered by Task 7.
- Spec requirement "tests do not call real Apifox" is covered by mocked client tests and fixture-based OpenAPI tests.
