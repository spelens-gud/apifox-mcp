import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RegisterableModule } from "../registry/types.js";
import { searchEndpoints } from "../openapi/search.js";
import { jsonResponse, requireApifox, textResponse } from "./tool-helpers.js";

const methodSchema = z.enum(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_search_endpoints",
  description: "Search Apifox OpenAPI endpoints by path, method, or keyword",
  register(server: McpServer) {
    server.tool(
      "apifox_search_endpoints",
      this.description!,
      {
        projectId: z.string().optional(),
        path: z.string().optional(),
        method: methodSchema.optional(),
        keyword: z.string().optional(),
      },
      async (args) => {
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
      },
    );
  },
};

export default toolModule;
