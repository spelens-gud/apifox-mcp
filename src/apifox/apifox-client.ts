import type { OpenApiDocument } from "../openapi/types.js";
import type { ExportOpenApiInput, ImportOpenApiInput, ImportOpenApiResult } from "./types.js";

interface ClientOptions {
  apiBaseUrl: string;
  accessToken: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export interface ApifoxClient {
  exportOpenApi(input: ExportOpenApiInput): Promise<OpenApiDocument>;
  importOpenApi(input: ImportOpenApiInput): Promise<ImportOpenApiResult>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Apifox API request failed: ${response.status}${text ? ` ${text}` : ""}`);
  }
  return text.length > 0 ? JSON.parse(text) : {};
}

export function createApifoxClient(options: ClientOptions): ApifoxClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetchImpl(joinUrl(options.apiBaseUrl, path), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      return await parseJsonResponse(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async exportOpenApi(input) {
      const body = {
        scope: input.scope,
        exportFormat: "JSON",
        oasVersion: "3.1",
        ...(input.branchId === undefined ? {} : { branchId: input.branchId }),
        ...(input.moduleId === undefined ? {} : { moduleId: input.moduleId }),
      };

      return (await postJson(`/v1/projects/${input.projectId}/export-openapi`, body)) as OpenApiDocument;
    },

    async importOpenApi(input) {
      const body = {
        input: JSON.stringify(input.document),
        options: {
          endpointOverwriteBehavior: "AUTO_MERGE",
          schemaOverwriteBehavior: "AUTO_MERGE",
          deleteUnmatchedResources: false,
          updateFolderOfChangedEndpoint: false,
          prependBasePath: false,
          ...(input.targetBranchId === undefined ? {} : { targetBranchId: input.targetBranchId }),
          ...(input.moduleId === undefined ? {} : { moduleId: input.moduleId }),
        },
      };

      return (await postJson(`/v1/projects/${input.projectId}/import-openapi`, body)) as ImportOpenApiResult;
    },
  };
}
