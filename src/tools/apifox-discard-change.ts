import { z } from "zod";
import { jsonResponse } from "./tool-helpers.js";
import { pendingChanges } from "../pending/pending-changes.js";
import type { RegisterableModule } from "../registry/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const description = "Discard a previously previewed Apifox OpenAPI change";

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_discard_change",
  description,
  register(server: McpServer) {
    server.tool(
      "apifox_discard_change",
      description,
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
