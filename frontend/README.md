# 辰光Agent平台 — 前端框架

基于 **Vue 3 + TypeScript + Pinia + Vue Router + Element Plus + Vite** 搭建的企业级管理后台前端框架。

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Vue 3.5（Composition API + `<script setup>`） |
| 语言 | TypeScript 6（严格模式） |
| 状态管理 | Pinia 4 |
| 路由 | Vue Router 5（动态路由 + 权限守卫） |
| UI 组件库 | Element Plus 2 + @element-plus/icons-vue |
| HTTP | Axios（统一封装 + 拦截器） |
| 构建 | Vite 8 |
| 测试 | Vitest 5 + MSW 3 + jsdom |
| 样式 | SCSS / CSS 变量 |

## 分层架构

项目严格按前端工程化分层，依赖方向自上而下单向：

```
pages（页面组件）
   ↓ 调用
store（Pinia 状态封装）
   ↓ 调用
services（业务逻辑）
   ↓ 调用
apis（Axios 异步请求封装）
   ↑
router（路由与权限守卫，驱动 pages）
components（普通组件 / 公共组件，被 pages 复用）
```

| 目录 | 职责 | 示例 |
|---|---|---|
| `src/apis/` | Axios 实例、拦截器、请求方法封装；按业务模块拆分接口定义与类型 | `apis/index.ts`、`apis/modules/user.ts` |
| `src/services/` | 业务逻辑：状态编排、分页、缓存、错误处理；不直接操作 UI | `services/auth.ts`、`services/rbac/*`（用户/角色/权限） |
| `src/router/` | 路由表、动态路由权限过滤、全局守卫、导航工具 | `router/routes.ts`、`router/index.ts`、`router/guards.ts` |
| `src/store/` | Pinia Store：跨页面共享状态与 Actions | `store/modules/auth.ts`、`app.ts`、`settings.ts`、`rbac.ts` |
| `src/pages/` | 页面级组件，按业务模块组织 | `pages/login`、`pages/dashboard`、`pages/system/user` |
| `src/components/` | 公共组件与布局组件 | `components/layout/*`、`components/common/PageContainer.vue` |

### 数据流

```
页面事件 → Store Action → Service 方法 → API 模块 → Axios → 后端
                ↑                                    ↓
            响应式状态 ← Service 状态 ← 响应拦截器解包 data
```

- **API 层**只负责“发请求 + 解包响应 + 统一错误提示”，不包含业务判断。
- **Service 层**持有可复用的业务状态（`BaseService` 内置 `data/loading/error/pagination`）与业务规则。
- **Store 层**将 Service 的状态同步为全局响应式状态，供页面订阅。
- **页面层**只做展示与交互，不直接调用 `apis`。

## 目录结构

```
frontend/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── mockServiceWorker.js      # MSW Service Worker
├── src/
│   ├── apis/
│   │   ├── index.ts              # Axios 封装（拦截器/方法封装/上传下载）
│   │   └── modules/              # 业务接口模块
│   │       ├── auth.ts
│   │       ├── user.ts
│   │       └── index.ts
│   ├── services/
│   │   ├── base.ts               # BaseService 通用 CRUD/分页/状态
│   │   ├── auth.ts               # 认证业务逻辑
│   │   ├── user.ts               # 用户管理业务逻辑
│   │   └── index.ts
│   ├── router/
│   │   ├── routes.ts             # 静态/异步路由表
│   │   ├── index.ts              # 路由实例 + 全局守卫 + 动态路由
│   │   ├── guards.ts             # 面包屑/菜单/节流导航等工具
│   │   └── __tests__/
│   ├── store/
│   │   ├── modules/
│   │   │   ├── auth.ts           # 认证状态
│   │   │   ├── app.ts            # 布局/标签页/主题
│   │   │   └── settings.ts       # 用户偏好设置
│   │   ├── index.ts
│   │   └── __tests__/
│   ├── pages/
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── system/               # 用户/角色/权限/部门/菜单/字典/配置/日志
│   │   ├── monitor/              # 在线用户/服务监控/缓存监控
│   │   ├── profile/
│   │   └── error/                # 403 / 404 / 500
│   ├── components/
│   │   ├── layout/               # Layout / SidebarMenuItem / TagsView
│   │   ├── common/               # PageContainer / SearchForm / DataTable / PlaceholderPage
│   │   └── index.ts
│   ├── mocks/                    # MSW Mock（浏览器 + Node 共用 handlers）
│   │   ├── data.ts
│   │   ├── handlers.ts
│   │   ├── browser.ts
│   │   └── server.ts
│   ├── test/setup.ts             # 测试环境初始化
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── docs/tests/                   # 本地覆盖率输出（已归档到根目录 docs/tests）
├── .env.development
├── .env.production
├── .env.test
├── vite.config.ts
├── vitest.config.ts
├── tsconfig*.json
└── package.json
```

## 快速开始

```bash
cd frontend
npm install

# 开发（自动启用 MSW Mock，账号 admin / 123456）
npm run dev

# 类型检查 + 生产构建
npm run build

# Mock 测试
npm run test
npm run test:coverage
```

> 如需对接真实后端，将 `.env.development` 中 `VITE_USE_MOCK=false`，并在 `vite.config.ts`
> 的 `server.proxy` 中配置后端地址（默认 `http://localhost:8000`）。

## 测试

测试报告见根目录 [`docs/tests/MOCK_TEST_REPORT.md`](../docs/tests/MOCK_TEST_REPORT.md)，
覆盖率 HTML 见 [`docs/tests/coverage/index.html`](../docs/tests/coverage/index.html)。

RBAC 模块专项报告与覆盖率见 [`docs/tests/rbac/RBAC_TEST_REPORT.md`](../docs/tests/rbac/RBAC_TEST_REPORT.md)。

- 7 个测试文件，157 个用例，全部通过
- RBAC 相关 23 个接口端点 100% 覆盖
- 语句覆盖率 64.38%，行覆盖率 64.95%

## RBAC 模块

| 页面 | 路由 | 能力 |
|---|---|---|
| 系统概览 | `/system/overview` | 用户/角色/权限统计、模块入口、权限模型说明 |
| 用户管理 | `/system/user` | 搜索、分页、创建用户、查看详情、分配角色、CSV 导出 |
| 角色管理 | `/system/role` | 搜索、分页、CRUD、按模块分配权限 |
| 权限管理 | `/system/permission` | 搜索、分页、CRUD、模块标签与统计 |

接口严格对齐 `docs/openapi.json` 的 `/api/v1/*`：登录与验证码、用户（列表/搜索/创建/详情/角色）、
角色（CRUD/授权）、权限（CRUD）。Mock 账号：`admin / 123456`（验证码在图片中直接显示，便于调试）。

## 路由与权限

- 静态路由：登录、403、404、500。
- 异步路由：按 `meta.permissions` 过滤后动态 `addRoute`。
- 全局前置守卫：白名单放行 → 未登录跳登录 → 首次登录注入动态路由 → 权限校验 → 进入页面。
- 导航工具：面包屑、菜单生成、标签页生成、300ms 节流导航。

## 约定

- 组件文件使用 PascalCase；页面目录按业务模块组织。
- 所有接口返回统一结构 `{ code, message, data, timestamp }`，拦截器负责成功解包与失败提示。
- API 层禁止写业务分支；Service 层禁止操作 DOM；页面层禁止直接 import `apis`。
- 不使用占位图/外部图片 URL；Mock 数据全部本地生成。
