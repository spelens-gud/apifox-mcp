import type { OpenApiDocument } from "../openapi/types.js";

export type ExportScope =
  | { type: "ALL"; excludedByTags?: Array<string> }
  | { type: "SELECTED_ENDPOINTS"; selectedEndpointIds: Array<number>; excludedByTags?: Array<string> }
  | { type: "SELECTED_FOLDERS"; selectedFolderIds: Array<number>; excludedByTags?: Array<string> };

export type ExportOpenApiInput = {
  projectId: string;
  scope: ExportScope;
  branchId?: number;
  moduleId?: number;
}

export type ImportOpenApiInput = {
  projectId: string;
  document: OpenApiDocument;
  targetBranchId?: number;
  moduleId?: number;
}

export type ImportOpenApiResult = {
  data?: {
    counters?: Record<string, number>;
  };
}
