import type { OpenApiDocument } from "../../src/openapi/types.ts";

export const petstoreOpenApi: OpenApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Petstore",
    version: "1.0.0",
  },
  paths: {
    "/pets": {
      get: {
        summary: "List pets",
        operationId: "listPets",
        tags: ["pet"],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
            },
          },
        ],
        responses: {
          "200": {
            description: "A paged array of pets",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Pet",
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create pet",
        operationId: "createPet",
        tags: ["pet"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/Pet",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created pet",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Pet",
                },
              },
            },
          },
        },
      },
    },
    "/users/{userId}": {
      get: {
        summary: "Get user",
        operationId: "getUser",
        tags: ["user"],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "A user",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/User",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
      },
      User: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "string",
          },
          name: {
            type: "string",
          },
        },
      },
    },
  },
};
