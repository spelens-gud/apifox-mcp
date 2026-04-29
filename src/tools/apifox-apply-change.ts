import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pendingChanges } from "../pending/pending-changes.js";
import type { RegisterableModule } from "../registry/types.js";
import { jsonResponse, pendingValueToNumber, requireApifox, textResponse } from "./tool-helpers.js";

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_apply_change",
  description: "Apply a previously previewed Apifox OpenAPI change",
  register(server: McpServer) {
    server.tool(
      "apifox_apply_change",
      this.description!,
      {
        projectId: z.string().optional(),
        changeId: z.string().min(1),
      },
      async (args) => {
        const ready = requireApifox(args.projectId);
        if ("error" in ready) {
          return textResponse(ready.error);
        }

        const change = pendingChanges.get(args.changeId);
        if (change === undefined) {
          return jsonResponse({ applied: false, error: "Pending change not found. Run preview again." });
        }

        const result = await ready.client.importOpenApi({
          projectId: change.projectId,
          targetBranchId: pendingValueToNumber(change.targetBranchId),
          moduleId: pendingValueToNumber(change.moduleId),
          document: change.document,
        });
        pendingChanges.discard(args.changeId);

        return jsonResponse({ applied: true, summary: change.summary, result });
      },
    );
  },
};

export default toolModule;
