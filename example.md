## 案例 1：给某个接口新增 query 入参

需求：

给 Apifox 中 GET /users 接口新增 query 参数 pageSize，类型 integer，默认值 20，说明是“每页数量”。

第一步，搜索接口：

{
  "path": "/users",
  "method": "get"
}
调用工具：

apifox_search_endpoints
返回可能类似：

[
  {
    "path": "/users",
    "method": "get",
    "summary": "用户列表",
    "operationId": "listUsers",
    "tags": ["user"]
  }
]
第二步，预览新增参数：

{
  "path": "/users",
  "method": "get",
  "location": "query",
  "name": "pageSize",
  "required": false,
  "description": "每页数量",
  "schema": {
    "type": "integer",
    "default": 20,
    "minimum": 1,
    "maximum": 100
  }
}
调用工具：

apifox_preview_request_param_change
返回：

{
  "changeId": "0f3f7d9e-xxxx-xxxx-xxxx",
  "summary": "added query parameter pageSize on GET /users",
  "diff": "--- before\n+++ after\n..."
}
第三步，看 diff。确认没问题后应用：

{
  "changeId": "0f3f7d9e-xxxx-xxxx-xxxx"
}
调用工具：

apifox_apply_change
如果不想应用：

{
  "changeId": "0f3f7d9e-xxxx-xxxx-xxxx"
}
调用：

apifox_discard_change
## 案例 2：给请求体增加字段

需求：

给 POST /users 的 JSON 请求体增加字段 profile.nickname，类型 string，说明“用户昵称”，非必填。

先查接口：

{
  "path": "/users",
  "method": "post"
}
调用：

apifox_get_endpoint
如果确认 request body 是 application/json，预览修改：

{
  "path": "/users",
  "method": "post",
  "contentType": "application/json",
  "fieldPath": "profile.nickname",
  "required": false,
  "schema": {
    "type": "string",
    "description": "用户昵称",
    "maxLength": 50
  }
}
调用：

apifox_preview_request_body_field_change
返回 changeId 和 diff 后，确认应用：

{
  "changeId": "返回的 changeId"
}
调用：

apifox_apply_change
这个工具会生成一个只包含目标接口和相关 schema refs 的最小 OpenAPI 文档，再通过 Apifox 的 import-openapi 写回。

## 案例 3：给响应体增加字段

需求：

给 GET /users/{userId} 的 200 响应增加字段 profile.avatarUrl，类型 string，格式 uri。

预览：

{
  "path": "/users/{userId}",
  "method": "get",
  "status": "200",
  "contentType": "application/json",
  "fieldPath": "profile.avatarUrl",
  "required": false,
  "schema": {
    "type": "string",
    "format": "uri",
    "description": "头像 URL"
  }
}
调用：

apifox_preview_response_field_change
确认 diff 后应用：

{
  "changeId": "返回的 changeId"
}
调用：

apifox_apply_change
## 案例 4：把已有字段改成必填

需求：

把 POST /orders 请求体里的 buyerPhone 改成必填，并补充描述。

{
  "path": "/orders",
  "method": "post",
  "contentType": "application/json",
  "fieldPath": "buyerPhone",
  "required": true,
  "schema": {
    "type": "string",
    "description": "购买人手机号",
    "pattern": "^1[3-9]\\d{9}$"
  }
}
调用：

apifox_preview_request_body_field_change
确认后：

{
  "changeId": "返回的 changeId"
}
调用：

apifox_apply_change
## 案例 5：把已有字段改成非必填

需求：

把 POST /orders 请求体里的 remark 改成非必填。

{
  "path": "/orders",
  "method": "post",
  "contentType": "application/json",
  "fieldPath": "remark",
  "required": false,
  "schema": {
    "type": "string",
    "description": "订单备注"
  }
}
调用：

apifox_preview_request_body_field_change
这个会从 schema 的 required 数组里移除 remark，然后返回 diff。确认后再 apply。

## 案例 6：只查看接口，不修改

搜索：

{
  "keyword": "登录"
}
调用：

apifox_search_endpoints
查看某个接口：

{
  "path": "/auth/login",
  "method": "post"
}
调用：

apifox_get_endpoint
如果你只传 path，不传 method：

{
  "path": "/auth/login"
}
会返回可用 method，用来避免误改接口。

## 案例 7：直接导出 OpenAPI

导出整个项目：

{
  "scope": {
    "type": "ALL"
  }
}
调用：

apifox_export_openapi
导出指定目录/模块时，建议优先用环境变量 APIFOX_MODULE_ID 限定模块；如果要显式 scope，也支持：

{
  "scope": {
    "type": "SELECTED_FOLDERS",
    "selectedFolderIds": [12345]
  }
}
在 AI 客户端里可以这样说

你不一定要手写 JSON，可以直接对支持 MCP 的 AI 客户端说：

帮我在 Apifox 里找到 GET /users 接口，并给它增加 query 参数 pageSize，integer 类型，默认值 20，非必填。先预览 diff，不要直接应用。
然后 AI 应该调用：

apifox_search_endpoints
apifox_preview_request_param_change
等你确认后再说：

确认，应用刚才的 changeId。
它才会调用：

apifox_apply_change
关键安全点

这个 MCP 是 preview-first：

搜索、读取、导出会直接执行。
修改类工具只生成 changeId 和 diff，不会写 Apifox。
只有 apifox_apply_change 会真正写入 Apifox。
apply 失败时 pending change 不会丢，可以重试。
不想应用可以 apifox_discard_change