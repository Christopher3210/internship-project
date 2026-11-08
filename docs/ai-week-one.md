# AI 第一周：实现与验证

## 本次补齐

- JWT 校验后检查用户仍存在且处于 Active 状态；用户管理的查询、创建、修改和删除要求 Admin 权限。注册只能创建 Member。
- 会话、偏好、任务仅所属账号可读写，管理员不能读取他人的私人对话或偏好。管理员审计查询支持按用户过滤；普通用户只能查看自己的审计。
- 部署端 `AI_TENANT_ID` / `AI_USER_TENANTS` 提供用户到租户的可信映射；客户端和模型不能选择租户。管理员审计、用户管理和 Agent 用户查询也受该边界约束。当前本地为单租户 `local`；这不是租户注册/组织管理产品。不要在已有历史数据后随意重分配账号租户。审计表新增 `tenant_id` 保存原租户，用户删除后管理员仍能查看本租户的审计；不修改原有业务表。
- 只读工具结果缓存：同用户、同工具和规范化参数命中缓存，默认 600 秒。权限检查始终先于缓存读取。记忆写入、任务创建、进度修改等副作用不缓存。
- Company/User Service 成功写入后改变缓存版本并清理对应业务缓存，避免正在执行的旧查询回填后被重新命中。配置修改需要重启服务。
- 关闭聊天调用 `POST /ai-agent/sessions/:id/close` 清理短期上下文；再次打开从 PostgreSQL 恢复。数据库历史和任务不会因 10 分钟缓存过期而消失。
- 自动任务的进度由执行阶段控制；REST 接口同样禁止手动覆盖。手动任务必须满足状态与进度一致，已结束任务不可改回运行状态。
- 聊天异步选择版本隔离：A 的回复不会改变 B 的选择；各会话草稿分开保存；失败回复不把 A 输入塞入 B。

## Redis 与 LangGraph

| 前缀 | 用途 | 生命周期 |
| --- | --- | --- |
| `ai:session:` | 最近 10 轮对话 | 2 小时；关闭时清理；PG 兜底 |
| `ai:chat_cache:` | 按用户隔离的业务查询结果与失效版本 | 结果默认 10 分钟；业务更新主动失效 |
| `ai:llm_cache:` | 模型调用缓存预留 | 按要求暂不实现 |
| `ai:task_state:` | 任务临时进度与 Checkpoint | 默认 24 小时；不删除 PG 任务 |

`AiCheckpointerFactory.forUser(authenticatedUser.id)` 返回 `AiRedisCheckpointer`，继承官方 `BaseCheckpointSaver`，实现 `getTuple`、`list`、`put`、`putWrites`、`deleteThread`；支持命名空间、父检查点、元数据过滤、排序、正常写幂等、TTL 和用户隔离。使用官方序列化器处理状态；当前支持检查点格式 v4 及以上。所有 Redis 操作仍统一经过 `AiRedisService`。Checkpoint 不是可随意忽略的查询缓存，Redis 故障时会明确失败。

参考：[LangGraph Checkpointer 官方接口](https://reference.langchain.com/javascript/langchain-langgraph-checkpoint)。这是后续接入 LangGraph 的存储接口准备，**不表示当前任务调度已经换成完整 LangGraph 工作流**。

示例配置已加入 `bknd/.env.example`，不包含真实密钥：

```dotenv
AI_CHAT_CACHE_ENABLED=true
AI_CHAT_CACHE_TTL_SECONDS=600
AI_CACHE_COMPANIES_ENABLED=true
AI_CACHE_COMPANIES_TTL_SECONDS=600
AI_CACHE_USERS_ENABLED=true
AI_CACHE_USERS_TTL_SECONDS=600
AI_TASK_STATE_TTL_SECONDS=86400
AI_TENANT_ID=local
AI_USER_TENANTS={}
```

## 验证命令

```powershell
cd bknd
npm test
npm run build
# 需要本地 PostgreSQL、Redis、后端已启动；只产生可清理的临时数据，不调用付费模型。
node --env-file=.env scripts/verify-ai-foundation.mjs
cd ../ftnd
npm test
npm run build
```

2026-11-08 本轮验证结果：后端 49 项自动化测试、真实数据库与 Redis 的 12 项接口检查、前端 3 项延迟回复回归测试全部通过，前后端生产构建通过。临时账号和公司按生成的 ID 清理，不删除原有业务数据。前端升级至 Next.js 16.4.5，前后端 `npm audit --omit=dev` 均为 0 项告警；开发工具依赖仍有告警，未执行可能破坏兼容性的强制升级。

用户管理增加鉴权后，上周无 Token 的 Postman 用户 CRUD 集合需要补上管理员 Bearer Token，未登录应返回 401、普通成员应返回 403。这是权限收紧，不是接口失效。

## 能力边界

- 既有公司查询、统计、图表、长期偏好、会话历史、公司搜索/资料摘要任务仍保留。
- 全库统计“直接转成一个新的报表任务”不是本周基础要求，目前没有通用报表任务执行器。
- 短任务仍是进程内执行；生产级可靠队列、进程重启恢复、完整 LangGraph 编排不属于本周预留接口任务。
- 查询结果缓存不会节省每一次模型请求；它节省业务查询，避免重放副作用。未额外启用付费模型来验证。
- 自动化检查覆盖已列出的场景，不等于承诺网站绝无未知问题，也不是生产部署安全认证。
