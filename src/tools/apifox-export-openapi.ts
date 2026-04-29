import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_export_openapi",
  description: "Export OpenAPI from Apifox with an explicit scope",
  register(server: McpServer) {
    server.tool(
      "apifox_export_openapi",
      this.description!,
      {
        projectId: z.string().optional(),
        scope: scopeSchema.default({ type: "ALL" }),
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
          scope: args.scope,
        });

        return jsonResponse(document);
      },
    );
  },
};

export default toolModule;
