# Apifox OpenAPI Patch MCP

本项目基于`@modelcontextprotocol/sdk`和使用 `upstream TypeScript MCP template` 作为mcp模板构建.

这个 MCP 服务器让 AI 客户端可以搜索 Apifox OpenAPI 文档、预览精确的请求/响应变更，并通过 Apifox OpenAPI 导入应用已批准的修改。

## 安全模型

读取类工具会立即执行。写入类工具只会生成预览和一个 `changeId`。只有 `apifox_apply_change` 会真正写回 Apifox。

应用流程会导入一个最小化 OpenAPI 文档，其中包含目标操作及其引用的 schema。导入使用 Apifox 的自动合并行为，不会删除未匹配的资源。

## 工具

- `apifox_search_endpoints`：按路径、方法或关键词搜索接口。
- `apifox_get_endpoint`：按路径和方法读取单个接口操作。
- `apifox_export_openapi`：按指定的 Apifox 范围导出 OpenAPI。
- `apifox_preview_request_param_change`：预览新增或更新请求参数。
- `apifox_preview_request_body_field_change`：预览新增或更新请求体 schema 字段。
- `apifox_preview_response_field_change`：预览新增或更新响应 schema 字段。
- `apifox_apply_change`：应用之前预览过的待处理变更。
- `apifox_discard_change`：丢弃待处理变更。

## 必需环境变量

- `APIFOX_ACCESS_TOKEN`
- `APIFOX_PROJECT_ID`

可选：

- `APIFOX_API_BASE_URL`，默认值为 `https://api.apifox.com`
- `APIFOX_BRANCH_ID`
- `APIFOX_MODULE_ID`
- `APIFOX_TIMEOUT_MS`，默认值为 `15000`
- `APIFOX_MCP_TRANSPORT`，可选 `stdio` 或 `http`，默认值为 `stdio`
- `APIFOX_MCP_HOST`，用于 HTTP 传输，默认值为 `127.0.0.1`
- `APIFOX_MCP_HTTP_BEARER_TOKEN`，为 HTTP 传输启用 Bearer Token 认证
- `CORS_ORIGIN`，用于 HTTP 传输，默认值为本地服务 origin
- `PORT`，用于 HTTP 传输，默认值为 `3000`

## 本地命令

```bash
npm install
npm run build
npm run serve:stdio
```

HTTP 传输：

```bash
APIFOX_MCP_TRANSPORT=http PORT=3000 npm run serve:http
```

HTTP 模式默认绑定到 `127.0.0.1`。如果你需要不同的绑定地址，请显式设置 `APIFOX_MCP_HOST`；如果要将 HTTP 模式暴露到本地开发环境之外，请先设置 `APIFOX_MCP_HTTP_BEARER_TOKEN`。

开发检查：

```bash
npm run typecheck
npm run lint
npm test
```

## MCP 客户端配置

使用 stdio 配置前先构建：

```bash
npm run build
```

示例：

```json
{
  "mcpServers": {
    "Apifox": {
      "command": "node",
      "args": ["/Users/hqy/Data/project/ai/apifox-mcp/build"],
      "env": {
        "APIFOX_ACCESS_TOKEN": "afxp_a28f64jkKu8rRsQDMzgmmylN03IuqUexpk0A",
        "APIFOX_PROJECT_ID": "70447137",
        "APIFOX_MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## 示例流程

1. 调用 `apifox_search_endpoints`，找到路径和方法。
2. 调用 `apifox_preview_request_param_change`、`apifox_preview_request_body_field_change` 或 `apifox_preview_response_field_change`。
3. 查看返回的 `diff`。
4. 使用返回的 `changeId` 调用 `apifox_apply_change`。

## 说明

Apifox 当前在项目或模块范围提供 OpenAPI 导入/导出 API。这个服务器会为单个操作变更构建最小化 OpenAPI 文档，使 AI 客户端可以按单接口工作，同时 Apifox 仍通过其支持的 OpenAPI 导入接口接收数据。
