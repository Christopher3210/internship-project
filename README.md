# Internship Supply Chain Admin

## Current progress

This iteration delivers the User and Company management modules:

- Authentication pages and dashboard navigation.
- User table: name search, Title/Role multi-select filter, create, edit, single deletion, and batch deletion.
- Company table: company-name search, Level multi-select filter, server-side pagination, profitability-efficiency display, and expandable company details.
- NestJS RESTful CRUD APIs for users and companies, documented with Swagger at `http://localhost:3001/api`.
- PostgreSQL `users`, `companies`, and `relationships` tables. The Company module imports the supplied CSV data (2,000 company and relationship records) on startup when needed.

## Demo startup order

Open three terminals and start services in this order:

```powershell
# 1. Database containers
docker start internship-postgres internship-redis

# 2. NestJS backend
cd bknd
npm run start:dev

# 3. Next.js frontend (new terminal)
cd ftnd
npm run dev
```

Open `http://localhost:3000/company` to demonstrate the Company module, or `http://localhost:3001/api` to inspect and test APIs.

一个用于熟悉 Node.js 全栈开发流程的供应链管理后台基础项目。当前迭代围绕用户管理与公司信息检索展开；页面和接口范围会随每周任务调整。

## 当前完成内容

- 邮箱与密码注册、登录，以及前后端输入校验
- 密码哈希存储、JWT 登录令牌生成
- Swagger API 文档与接口调试页面
- Dashboard、Company、Order、User 后台导航壳
- PostgreSQL 用户表映射与 TypeORM 数据访问
- User：按姓名键入搜索、新增用户、勾选多选和批量删除
- Company：按公司名键入搜索、按 Level 1–4 多选筛选
- Company CRUD API；字段参考提供的 `companies_0708.csv` 与 `relationships_0708.csv`

## 技术架构

```text
Next.js + React + Material UI (http://localhost:3000)
                  |
                  | HTTP / JSON
                  v
NestJS REST API (http://localhost:3001)
                  |
                  v
PostgreSQL + TypeORM
```

### Frontend (`ftnd`)

- Next.js、React、TypeScript
- Material UI
- 登录/注册表单状态、前端校验与 API 调用

### Backend (`bknd`)

- NestJS、TypeScript、RESTful API
- PostgreSQL、TypeORM、`pg`
- `class-validator`、bcrypt、JWT
- Swagger / OpenAPI、CORS

## 本地启动

### 1. 准备 PostgreSQL

创建一个 PostgreSQL 数据库，并按下方配置后端环境变量。可复制示例文件：

```powershell
Copy-Item bknd/.env.example bknd/.env
```

编辑 `bknd/.env`，填写本地数据库账号、密码和 JWT 密钥。`bknd/.env` 不会提交到仓库。

### 2. 启动后端

```powershell
cd bknd
npm install
npm run start:dev
```

后端默认运行在 `http://localhost:3001`，Swagger 文档在 `http://localhost:3001/api`。

### 3. 启动前端

新开一个终端：

```powershell
cd ftnd
npm install
npm run dev
```

打开 `http://localhost:3000`，可访问登录与注册页面。

## API 概览

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/users/sign-up` | 注册用户 |
| `POST` | `/users/login` | 登录并获取 JWT access token |
| `GET` | `/users?name=Alice` | 按姓名查询用户 |
| `POST` | `/users` | 新增用户 |
| `PATCH` | `/users/:id` | 修改用户 |
| `DELETE` | `/users` | 按 ID 数组批量删除用户 |
| `GET` | `/companies?name=Doyle&levels=1,2&page=1&pageSize=20` | 按公司名、Level 筛选并分页查询公司 |
| `POST` | `/companies` | 新增公司 |
| `PATCH` | `/companies/:companyCode` | 修改公司 |
| `DELETE` | `/companies/:companyCode` | 删除公司 |

请求示例：

```json
{
  "email": "name@example.com",
  "password": "password123"
}
```

## 项目目录

```text
.
├── ftnd/                 # Next.js 前端
│   └── src/
│       ├── app/          # 页面路由
│       └── components/   # 可复用 UI 组件
└── bknd/                 # NestJS 后端
    └── src/
        └── users/        # 用户实体、DTO、Controller、Service
```

## 后续计划

后续功能将根据每周任务安排调整和实现。

## AI agent interaction module (current iteration)

- Global chat drawer with saved multi-turn sessions, provider selection, file attachments, and basic Markdown rendering.
- Agent Tasks page at `/agent-tasks` currently uses sample rows for the task-progress UI.
- NestJS endpoints: `GET /ai-agent/providers`, `GET/POST /ai-agent/sessions`, `GET /ai-agent/sessions/:id`, and `POST /ai-agent/sessions/:id/messages`.
- Chat sessions are persisted in PostgreSQL table `ai_chat_sessions` (TypeORM creates it in development).
- `AI_PROVIDER=mock` enables local demo replies without an API key. DeepSeek, Qwen, OpenAI, Kimi, and an OpenAI-compatible local endpoint can be configured in `bknd/.env`; keys must remain local and must not be committed.
- Text attachments supported for TXT, MD, CSV, JSON, TSV, and LOG files up to 100 KB of text. Other files are recorded as attachments only; no image/PDF understanding is implemented.

After starting the backend and frontend, open the dashboard and use the floating sparkle button to open chat. Visit `/agent-tasks` to see the sample task progress table. Configure provider keys in `bknd/.env` to use a real model; the default mock provider is intended for a safe local demo.

## AI backend persistence, access control, and cache

- AI tables: existing `ai_chat_sessions` plus `ai_user_memory`, `ai_task_record`, and `ai_operation_audit`. Each record is associated with `users`; session ownership is nullable only for legacy rows, while new API-created records always have an owner.
- All `/ai-agent` routes require `Authorization: Bearer <accessToken>`. Sign in at `/login` to save a token for the chat UI. Ordinary users see only their own records; admins can filter records by `userId` and view all audit records.
- Sessions, memories, and tasks expose paginated CRUD endpoints. Audits can be appended and queried by owner/admin; only admins may correct or delete an audit, and those changes create a follow-up audit record.
- Redis is configured with `REDIS_URL` (default `redis://localhost:6379`). Keys use `ai:session:<userId>:<sessionId>` (2 hours), `ai:chat_cache:<userId>:<promptHash>` (10 minutes), and `ai:task_state:<userId>:<taskId>` (24 hours or an earlier task expiry). `ai:llm_cache` is reserved and not implemented yet. PostgreSQL remains the source of truth; AI APIs continue if Redis is unavailable.
- Main routes: `/ai-agent/sessions`, `/ai-agent/memory`, `/ai-agent/tasks`, and `/ai-agent/audits`. Full request/response schemas are available in Swagger at `/api`.
