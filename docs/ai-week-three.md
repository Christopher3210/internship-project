# 核心 AI 第三周：实施与验收方案

## 范围

1. 验证用户查询、公司查询、统计三类工具：返回值与业务 Service 一致、鉴权、审计脱敏、缓存命中与失效、耗时。
2. 新增物理隔离的 BaseWriteTool，以及用户新增/修改/单删/批删、公司新增/修改/删除七个骨架。
3. 统一预校验：服务端身份权限 → 原业务 DTO → 业务 Service 校验 → 脱敏预览。任一环节失败终止。
4. 写入默认禁止自动执行。注册中心统一拦截；模型定义不暴露写入执行。预览通过不代表已执行。

## 实施顺序

- 提取业务 Service 无副作用校验，普通 API 同样复用，避免两套业务规则。
- 实现写入基类、预校验服务、七个工具、注册和 JWT 保护的预览入口。
- 保持 execute/rollback 默认关闭；本周不增加确认后真实执行或伪造成功的回滚。
- 增加自动化测试，复查缓存、脱敏和三类读取链路；执行构建及可用环境下的集成验证。

## 验收条件

- 非管理员不能预览业务写入；用户目标受服务端租户约束。
- 错误 DTO、重复邮箱/公司代码、不存在对象均返回业务异常；预览不改变数据库。
- 即使设置 enabled 或直接调用 execute，也无法绕过禁止写入策略。
- 密码、令牌、邮箱等敏感内容不进入预览/审计明文。
- 三类只读工具依然可用；缓存命中也保留权限检查和审计。

## 边界

真实写入授权、确认令牌、防重放、事务与补偿回滚属于后续开发；不得把本周骨架描述成已可执行批量删除。测试不调用付费模型，不删除现有业务数据。

## 实现结果（2026-11-15）

- `write-tools/` 与原只读工具目录隔离。BaseWriteTool 定义 validate/getPreview/execute/rollback 合约；统一 execute 返回 403、rollback 返回 501，不会伪造成功。
- 注册中心现有 19 个工具：原 12 个 + 7 个写入骨架。写入工具标记 `kind=write`、`automaticExecution=false`；模型工具定义中排除它们。即使开启注册开关，也不能绕过执行拦截。
- 统一预校验执行服务端权限、原业务 DTO 和 UsersService/CompaniesService 的无副作用业务规则。预览中的密码、邮箱、财务等敏感字段脱敏；业务异常保留原 Nest HTTP 错误结构。
- 审计增加操作类型、耗时；成功、失败、权限拒绝、缓存命中和预览都有工具审计。加强普通字符串中 API key/JWT/Bearer 格式的脱敏。
- 查询结果新增 `cacheHit` 标记，便于直接验证缓存；权限检查仍在缓存读取之前。
- 修复 Mock 公司查询忽略日本/美国条件及单独 `dashboard metrics` 未触发工具的问题。Mock 是有限关键词模式，不承诺任意自然语言理解。
- AI 业务工具只依赖业务 Service，未新增直接修改业务表的 SQL，也未变更业务数据库结构。身份权限检查读取用户实体；AI 自有四表仍由 AI 模块持久化。

## 新增接口与验收方法

所有接口需要登录 Bearer Token；不得在录屏或聊天中展示 Token。

| 接口 | 用途 |
| --- | --- |
| `GET /ai-agent/tools/write-capabilities` | 查看 7 个骨架、参数合约及禁止自动执行标志；只返回元数据 |
| `POST /ai-agent/tools/:name/preview` | 管理员预校验并生成脱敏预览；不执行写入 |
| `POST /ai-agent/tools/:name/query` | 三个核心只读工具的单链路检查；用户查询需要管理员 |

请求统一包装为 `{"input": {...}}`。写入预览成功为 HTTP 200，包含 `executed:false` 和 `executionEnabled:false`。普通成员写入预览返回 403；参数错误 400、业务冲突 409、对象不存在 404。预览不是承诺稍后一定能执行：后续真正执行时仍需重新校验及事务控制。

工具名与 input 示例（用你有权限访问的真实 ID/代码替换占位值）：

| 工具 | input |
| --- | --- |
| `userCreateTool` | `{"name":"Demo","email":"demo@example.test","password":"demo-only-password","role":"Member","status":"Active"}` |
| `userUpdateTool` | `{"id":"用户UUID","changes":{"name":"Demo updated"}}` |
| `userDeleteTool` | `{"id":"用户UUID"}` |
| `userBatchDeleteTool` | `{"ids":["用户UUID"]}` |
| `companyCreateTool` | `{"companyCode":"PREVIEW_ONLY","companyName":"Preview only","level":2,"country":"Japan","city":"Tokyo","foundedYear":2000,"annualRevenue":100,"employees":2}` |
| `companyUpdateTool` | `{"companyCode":"已有公司代码","changes":{"level":3}}` |
| `companyDeleteTool` | `{"companyCode":"已有公司代码"}` |

只读工具名为 `search_users`、`search_companies_table`、`get_dashboard_metrics`。例如公司查询请求 `{"input":{"country":"Japan","levels":[2],"page":1,"pageSize":20}}`。聊天选择 Local demo 后，可分别发送 `search users`、`查询日本 Level 2 的公司`、`dashboard metrics`；普通用户的用户查询应被拒绝。

## 验证证据

| 验证 | 结果 |
| --- | --- |
| 后端自动化测试 | 14 个文件，81 项通过 |
| 前端自动化测试 | 2 个文件，8 项通过；涵盖会话竞态、用户/公司表格、详情、翻页、统计容器和权限错误 |
| 本周真实 PG/Redis/HTTP 验证 | 11 组检查通过，三类查询与业务 API 一致，七种预览无业务写入 |
| 既有基础集成回归 | 12 组通过，覆盖会话/记忆/任务/审计权限、恢复、缓存失效和 Checkpointer |
| 前后端生产构建 | 均通过 |
| 数据清理 | 仅移除本轮生成的临时账号、公司及关联测试数据；原有数据保留 |

前端这里是 React/jsdom 自动化验证，图表绘图库被替身替换以检查传递和展示位置；HTTP 聊天链路使用 Mock，不是付费 OpenAI 端到端验收。本轮未重新进行真实浏览器录屏/视觉验收，也没有消耗模型余额。录制前仍应在当前浏览器查看真实表格与图表布局。

最后一轮本地工具接口测量（一次冷查询 + 五次缓存查询；不是压力测试，不含模型耗时）：

| 工具 | 冷查询 | 命中缓存 p50 | 命中缓存最大值 |
| --- | --- | --- | --- |
| 用户查询 | 11.70 ms | 9.45 ms | 10.03 ms |
| 公司查询 | 10.45 ms | 8.03 ms | 9.07 ms |
| 综合统计 | 17.44 ms | 8.88 ms | 9.11 ms |

缓存测试不仅比较速度，还断言 `cacheHit`，并验证命中时不执行业务查询、权限不能绕过、业务更新主动失效。真实过期测试仅将本轮临时账号的查询缓存缩短为 1 秒，生产默认 10 分钟配置未变。完整聊天速度仍受模型网络和生成耗时影响，不应宣称每次聊天都会快一倍。

## 重跑步骤

保持 PostgreSQL、Redis、后端运行；不要同时在后端 watch 编译期间另跑清理 dist 的 build，否则可能暂时出现模块缺失。先停止自己的开发进程、构建完成再启动。

```powershell
cd C:\Users\admin\internship-project\bknd
npm.cmd test
npm.cmd run build
# 在另一终端启动 node dist/main.js 后，再运行以下验证：
node --env-file=.env scripts/verify-ai-week-three.mjs
node --env-file=.env scripts/verify-ai-foundation.mjs
cd ..\ftnd
npm.cmd test
npm.cmd run build
```

## 当前结论

本周写入骨架及自动化联调实现已完成；没有开放 AI 实际修改/删除业务数据。自动化通过不等于零未知 bug，也不代表已完成真实模型的所有话术测试。真实写入确认流程不在本周骨架交付范围内。
