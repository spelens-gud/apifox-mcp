import { z } from "zod";
import { jsonResponse, numberToPendingValue, requireApifox, textResponse } from "./tool-helpers.js";
import { createJsonDiff } from "../openapi/diff.js";
import { buildMinimalDocument } from "../openapi/minimal-doc.js";
import { patchRequestBodyField } from "../openapi/patch-schema-field.js";
import { pendingChanges } from "../pending/pending-changes.js";
import type { JsonSchemaObject } from "../openapi/types.js";
import type { RegisterableModule } from "../registry/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const methodSchema = z.enum(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const jsonSchemaSchema = z.object({ type: z.string().min(1) }).passthrough() as z.ZodType<JsonSchemaObject>;
const description = "Preview an Apifox request body schema field change and store it for later apply";

const toolModule: RegisterableModule = {
  type: "tool",
  name: "apifox_preview_request_body_field_change",
  description,
  register(server: McpServer) {
    server.tool(
      "apifox_preview_request_body_field_change",
      description,
      {
        projectId: z.string().optional(),
        path: z.string().min(1),
        method: methodSchema,
        contentType: z.string().min(1).default("application/json"),
        fieldPath: z.string().min(1),
        schema: jsonSchemaSchema,
        required: z.boolean().optional(),
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
        const beforeOperation = structuredClone(document.paths[args.path]?.[args.method]);
        const result = patchRequestBodyField(document, {
          path: args.path,
          method: args.method,
          contentType: args.contentType,
          fieldPath: args.fieldPath,
          schema: args.schema,
          required: args.required,
        });
        const afterOperation = document.paths[args.path]?.[args.method];
        const minimal = buildMinimalDocument(document, args.path, args.method);
        const diff = createJsonDiff(beforeOperation, afterOperation);
        const change = pendingChanges.create({
          projectId: ready.projectId,
          targetBranchId: numberToPendingValue(ready.config.branchId),
          moduleId: numberToPendingValue(ready.config.moduleId),
          summary: `${result.action} request body field ${args.fieldPath} on ${args.method.toUpperCase()} ${args.path}`,
          diff,
          document: minimal,
        });

        return jsonResponse({ changeId: change.changeId, summary: change.summary, diff });
      },
    );
  },
};

export default toolModule;
