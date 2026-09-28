# Internship Supply Chain Admin

一个用于熟悉 Node.js 全栈开发流程的供应链管理后台基础项目。项目当前完成了用户注册与登录，以及 Company、Order、User、Dashboard 的基础导航页面；后续将逐步补充公司信息、订单追踪、数据分析与 Agent 能力。

## 当前完成内容

- 邮箱与密码注册、登录，以及前后端输入校验
- 密码哈希存储、JWT 登录令牌生成
- Swagger API 文档与接口调试页面
- Dashboard、Company、Order、User 后台导航壳
- PostgreSQL 用户表映射与 TypeORM 数据访问

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

1. 实现 Company 模块及公司信息增删查改接口。
2. 实现 Order 模块、订单状态流转与追踪记录。
3. 补充 Dashboard 数据聚合与可视化。
4. 在业务数据和权限边界明确后，接入 Redis、pgvector 与 Agent 查询工作流。
