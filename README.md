# Internship Supply Chain Admin

## Current progress

This iteration delivers the User and Company management modules:

- Authentication pages and dashboard navigation.
- User table: name search, Title/Role multi-select filter, create, edit, single deletion, and batch deletion.
- Company table: company-name search, Level multi-select filter, profitability-efficiency display, and expandable company details.
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
| `GET` | `/companies?name=Doyle&levels=1,2` | 按公司名、Level 查询公司 |
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
