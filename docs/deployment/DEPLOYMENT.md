# 辰光 Agent 平台 - 项目启动与部署说明书

## 1. 项目概述

辰光 Agent 平台是一个基于 FastAPI + React 的全栈 AI Agent 管理平台，支持模型管理、Prompt 编排、知识库 RAG、工具调用和 Agent 版本发布等功能。

**技术栈：**
- **后端**：FastAPI (Python 3.13+) + SQLAlchemy 2.0 + SQLite (开发) / MySQL 8.4 (生产) + Redis / fakeredis
- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **基础设施**：MinIO (对象存储) + Docker Compose (生产环境)

---

## 2. 环境要求

### 2.1 开发环境

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.10+ (推荐 3.13) | 使用 `py -3` 启动器 |
| Node.js | 18+ | 推荐使用 LTS 版本 |
| Git | 2.30+ | 版本控制 |

### 2.2 生产环境 (Docker)

| 服务 | 版本 | 端口 |
|------|------|------|
| MySQL | 8.4 | 3306 |
| Redis | 7+ | 6379 |
| MinIO | latest | 9000 (API), 9001 (Console) |

---

## 3. 快速启动 (开发模式)

### 3.1 方式一：使用启动脚本 (推荐)

```bash
# Windows
start.bat

# 或手动执行以下步骤
```

### 3.2 方式二：手动启动

#### 后端启动

```bash
# 1. 创建并激活虚拟环境
py -3 -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/macOS

# 2. 安装依赖
pip install -r requirements.txt
pip install minio  # 开发环境需要 MinIO 客户端

# 3. 初始化数据库
python bootstrap_db.py

# 4. 启动后端服务 (端口 8080)
python -m uvicorn src.main:app --host 127.0.0.1 --port 8080 --reload
```

#### 前端启动

```bash
# 1. 进入前端目录
cd app

# 2. 安装依赖
npm install

# 3. 启动开发服务器 (端口 5173)
npm run dev
```

---

## 4. 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端应用 | http://localhost:5173 | 主界面 |
| 后端 API 文档 | http://localhost:8080/docs | Swagger UI |
| 后端健康检查 | http://localhost:8080/health | 监控用 |
| 默认账号 | admin / 123456 | 超级管理员 |

---

## 5. 环境配置

### 5.1 后端环境变量 (.env)

```bash
# 应用
APP_NAME=辰光Agent
APP_ENV=dev
APP_DEBUG=true

# 数据库 (开发环境使用 SQLite，无需配置 MySQL)
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=123456
# DB_NAME=chenguang

# Redis (开发环境使用 fakeredis，无需配置)
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=123456
# REDIS_DB=0

# MinIO
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=knowledge-docs
MINIO_SECURE=false

# 日志
LOG_LEVEL=DEBUG
LOG_DIR=logs
```

### 5.2 前端环境变量 (app/.env.local)

```bash
VITE_API_BASE=http://localhost:8080/api
VITE_USE_MOCK=false  # true=使用 Mock 数据，false=调用真实后端
```

---

## 6. 生产环境部署 (Docker Compose)

### 6.1 启动基础设施

```bash
docker compose -f docker/docker-compose.yaml up -d
```

这将启动：
- MySQL 8.4 (端口 3306，数据库：chenguang，用户：root，密码：123456)
- Redis (端口 6379，密码：123456)
- MinIO (端口 9000/9001，用户：minioadmin，密码：minioadmin123)

### 6.2 配置生产环境变量

复制 `.env.example` 为 `.env` 并修改为生产配置：

```bash
cp .env.example .env
# 编辑 .env，取消注释 MySQL 和 Redis 配置
```

### 6.3 运行数据库迁移

```bash
alembic upgrade head
```

### 6.4 启动应用

```bash
# 后端
uvicorn src.main:app --host 0.0.0.0 --port 8080

# 前端 (构建后由 Nginx 托管)
cd app && npm run build
# 将 dist 目录部署到 Nginx
```

---

## 7. 常见问题与解决

### 7.1 后端启动失败：ModuleNotFoundError: No module named 'minio'

**原因**：开发环境需要 MinIO Python 客户端，但 requirements.txt 中未包含。

**解决**：
```bash
pip install minio
```

### 7.2 后端启动失败：asyncmy 编译错误 (Microsoft Visual C++ 14.0+ required)

**原因**：`asyncmy` 是 MySQL 异步驱动，需要 C++ 编译工具。本地开发使用 SQLite，不需要此包。

**解决**：
```bash
# 将 requirements.txt 中的 asyncmy 注释掉
# asyncmy==0.2.11  # MySQL 异步驱动，本地 SQLite 开发不需要，生产环境取消注释
pip install -r requirements.txt
```

### 7.3 虚拟环境 Python 路径错误

**原因**：`.venv/pyvenv.cfg` 中记录的 Python 路径可能与当前系统不一致（如从其他机器复制项目）。

**解决**：
```bash
rm -rf .venv
py -3 -m venv .venv
pip install -r requirements.txt
```

### 7.4 前端无法连接后端 API

**原因**：前端配置的 API 地址不正确。

**解决**：检查 `app/.env.local` 中的 `VITE_API_BASE` 是否指向正确的后端地址。

### 7.5 端口被占用

**现象**：启动时提示 "端口 8080/5173 已被占用"

**解决**：
```bash
# Windows 查看占用端口的进程
netstat -ano | findstr :8080
netstat -ano | findstr :5173

# 结束进程 (替换 PID)
taskkill /PID <PID> /F
```

---

## 8. 数据库管理

### 8.1 创建新迁移

```bash
alembic revision --autogenerate -m "迁移描述"
```

### 8.2 应用迁移

```bash
alembic upgrade head
```

### 8.3 回滚迁移

```bash
alembic downgrade -1  # 回滚 1 步
alembic downgrade base  # 回滚到初始状态
```

### 8.4 重置数据库 (开发环境)

```bash
# 删除数据库文件
del chenguang.db

# 重新初始化
python bootstrap_db.py
```

---

## 9. 项目结构速览

```
chenguang-agent-platform-v4/
├── src/                    # 后端源码
│   ├── core/              # 核心基础设施 (配置、DI、异常、日志、基类)
│   ├── infra/             # 基础设施 (数据库、Redis、MinIO)
│   ├── modules/           # 业务模块
│   │   ├── user/         # 用户管理
│   │   ├── auth/         # 认证授权
│   │   ├── captcha/      # 验证码
│   │   ├── permission/   # 权限管理
│   │   ├── role/         # 角色管理
│   │   ├── provider/     # 模型供应商
│   │   ├── model/        # 模型管理
│   │   ├── prompt/       # Prompt 管理
│   │   ├── knowledge/    # 知识库
│   │   ├── tool/         # 工具管理
│   │   └── agent/        # Agent 管理
│   └── main.py           # 应用入口
├── app/                   # 前端源码
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API 服务层
│   │   ├── components/   # UI 组件
│   │   └── layouts/      # 布局组件
│   └── package.json
├── alembic/              # 数据库迁移
├── docker/               # Docker 配置
├── bootstrap_db.py       # 数据库初始化脚本
├── init_data.py          # 种子数据脚本
├── requirements.txt      # Python 依赖
├── start.bat             # Windows 一键启动脚本
└── wait_ready.py         # 服务就绪检查脚本
```

---

## 10. 开发规范

### 10.1 代码风格

- **后端**：遵循 PEP 8 / PEP 257，必须使用类型提示 (Pydantic v2、SQLAlchemy 2.0)
- **前端**：ESLint 扁平配置，TypeScript 严格模式 (`strict: true`)

### 10.2 模块开发模式

每个业务模块包含 5 个核心文件：
```
module/
├── model.py      # ORM 模型
├── schema.py     # Pydantic Schema (API 契约)
├── repository.py # 数据访问层
├── service.py    # 业务逻辑层
└── api.py        # 路由层
```

### 10.3 提交规范

```
<中文摘要>          # 如："前端更新"、"知识库文件上传完成"、"后端CRUD接口完成"
```

分支命名：`Feat_xxx` 用于功能分支

---

## 11. 启动脚本 (start.bat) 说明

`start.bat` 是 Windows 环境下的一键启动脚本，功能包括：

1. **环境检测**：自动检测系统 Python (python/py)
2. **虚拟环境管理**：自动创建/复用 `.venv`
3. **依赖安装**：自动安装 `requirements.txt` 依赖 (配置清华源加速)
4. **数据库初始化**：运行 `bootstrap_db.py` 自动处理建表、迁移、种子数据
5. **前端依赖**：自动执行 `npm install`
6. **服务启动**：并行启动后端 (8080) 和前端 (5173)
7. **就绪检测**：调用 `wait_ready.py` 轮询检测服务是否就绪
8. **自动打开浏览器**：服务就绪后自动打开前端页面

### 11.1 已知问题与修复记录

| 问题 | 修复方案 |
|------|----------|
| asyncmy 编译失败 | requirements.txt 注释掉 asyncmy，本地开发用 SQLite |
| minio 模块缺失 | 启动脚本中添加 `pip install minio` |
| 虚拟环境路径失效 | 检测到路径不存在时自动重建 .venv |
| 编码问题 (中文乱码) | 设置 `PYTHONIOENCODING=utf-8` |

---

## 12. 更新日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0.0 | 2026-10-25 | 初版：项目启动说明、环境配置、常见问题、Docker 部署 |

---

## 13. 技术支持

如遇到文档未覆盖的问题，请：
1. 查看控制台错误日志
2. 检查 `logs/` 目录下的应用日志
3. 参考 `AGENTS.md` 中的项目指南
4. 提交 Issue 或联系维护团队