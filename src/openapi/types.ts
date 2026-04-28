export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "trace";

export interface JsonSchemaObject {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  $ref?: string;
  additionalProperties?: boolean | JsonSchemaObject;
  [key: string]: unknown;
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: JsonSchemaObject;
  [key: string]: unknown;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: JsonSchemaObject }>;
    required?: boolean;
    [key: string]: unknown;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: JsonSchemaObject }>;
      [key: string]: unknown;
    }
  >;
  [key: string]: unknown;
}

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  info: { title?: string; version?: string; [key: string]: unknown };
  paths: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
  components?: {
    schemas?: Record<string, JsonSchemaObject>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const HTTP_METHODS: readonly HttpMethod[] = ["get", "post", "put", "patch", "delete", "head", "options", "trace"] as const;
