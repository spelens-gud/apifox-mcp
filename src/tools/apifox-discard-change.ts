import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pendingChanges } from "../pending/pending-changes.js";
import type { RegisterableModule } from "../registry/types.js";
import { jsonResponse } from "./tool-helpers.js";

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_discard_change",
  description: "Discard a previously previewed Apifox OpenAPI change",
  register(server: McpServer) {
    server.tool(
      "apifox_discard_change",
      this.description!,
      {
        changeId: z.string().min(1),
      },
      (args) => {
        const discarded = pendingChanges.discard(args.changeId);
        return jsonResponse({ discarded });
      },
    );
  },
};

export default toolModule;
