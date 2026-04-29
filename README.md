# Apifox OpenAPI Patch MCP

This MCP server lets AI clients search Apifox OpenAPI documents, preview precise request/response changes, and apply approved changes through Apifox OpenAPI import.

## Safety Model

Read tools execute immediately. Write-like tools only create a preview and a `changeId`. Only `apifox_apply_change` writes back to Apifox.

The apply flow imports a minimal OpenAPI document containing the target operation and referenced schemas. Import uses Apifox auto-merge behavior and does not delete unmatched resources.

## Tools

- `apifox_search_endpoints`: Search endpoints by path, method, or keyword.
- `apifox_get_endpoint`: Read one endpoint operation by path and method.
- `apifox_export_openapi`: Export OpenAPI using an explicit Apifox scope.
- `apifox_preview_request_param_change`: Preview adding or updating a request parameter.
- `apifox_preview_request_body_field_change`: Preview adding or updating a request body schema field.
- `apifox_preview_response_field_change`: Preview adding or updating a response schema field.
- `apifox_apply_change`: Apply a previously previewed pending change.
- `apifox_discard_change`: Discard a pending change.

## Required Environment

- `APIFOX_ACCESS_TOKEN`
- `APIFOX_PROJECT_ID`

Optional:

- `APIFOX_API_BASE_URL`, defaults to `https://api.apifox.com`
- `APIFOX_BRANCH_ID`
- `APIFOX_MODULE_ID`
- `APIFOX_TIMEOUT_MS`, defaults to `15000`
- `APIFOX_MCP_TRANSPORT`, `stdio` or `http`, defaults to `stdio`
- `APIFOX_MCP_HOST`, used by HTTP transport, defaults to `127.0.0.1`
- `APIFOX_MCP_HTTP_BEARER_TOKEN`, enables bearer-token auth for HTTP transport
- `CORS_ORIGIN`, used by HTTP transport, defaults to the local server origin
- `PORT`, used by HTTP transport, defaults to `3000`

## Local Commands

```bash
npm install
npm run build
npm run serve:stdio
```

HTTP transport:

```bash
APIFOX_MCP_TRANSPORT=http PORT=3000 npm run serve:http
```

HTTP mode binds to `127.0.0.1` by default. Set `APIFOX_MCP_HOST` explicitly if you need a different bind address, and set `APIFOX_MCP_HTTP_BEARER_TOKEN` before exposing HTTP mode beyond local development.

Development checks:

```bash
npm run typecheck
npm run lint
npm test
```

## MCP Client Config

Build before using the stdio config:

```bash
npm run build
```

Example:

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

## Example Workflow

1. Call `apifox_search_endpoints` to find the path and method.
2. Call `apifox_preview_request_param_change`, `apifox_preview_request_body_field_change`, or `apifox_preview_response_field_change`.
3. Review the returned `diff`.
4. Call `apifox_apply_change` with the returned `changeId`.

## Notes

Apifox currently exposes OpenAPI import/export APIs at project or module scope. This server builds minimal OpenAPI documents for single-operation changes, so the AI client can work with one endpoint while Apifox still receives data through its supported OpenAPI import interface.
