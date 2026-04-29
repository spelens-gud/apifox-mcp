import { z } from "zod";
import { jsonResponse, requireApifox, textResponse } from "./tool-helpers.js";
import { findOperation, listMethodsForPath } from "../openapi/search.js";
import type { RegisterableModule } from "../registry/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const methodSchema = z.enum(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const description = "Read one Apifox OpenAPI endpoint operation by path and method";

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_get_endpoint",
  description,
  register(server: McpServer) {
    server.tool(
      "apifox_get_endpoint",
      description,
      {
        projectId: z.string().optional(),
        path: z.string().min(1),
        method: methodSchema.optional(),
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
        const methods = listMethodsForPath(document, args.path);

        if (args.method === undefined) {
          return jsonResponse({ clarificationRequired: true, availableMethods: methods });
        }

        const operation = findOperation(document, args.path, args.method);
        return operation === undefined
          ? jsonResponse({ found: false, availableMethods: methods })
          : jsonResponse(operation);
      },
    );
  },
};

export default toolModule;
