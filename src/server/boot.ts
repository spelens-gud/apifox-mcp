import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import { config } from "dotenv";
import express, { type Request, type Response } from "express";
import { autoRegisterModules } from "../registry/auto-loader.js";

type TransportMode = "stdio" | "http";

// Load environment variables from .env file
config();

export async function boot(
  mode?: TransportMode
): Promise<void> {
  const transportMode = mode ?? (process.env.APIFOX_MCP_TRANSPORT as TransportMode | undefined) ?? "stdio";
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.APIFOX_MCP_HOST ?? "127.0.0.1";
  const corsOrigin = process.env.CORS_ORIGIN ?? `http://${host}:${String(port)}`;
  const bearerToken = process.env.APIFOX_MCP_HTTP_BEARER_TOKEN;
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

  await autoRegisterModules(server);

  if (transportMode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Apifox OpenAPI Patch MCP running on stdio");
    return;
  }

  // HTTP mode with SSE support
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.use(cors({ 
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "mcp-session-id",
      "mcp-protocol-version",
      "x-mcp-session",
      "x-mcp-session-id",
    ],
    exposedHeaders: ["mcp-session-id", "x-mcp-session-id"]
  }));

  if (bearerToken !== undefined && bearerToken.trim() !== "") {
    app.use((req: Request, res: Response, next) => {
      if (req.headers.authorization !== `Bearer ${bearerToken}`) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      next();
    });
  }

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // Create transport with session support
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });

  await server.connect(transport);

  // Handle all MCP requests (GET for SSE, POST for JSON-RPC, DELETE for cleanup)
  app.all("/mcp", (req: Request, res: Response) => {
    void transport.handleRequest(req, res, req.body);
  });

  const httpServer = app.listen(port, host, () => {
    console.log(`Apifox OpenAPI Patch MCP (HTTP) listening on http://${host}:${String(port)}/mcp`);
    console.log(`SSE endpoint: GET http://${host}:${String(port)}/mcp`);
    console.log(`JSON-RPC endpoint: POST http://${host}:${String(port)}/mcp`);
    console.log(`CORS origin: ${corsOrigin}`);
    console.log(`HTTP bearer auth: ${bearerToken === undefined || bearerToken.trim() === "" ? "disabled" : "enabled"}`);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down HTTP server...");
    void transport.close();
    httpServer.close(() => {
      process.exit(0);
    });
  });
}
