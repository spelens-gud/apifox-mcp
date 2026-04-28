import type { OpenApiDocument } from "../openapi/types.js";

export type ExportScope =
  | { type: "ALL"; excludedByTags?: string[] }
  | { type: "SELECTED_ENDPOINTS"; selectedEndpointIds: number[]; excludedByTags?: string[] }
  | { type: "SELECTED_FOLDERS"; selectedFolderIds: number[]; excludedByTags?: string[] };

export interface ExportOpenApiInput {
  projectId: string;
  scope: ExportScope;
  branchId?: number;
  moduleId?: number;
}

export interface ImportOpenApiInput {
  projectId: string;
  document: OpenApiDocument;
  targetBranchId?: number;
  moduleId?: number;
}

export interface ImportOpenApiResult {
  data?: {
    counters?: Record<string, number>;
  };
}
