# Apifox OpenAPI Patch MCP

MCP server for safe Apifox OpenAPI patch previews and apply flows.

This repository currently contains the normalized TypeScript MCP baseline. Business tools, resources, prompts, and complete usage documentation will be added in later implementation tasks.

## Requirements

- Node.js 20.11.0 or newer
- npm

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

The build script clears `build/` before compiling so removed modules cannot be auto-registered from stale output.

## Run

Stdio transport:

```bash
npm run serve:stdio
```

HTTP transport:

```bash
npm run serve:http
```

The server reads `APIFOX_MCP_TRANSPORT` with supported values `stdio` and `http`. HTTP mode listens on `PORT`, defaulting to `3000`.

## Development

```bash
npm run typecheck
npm test
npm run lint
```

The Task 1 baseline intentionally has no business MCP modules yet.
