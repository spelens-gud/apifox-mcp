# Apifox OpenAPI Patch MCP Design

## Background

Apifox's current public OpenAPI import/export APIs are project-scoped entry points. They can export OpenAPI documents and import complete OpenAPI JSON/YAML, but they are not ideal as direct low-level MCP tools for natural-language single-interface edits. A user request such as "add request parameter a with default value 1 to /users" needs endpoint discovery, precise OpenAPI patching, preview, confirmation, and safe import behavior.

This project will build a TypeScript MCP server that turns natural-language editing requests into conservative, auditable OpenAPI patches for Apifox.

## Template Baseline

Use `alexanderop/mcp-server-starter-ts` as the project baseline.

Reasons:

- It uses the official `@modelcontextprotocol/sdk`.
- It supports both stdio and HTTP transports.
- It includes TypeScript, test, lint, and MCP inspector scripts.
- Its structure is suitable for a business MCP server without introducing a heavier framework.

The project will be renamed conceptually to `apifox-openapi-patch-mcp`.

## Goals

- Support safe reads from Apifox OpenAPI exports.
- Support preview-first edits for request parameters, request body fields, and response fields.
- Apply approved changes back to Apifox through OpenAPI import.
- Avoid guessing missing critical information.
- Keep the first version focused and testable.

## Non-Goals

- Do not build a full Apifox replacement.
- Do not directly expose raw import as the primary write workflow.
- Do not implement long-lived local caching in the first version.
- Do not support delete operations in the first version.
- Do not infer method, parameter location, or schema type when the user omitted them.

## Safety Policy

Tools are split by risk:

- Read/search/export tools execute directly.
- Write-like tools only create a pending preview and diff.
- `apifox_apply_change` is the only tool that writes back to Apifox.

Missing method, parameter location, field type, status code, or content type must produce a clarification response instead of a guessed patch.

Pending changes are process-local and expire when the MCP server restarts.

## Architecture

The server has five layers:

1. MCP Tools layer
   - Registers tools and validates input with Zod.
   - Converts tool calls into application service calls.

2. Apifox Client layer
   - Calls `POST /v1/projects/{projectId}/export-openapi`.
   - Calls `POST /v1/projects/{projectId}/import-openapi`.
   - Reads configuration from environment variables at tool-call time.

3. OpenAPI Workspace layer
   - Holds exported OpenAPI documents for one operation.
   - Locates target path and method.
   - Builds minimal import documents.
   - Stores pending changes by `changeId`.

4. Patch Engine layer
   - Modifies OpenAPI AST objects.
   - Adds or updates request parameters.
   - Adds or updates request body JSON schema fields.
   - Adds or updates response JSON schema fields.
   - Collects required `$ref` component dependencies.

5. Safety layer
   - Produces diffs.
   - Blocks ambiguous writes.
   - Ensures `deleteUnmatchedResources` is always false for generated imports.

## MCP Tools

### Direct Read Tools

`apifox_search_endpoints`

- Searches exported OpenAPI paths by path, method, keyword, summary, operationId, and tags.
- Returns candidates with `path`, `method`, `summary`, `operationId`, and `tags`.

`apifox_get_endpoint`

- Reads one endpoint operation by explicit `path` and `method`.
- If `method` is omitted, returns available methods for the path and asks for clarification.

`apifox_export_openapi`

- Raw export helper for advanced debugging.
- Supports `ALL`, `SELECTED_ENDPOINTS`, and `SELECTED_FOLDERS` scopes where Apifox supports them.

### Preview Tools

`apifox_preview_request_param_change`

- Adds or updates query, path, header, or cookie parameters.
- Required inputs: `path`, `method`, `location`, `name`, `schema.type`.
- Optional inputs: `required`, `default`, `description`, `schema.format`, `schema.enum`.

`apifox_preview_request_body_field_change`

- Adds or updates a JSON request body field.
- Required inputs: `path`, `method`, `contentType`, `fieldPath`, `schema.type`.
- Optional inputs: `required`, `default`, `description`, `schema.format`, `schema.enum`.

`apifox_preview_response_field_change`

- Adds or updates a response field.
- Required inputs: `path`, `method`, `statusCode`, `contentType`, `fieldPath`, `schema.type`.
- Optional inputs: `required`, `default`, `description`, `schema.format`, `schema.enum`.

### Write Confirmation Tools

`apifox_apply_change`

- Applies a pending change by `changeId`.
- Imports the generated minimal OpenAPI document into Apifox.
- Deletes the pending change after a successful import.

`apifox_discard_change`

- Removes a pending change by `changeId`.

## Apifox Import Options

Generated imports use safe defaults:

```json
{
  "endpointOverwriteBehavior": "AUTO_MERGE",
  "schemaOverwriteBehavior": "AUTO_MERGE",
  "deleteUnmatchedResources": false,
  "updateFolderOfChangedEndpoint": false,
  "prependBasePath": false
}
```

`targetBranchId` and `moduleId` are included when configured or explicitly provided.

## Endpoint Export Strategy

The preferred path is:

1. Search or identify the endpoint.
2. Export with `SELECTED_ENDPOINTS` when the endpoint ID is available and supported.
3. If selected endpoint export is unavailable, export `ALL` and locate the target path/method locally.
4. Build a minimal OpenAPI import document containing only the target operation and required components.

## Example Flow

User intent:

```text
给 /users 的 GET 接口增加 query 参数 a，类型 number，默认值 1
```

Tool flow:

1. `apifox_search_endpoints` finds `/users` `get`.
2. `apifox_preview_request_param_change` receives `path=/users`, `method=get`, `location=query`, `name=a`, `schema.type=number`, `default=1`.
3. The server exports OpenAPI from Apifox.
4. The Patch Engine adds or updates `paths["/users"].get.parameters`.
5. The server creates a minimal OpenAPI import document.
6. The server stores a pending change and returns `changeId` plus diff.
7. The user confirms.
8. `apifox_apply_change` imports the document into Apifox.
9. The tool returns Apifox counters and a concise change summary.

## Error Handling

- Missing `APIFOX_ACCESS_TOKEN`: the tool call fails with a clear configuration error.
- Missing `APIFOX_PROJECT_ID`: the tool call fails with a clear configuration error unless `projectId` is provided as input.
- Path not found: return similar paths if available.
- Method omitted: return methods available for that path.
- Parameter location omitted: return a clarification request.
- Content type omitted for body or response edits: return a clarification request.
- Schema type omitted: return a clarification request.
- `$ref` resolution failure: fail preview and do not create a pending change.
- Import counters include failures: return the counters and do not hide the partial failure.
- Pending change not found: ask the user to run preview again.

## Configuration

Environment variables:

- `APIFOX_ACCESS_TOKEN`: Apifox API access token.
- `APIFOX_PROJECT_ID`: default project ID.
- `APIFOX_API_BASE_URL`: optional, defaults to Apifox public API base URL.
- `APIFOX_BRANCH_ID`: optional default branch ID.
- `APIFOX_MODULE_ID`: optional default module ID.
- `APIFOX_TIMEOUT_MS`: optional request timeout.

The server may start without required Apifox variables, but tool calls requiring Apifox access must validate and report missing configuration.

## Testing Strategy

Tests do not call real Apifox APIs.

Coverage:

- Apifox client request body construction and error mapping using mocked fetch.
- Endpoint search over OpenAPI fixtures.
- Request parameter add/update behavior.
- Request body field add/update behavior.
- Response field add/update behavior.
- Required-field clarification behavior.
- `$ref` dependency collection.
- Pending change create, apply, discard, and not-found behavior.
- MCP tool input validation and response shape.

Development should follow TDD for core modules.

## First Implementation Scope

Implement only:

- Search/read/export tools.
- Preview request parameter changes.
- Preview request body field changes.
- Preview response field changes.
- Apply/discard pending changes.
- Minimal OpenAPI document generation.
- Unit tests for the above.

Deletion, long-lived cache, batch edits, and broader metadata editing are deferred.
