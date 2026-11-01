# RBAC 模块 Mock 测试报告

> 项目：辰光Agent平台 — 管理后台前端（Vue 3 + TypeScript）
> 模块：RBAC（用户 / 角色 / 权限 / 认证 / 验证码）
> 接口契约：`docs/openapi.json`（`/api/v1/*`）
> 设计输入：`docs/PROJECT_SPEC.md`、`docs/ui/v9_system.html`、`docs/design/ui/ChenguangAgentDesign.md`
> 测试框架：Vitest 5 + MSW 3 + jsdom
> 测试日期：2026-11-01
> 执行命令：`npm run test:coverage`

---

## 一、说明：关于 rbac-plan.md

本次任务要求的 `rbac-plan.md` 在工作区（`D:\v2`）及相邻项目目录中均未找到。
为避免阻塞交付，RBAC 模块按以下已存在的权威资料实现，并在本报告中明确记录：

| 输入 | 位置 | 用途 |
|---|---|---|
| PRD / 项目说明书 | `docs/PROJECT_SPEC.md` | 模块边界、页面要求、Mock 约定 |
| OpenAPI 契约 | `docs/openapi.json` | 全部端点、请求/响应 Schema（唯一接口事实来源） |
| UI 原型 | `docs/ui/v9_system.html` | 系统管理页布局与卡片结构 |
| 设计规范 | `docs/design/ui/ChenguangAgentDesign.md` | 配色、交互、可访问性 |
| 参考实现 | `chenguang-agent-platform-v4`（React 版） | 页面交互流程与权限分组方式 |

若后续提供 `rbac-plan.md`，可据此报告快速比对差异并补充用例。

---

## 二、测试目标与范围

| 层 | 验证内容 |
|---|---|
| apis | 23 个 RBAC 端点的请求路径、方法、参数、响应解包、错误码 |
| services | 认证业务、用户/角色/权限的列表、分页、搜索、CRUD、授权编排 |
| store | 登录态、权限/角色同步、角色与权限选项缓存、概览统计 |
| router | 动态路由权限过滤、受限父路由可见性 |
| mocks | 23 个端点的 MSW 处理器、数据一致性（删除角色/权限的级联同步） |

**不含**：浏览器端 E2E（当前环境未安装 Playwright 浏览器内核），但已完成开发服务器 HTTP 冒烟。

---

## 三、实现范围

### 3.1 代码结构

```
frontend/src/
├── apis/modules/
│   ├── auth.ts          # 登录 + 验证码（3 个端点）
│   └── rbac.ts          # 用户/角色/权限（20 个端点 + 类型 + 工具）
├── services/
│   ├── auth.ts          # 登录态、权限推导、登出
│   └── rbac/
│       ├── base.ts      # 分页列表基类（加载/错误/分页/搜索）
│       ├── user.ts      # 用户列表、创建、详情、角色分配
│       ├── role.ts      # 角色 CRUD、权限分配、按模块分组
│       └── permission.ts# 权限 CRUD、模块统计
├── store/modules/
│   ├── auth.ts          # 登录态与菜单权限
│   └── rbac.ts          # 角色/权限选项缓存 + 概览统计
├── pages/system/
│   ├── index.vue        # 系统概览（统计卡片 + 模块入口 + RBAC 模型说明）
│   ├── user/index.vue   # 用户管理（搜索/分页/创建/详情/分配角色/导出）
│   ├── role/index.vue   # 角色管理（搜索/分页/CRUD/按模块分配权限）
│   └── permission/index.vue # 权限管理（搜索/分页/CRUD/模块标签/统计）
├── mocks/
│   ├── data.ts          # RBAC 内存数据、验证码、分页与重置
│   └── handlers.ts      # 23 个端点处理器 + 级联一致性
└── router/routes.ts     # /system/overview 新增；RBAC 权限元数据
```

### 3.2 与 OpenAPI 的对齐说明

- 登录改为 `POST /api/v1/auth/login`，请求体包含 `captcha_key` / `captcha_code`（PRD 要求验证码）。
- 验证码使用 `GET /api/v1/captcha`（返回 `key` + `image`）与 `POST /api/v1/captcha`（校验）。
- 用户接口按契约仅提供 **列表 / 搜索 / 创建 / 详情 / 角色查询 / 角色分配**；
  OpenAPI 未定义用户删除与资料修改，因此界面未提供这两个操作（避免调用不存在的接口）。
- 角色与权限接口提供完整 CRUD 与授权。
- 所有列表接口返回统一 `{ code, message, data }`，由 Axios 拦截器解包。

---

## 四、全 API 覆盖矩阵（23/23）

> ✅ = 已覆盖，且用例通过。错误场景单列。

| # | 方法 | 端点 | 成功用例 | 异常用例 | 结果 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/login` | 登录成功返回 token + 用户 + 权限 | 密码错误 401 / 用户不存在 401 / 缺验证码 400 / 验证码错误 400 / 禁用账号 403 | ✅ |
| 2 | GET | `/api/v1/captcha` | 返回 key 与 SVG 图片 | — | ✅ |
| 3 | POST | `/api/v1/captcha` | 正确码返回 true | 错误码 false / 参数缺失 400 / 一次性失效 | ✅ |
| 4 | GET | `/api/v1/users` | offset/limit 切片正确 | — | ✅ |
| 5 | GET | `/api/v1/users/search` | 分页 + 关键词过滤 | — | ✅ |
| 6 | POST | `/api/v1/users` | 创建成功并进入列表 | 重复用户名 400 / 缺字段 400 | ✅ |
| 7 | GET | `/api/v1/users/me` | 携带令牌返回当前用户 | 未授权 401 | ✅ |
| 8 | GET | `/api/v1/users/{id}` | 返回用户及角色 | 不存在 404 | ✅ |
| 9 | GET | `/api/v1/users/{id}/roles` | 返回角色列表 | 用户不存在 404 | ✅ |
| 10 | PUT | `/api/v1/users/{id}/roles` | 分配多角色 / 空数组清空 | 非法角色 400 / 用户不存在 404 | ✅ |
| 11 | GET | `/api/v1/roles/` | 返回全部角色（含权限） | — | ✅ |
| 12 | GET | `/api/v1/roles/search` | 分页 + 关键词 | — | ✅ |
| 13 | POST | `/api/v1/roles` | 创建角色 | 重复编码 400 / 缺字段 400 | ✅ |
| 14 | GET | `/api/v1/roles/{id}` | 返回角色详情 | 不存在 404 | ✅ |
| 15 | PUT | `/api/v1/roles/{id}` | 更新名称/描述 | 不存在 404 | ✅ |
| 16 | DELETE | `/api/v1/roles/{id}` | 删除并从用户身上级联移除 | 不存在 404 | ✅ |
| 17 | PUT | `/api/v1/roles/{id}/permissions` | 分配权限集合 | 非法权限 400 | ✅ |
| 18 | GET | `/api/v1/permissions/` | 返回全部权限 | — | ✅ |
| 19 | GET | `/api/v1/permissions/search` | 分页 + 关键词 | — | ✅ |
| 20 | POST | `/api/v1/permissions` | 创建权限 | 重复编码 400 / 缺字段 400 | ✅ |
| 21 | GET | `/api/v1/permissions/{id}` | 返回权限详情 | 不存在 404 | ✅ |
| 22 | PUT | `/api/v1/permissions/{id}` | 更新并同步角色内引用 | 不存在 404 | ✅ |
| 23 | DELETE | `/api/v1/permissions/{id}` | 删除并从角色中级联移除 | 不存在 404 | ✅ |

**端点覆盖率：23/23 = 100%**（每个端点至少 1 条成功用例，核心写操作附带异常用例）

---

## 五、测试执行结果

```
 Test Files  7 passed (7)
      Tests  157 passed (157)
   Duration  ~9.4s
```

| 测试文件 | 覆盖对象 | 用例数 | 结果 |
|---|---|---:|---|
| `src/apis/__tests__/rbac.test.ts` | 全部 23 个 RBAC 端点 | 51 | ✅ |
| `src/apis/__tests__/request.test.ts` | Axios 请求方法封装 | 5 | ✅ |
| `src/apis/__tests__/error.test.ts` | 拦截器错误码、请求头注入 | 7 | ✅ |
| `src/services/__tests__/service.test.ts` | 认证 + 用户/角色/权限服务 | 38 | ✅ |
| `src/store/__tests__/store.test.ts` | Auth / App / Settings / RBAC Store | 32 | ✅ |
| `src/router/__tests__/router.test.ts` | 路由表与权限过滤 | 12 | ✅ |
| `src/router/__tests__/guards.test.ts` | 路由守卫工具 | 12 | ✅ |
| **合计** | | **157** | **100% 通过** |

其中 RBAC 专项用例（API + 服务 + Store + 请求封装）共 **101** 条。

---

## 六、覆盖率

| 指标 | 覆盖率 |
|---|---:|
| Statements | **64.38%**（593/921） |
| Branches | **50.35%**（141/280） |
| Functions | **68.12%**（171/251） |
| Lines | **64.95%**（556/856） |

RBAC 相关核心文件：

| 文件 | 语句 | 分支 | 函数 | 行 |
|---|---:|---:|---:|---:|
| `apis/modules/rbac.ts` | **100%** | 50% | **100%** | **100%** |
| `services/rbac/base.ts` | 90.90% | 88.88% | 88.88% | 89.65% |
| `services/rbac/user.ts` | 81.03% | 42.85% | 80.00% | 82.14% |
| `services/rbac/role.ts` | 79.16% | 41.66% | 76.92% | 84.61% |
| `services/rbac/permission.ts` | 82.81% | 50.00% | 84.61% | 86.20% |
| `services/auth.ts` | 82.29% | 55.17% | 90.00% | 85.05% |
| `store/modules/rbac.ts` | 94.33% | 82.60% | **100%** | **100%** |

> HTML 覆盖率报告：`docs/tests/rbac/coverage/index.html`
> 未覆盖行主要是未在界面上触发的极端分支（如请求异常的兜底返回值、页面组件的空状态渲染）。

---

## 七、关键测试场景说明

### 7.1 认证与验证码

1. `GET /v1/captcha` 返回 `key` 与 SVG 图片；测试通过 Mock 辅助读取明文码。
2. 登录必须同时提交 `captcha_key` + `captcha_code`；验证码一次性，校验后失效。
3. 密码错误、用户不存在 → 401；验证码错误/缺失 → 400；禁用账号 → 403。
4. 登录成功后 `/users/me` 携带 Bearer Token 返回当前用户（含角色与权限码）。

### 7.2 用户与角色分配

1. 列表返回 `roles` 便于直接展示标签（OpenAPI 的 UserRead 为最小集合，Mock 做了扩展）。
2. `PUT /users/{id}/roles` 支持多角色、空数组清空、非法角色 400。
3. 删除角色后，用户详情中该角色同步消失（级联一致性用例）。

### 7.3 角色与权限授权

1. 角色编码唯一，创建后不可修改（与 OpenAPI `RoleUpdate` 仅允许 name/description 一致）。
2. `PUT /roles/{id}/permissions` 返回完整角色（含新权限）。
3. 前端按 `code.split(':')[0]` 分组，支持整组勾选与半选状态。
4. 权限更名/删除会同步角色内引用（两条级联用例）。

### 7.4 路由与菜单

1. 受限父路由（/system）仅在有"真正授权的子路由"时展示，避免空菜单。
2. 只拥有 `system:user:view` 时，概览与用户管理可见，角色/权限管理被过滤。
3. 无任何 RBAC 权限时，系统管理入口隐藏。

---

## 八、Mock 测试中发现并修复的问题

| # | 问题 | 影响 | 修复 |
|---|---|---|---|
| 1 | 旧框架登录接口为 `/auth/login`，与后端契约不符 | 无法对接真实后端 | 改为 `/v1/auth/login` 并强制验证码字段 |
| 2 | 旧用户接口与 OpenAPI 的用户模型不一致（status/roles 结构） | 类型与后端不匹配 | 重建 `apis/modules/rbac.ts`，严格按 Schema 定义 |
| 3 | 受限父路由会因"无权限占位子路由"而错误显示 | 无权限用户仍看到系统管理菜单 | 调整 `filterRoutesByPermission`：父路由需自身授权或存在已授权子路由 |
| 4 | 删除角色后用户对象仍持有旧角色 | 授权展示不一致 | Mock 中删除角色时级联清理用户角色，并添加测试 |
| 5 | 权限更新/删除后角色内权限对象未同步 | 角色详情显示旧名称 | Mock 中同步角色权限引用，并添加测试 |
| 6 | 用户列表缺少角色信息，页面无法展示角色标签 | 列表信息缺失 | 列表接口扩展 `roles` 可选字段，类型单独定义 `UserListItem` |
| 7 | 验证码一次性语义缺失 | 重放风险、与后端行为不一致 | Mock 校验后立即删除 key，并测试重复校验为 false |
| 8 | 登录页沿用 AI 紫渐变与无效字段（captcha_id） | 视觉违规、字段错误 | 改为深蓝灰品牌色 + 暖金点缀；字段改为 `captcha_key` |
| 9 | 概览统计复用列表服务单例，污染分页状态 | 页面间状态串扰 | Store 直接调用 API 聚合统计，不再复用列表服务 |
| 10 | 测试间 Mock 数据相互污染 | 用例顺序依赖、偶发失败 | 新增 `resetMockData()` 并在 `beforeEach` 统一重置 |

---

## 九、冒烟验证

| 检查项 | 结果 |
|---|---|
| `npm run dev` 启动 | ✅ 366ms 就绪 |
| `GET /` | ✅ HTTP 200 |
| `GET /src/pages/login/index.vue` | ✅ HTTP 200 |
| `GET /mockServiceWorker.js` | ✅ HTTP 200 |
| `vue-tsc -b` | ✅ 0 错误 |
| `vite build` | ✅ 786ms，产物正常 |

**未执行**：Playwright 浏览器 E2E（环境未安装浏览器内核，避免额外大体积下载）。
如需补充，可执行 `npx playwright install chromium` 后对登录 → 用户 → 角色 → 权限四页做端到端 Mock 冒烟。

---

## 十、结论与建议

1. **全 API 覆盖达成**：OpenAPI 中 RBAC 相关 23 个端点全部实现并被测试覆盖，端点覆盖率 100%。
2. **分层落地**：页面仅依赖 Store 与 Service，Service 封装业务与状态，API 层保持薄封装，Mock 在 HTTP 层拦截，业务代码零侵入。
3. **数据一致性**：删除角色/权限、更新权限名称等跨资源场景均有级联处理与用例保障。
4. **质量基线**：157 条用例全部通过，RBAC API 模块行覆盖率 100%，服务层 80%+。
5. **后续建议**：
   - 补充浏览器端 E2E（登录 + 三个管理页）。
   - 当后端提供用户删除/修改接口时，同步补齐用户 CRUD 与对应用例。
   - 将 `npm run test:coverage` 纳入 CI，对 `apis/modules` 设置 90% 行覆盖率阈值。

---

## 附录：运行方式

```bash
cd frontend
npm install
npm run test            # 全部 Mock 测试（157 条）
npm run test:coverage   # 生成覆盖率（输出至 docs/tests/coverage）
npm run dev             # 启动开发服务器（MSW Mock，账号 admin / 123456）
npm run build           # 类型检查 + 生产构建
```
