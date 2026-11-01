# RBAC 模块 Mock 测试报告（V2 授权增强版）

> 项目：辰光Agent平台 — 管理后台前端（Vue 3 + TypeScript）
> 模块：RBAC（认证 / 验证码 / 用户 / 角色 / 权限 / 权限上下文 / 权限树）
> 实现计划：[rbac-plan.md](file:///C:/Users/%E6%98%93%E6%99%BA%E6%88%90/Desktop/chenguang-agent-platform-v4/docs/design/plans/rbac-plan.md)
> PRD：`PROJECT_SPEC_V2.md`（RBAC 授权能力增强版）
> 设计输入：`docs/PROJECT_SPEC.md`、`docs/ui/v9_system.html`、`docs/design/ui/ChenguangAgentDesign.md`
> 测试框架：Vitest 5 + MSW 3 + jsdom + @vue/test-utils
> 测试日期：2026-11-01
> 执行命令：`npm run test:coverage`

---

## 一、测试目标与依据

本模块依据用户提供的 `rbac-plan.md` 与 PRD V2 重构，核心是把上一版的「数据维护」升级为完整的「授权能力」：

| 目标 | 对应 PRD / Plan |
|---|---|
| 63 条权限目录 / 16 个模块，权限码 `模块:操作` | PRD 4.2 / 4.4，Plan Task 2 |
| 3 个内置角色矩阵（admin 63 / operator 27 / viewer 9） | PRD 4.5，Plan Task 2 |
| 当前用户权限上下文 `GET /users/me/permissions` | PRD 7.2.1，Plan Task 6 |
| 权限树 `GET /permissions/tree` | PRD 7.2.2，Plan Task 6 |
| 用户启停、编辑、删除与安全边界 | PRD 7.2.3 / 8.4，Plan Task 10 / 11 |
| 前端权限状态（内存态、不落 localStorage） | PRD 8.1 / D12，Plan Task 8 |
| 菜单 / 路由 / 按钮按权限收敛、403 页 | PRD 8.2–8.4，Plan Task 9 |
| 角色权限树、内置保护、权限格式校验 | PRD 8.5–8.6，Plan Task 10 |
| 401/403 语义化与业务错误码 | PRD 7.1，Plan Global Constraints |

**不在本期范围**：后端 FastAPI/Redis 实现、63 条权限的数据库迁移、审计日志接口（Plan 的 Task 1/3/4/5/7/11/12 属于后端）。
本报告验收的是「前端 RBAC 模块 + Mock 契约」部分。

---

## 二、实现范围

### 2.1 前端结构

```
frontend/src/
├── apis/modules/
│   ├── auth.ts          # 登录 + 验证码（3 端点）
│   └── rbac.ts          # 用户/角色/权限/权限上下文/权限树（24 端点 + 类型 + 校验）
├── services/
│   ├── auth.ts          # 登录态（仅 Token 持久化）
│   └── rbac/
│       ├── base.ts      # 分页列表基类（加载/错误/分页/搜索）
│       ├── user.ts      # 列表、创建、更新、启停、删除、角色分配
│       ├── role.ts      # CRUD、权限矩阵分配、模块分组
│       └── permission.ts# CRUD、权限树、模块筛选与统计
├── store/modules/
│   ├── auth.ts          # 用户/角色；权限判断委托 permissionStore
│   ├── permission.ts    # 权限上下文（PRD 8.1）：loading/error/permissions/isSuperuser/roles/version
│   └── rbac.ts          # 角色/权限选项缓存、权限树缓存、概览统计
├── components/common/
│   └── Can.vue          # 声明式权限组件（any/all + fallback）
├── router/
│   ├── routes.ts        # 路由权限码对齐 V2；新增 /system/overview
│   └── index.ts         # 守卫：用户信息 → 权限加载 → 动态路由 → 403
├── pages/system/
│   ├── index.vue        # 系统概览（统计 + 模块入口 + RBAC 模型）
│   ├── user/index.vue   # 角色列、启停（自我保护）、编辑、删除、分配角色
│   ├── role/index.vue   # 权限树（模块分组/三态/搜索）、内置角色保护
│   └── permission/index.vue # 模块筛选、内置标记、权限码格式校验
└── mocks/
    ├── data.ts          # 63 条目录、3 内置角色、权限树、验证码、版本号
    └── handlers.ts      # 27 个端点 + 接口鉴权 + 安全边界 + 业务错误码
```

### 2.2 关键设计决策

| 决策 | 说明 |
|---|---|
| 权限不落 localStorage | D12：登录只持久化 Token；权限由 `/users/me/permissions` 每次启动拉取 |
| 登录响应扩展 user | 后端 `TokenResponse` 不变，前端在 Mock 中附加 user（含 roles/is_superuser），权限码不随登录下发（D6） |
| 前端鉴权与后端一致 | Mock 对每个端点校验 Token、账号状态与权限码，便于验证 401/403 语义 |
| 内置角色保护 | `admin` 角色权限固定 63 条不可缩减；内置角色不可删除；权限删除受 `is_system` 保护 |
| 安全边界（Mock 实现） | 40302 自提权 / 40303 内置保护 / 40304 自我操作 / 40305 最后超管 / 40306 角色使用中 |
| 用户接口 | 按 V2 补齐 `PUT /users/{id}` 与 `DELETE /users/{id}`（7.2.3 / 7.4） |

---

## 三、全 API 覆盖矩阵（27/27）

> ✅ = 覆盖且通过；异常列列出已断言的状态/业务码。

| # | 方法 | 端点 | 权限 | 成功用例 | 异常/边界用例 | 结果 |
|---|---|---|---|---|---|---|
| 1 | POST | `/v1/auth/login` | 公开 | Token + 用户 | 密码错 401 / 不存在 401 / 缺验证码 400 / 验证码错 400 / 禁用 401(40101) | ✅ |
| 2 | GET | `/v1/captcha` | 公开 | key + SVG 图片 | — | ✅ |
| 3 | POST | `/v1/captcha` | 公开 | 正确码 true | 错误码 false / 一次性失效 / 缺参 400 | ✅ |
| 4 | GET | `/v1/users/me` | 登录 | 当前用户 + 角色 | 无 Token 401 | ✅ |
| 5 | GET | `/v1/users/me/permissions` | 登录 | 上下文含 63/27/9 条权限、版本号、cached_at | 权限按角色聚合（admin/operator/viewer） | ✅ |
| 6 | GET | `/v1/users` | `system.user:read` | offset/limit 切片 | viewer 访问 403 | ✅ |
| 7 | GET | `/v1/users/search` | `system.user:read` | 分页 + 关键词 | 未登录 401 / viewer 403 | ✅ |
| 8 | POST | `/v1/users` | `system.user:create` | 创建成功、角色为空 | 重复用户名 400 / 缺字段 400 | ✅ |
| 9 | GET | `/v1/users/{id}` | `system.user:read` | 详情 + 角色 | 不存在 404 | ✅ |
| 10 | GET | `/v1/users/{id}/roles` | `system.user:read` | 精简角色（无 permissions） | — | ✅ |
| 11 | PUT | `/v1/users/{id}` | `system.user:update` | 改邮箱 / 启用 | 邮箱重复 400 / 禁用自己 40304 | ✅ |
| 12 | DELETE | `/v1/users/{id}` | `system.user:delete` | 删除普通用户 | 删除自己 40304 | ✅ |
| 13 | PUT | `/v1/users/{id}/roles` | `system.user:assign` | 多角色分配 | 非法角色 400 / 清空自己角色 40304 / 自提权 40302 | ✅ |
| 14 | GET | `/v1/roles/` | `system.role:read` | 4 角色、内置标记、user_count | — | ✅ |
| 15 | GET | `/v1/roles/search` | `system.role:read` | 分页 + 关键词 | — | ✅ |
| 16 | POST | `/v1/roles` | `system.role:create` | 创建自定义角色 | 重复编码 400 / 非法编码 400 | ✅ |
| 17 | GET | `/v1/roles/{id}` | `system.role:read` | 详情（admin 63 条） | — | ✅ |
| 18 | PUT | `/v1/roles/{id}` | `system.role:update` | 名称/描述更新 | — | ✅ |
| 19 | DELETE | `/v1/roles/{id}` | `system.role:delete` | 删除未使用自定义角色 | 内置 40303 / 使用中 40306 | ✅ |
| 20 | PUT | `/v1/roles/{id}/permissions` | `system.role:assign` | 分配权限集合 | admin 角色固定 40303 / 非法权限 400 | ✅ |
| 21 | GET | `/v1/permissions/` | `system.permission:read` | 63 条 + 扩展字段 | — | ✅ |
| 22 | GET | `/v1/permissions/tree` | `system.permission:read` | 16 模块分组、固定顺序、共 63 条 | viewer 403 | ✅ |
| 23 | GET | `/v1/permissions/search` | `system.permission:read` | 分页 / 关键词 / 模块筛选 | — | ✅ |
| 24 | POST | `/v1/permissions` | `system.permission:create` | 创建自定义权限 | 格式错误 400 / 重复编码 400 | ✅ |
| 25 | GET | `/v1/permissions/{id}` | `system.permission:read` | 详情 | 不存在 404 | ✅ |
| 26 | PUT | `/v1/permissions/{id}` | `system.permission:update` | 改名并同步角色 | — | ✅ |
| 27 | DELETE | `/v1/permissions/{id}` | `system.permission:delete` | 删除自定义权限 | 内置 40303 / 不存在 404 | ✅ |

**端点覆盖率：27/27 = 100%**

### 鉴权 / 安全边界专项

| 规则 | 用例 | 预期 |
|---|---|---|
| 未登录 | 访问受保护接口 | 401（40100） |
| 账号禁用 | 禁用账号登录 | 401（40101） |
| 缺少权限码 | viewer 访问用户管理 / operator 创建角色 | 403（40301） |
| 自提权 | 非超管给自己分配 admin | 403（40302） |
| 内置资源 | 删除内置角色 / 内置权限 / 修改 admin 角色权限 | 403（40303） |
| 自我操作 | 禁用/删除自己、清空自己全部角色 | 403（40304） |
| 最后超管 | 唯一超管被停用/删除 | 403（40305） |
| 角色使用中 | 删除仍被用户使用的角色 | 403（40306） |

---

## 四、测试执行结果

```
 Test Files  8 passed (8)
      Tests  176 passed (176)
   Duration  ~9.3s
```

| 测试文件 | 覆盖对象 | 用例数 | 结果 |
|---|---|---:|---|
| `src/apis/__tests__/rbac.test.ts` | 27 个 RBAC 端点 + 鉴权/安全边界 | 63 | ✅ |
| `src/apis/__tests__/request.test.ts` | Axios 请求方法封装 | 5 | ✅ |
| `src/apis/__tests__/error.test.ts` | 拦截器错误码、请求头注入 | 7 | ✅ |
| `src/services/__tests__/service.test.ts` | 认证 + 用户/角色/权限服务 | 41 | ✅ |
| `src/store/__tests__/store.test.ts` | Auth / Permission / App / Settings / RBAC Store | 30 | ✅ |
| `src/components/__tests__/Can.test.ts` | `<Can>` 组件（any/all/fallback/超管） | 6 | ✅ |
| `src/router/__tests__/router.test.ts` | 路由表与权限过滤 | 12 | ✅ |
| `src/router/__tests__/guards.test.ts` | 路由守卫工具 | 12 | ✅ |
| **合计** | | **176** | **100% 通过** |

RBAC 专项用例（API + Service + Store + Can）约 **127** 条。

---

## 五、覆盖率

| 指标 | 覆盖率 |
|---|---:|
| Statements | **73.48%**（657/894） |
| Branches | **53.97%**（156/289） |
| Functions | **73.89%**（184/249） |
| Lines | **74.42%**（617/829） |

RBAC 核心文件：

| 文件 | 语句 | 函数 | 行 |
|---|---:|---:|---:|
| `apis/modules/rbac.ts` | **100%** | **100%** | **100%** |
| `services/auth.ts` | 86.95% | 100% | 89.06% |
| `services/rbac/base.ts` | 84.84% | 66.66% | 89.65% |
| `services/rbac/user.ts` | 83.95% | 78.57% | 87.01% |
| `services/rbac/role.ts` | 87.50% | 92.30% | 90.76% |
| `services/rbac/permission.ts` | 78.37% | 92.85% | 77.94% |
| `store/modules/permission.ts` | 92.59% | 88.88% | **100%** |
| `store/modules/rbac.ts` | 92.53% | **100%** | **100%** |
| `components/common/Can.vue` | 100% | 100% | 100% |

> HTML 覆盖率报告：`docs/tests/rbac/coverage/index.html`
> 页面组件（`.vue` 业务页）未纳入单元覆盖，属于 E2E 范畴。

---

## 六、关键场景说明

### 6.1 权限上下文与前端状态

1. 登录只写 `access_token`，不写用户与权限（D12）。
2. `permissionStore.refreshPermissions()` 调用 `/users/me/permissions`，得到 `permissions: Set`、`isSuperuser`、`roles`、`permissionVersion`。
3. 权限加载失败时清空并阻止放行（路由守卫跳 403 并携带 `reason=permission`）。
4. 退出登录清空权限内存态。
5. `has/hasAny/hasAll` 对超管直通；非超管严格匹配权限码。

### 6.2 菜单 / 路由 / 按钮收敛

1. 路由 meta 使用 V2 权限码（`system.user:read` 等）。
2. 受限父路由仅在有已授权子路由时保留；菜单隐藏占位模块。
3. 用户/角色/权限页的所有写操作均以 `<Can>` 包裹，无权限时不渲染按钮。
4. 直接访问无权限路由 → `/403`，页面不泄露权限码。

### 6.3 用户管理（Plan Task 10）

- 角色列展示精简角色；超管标记；最后登录时间。
- 状态开关：无 `system.user:update` 或操作自己时禁用；二次确认后调用 `PUT /users/{id}`。
- 删除：自己不可删除（按钮禁用 + 后端 40304 双保险）。
- 分配角色：整体替换，内置角色带「内置」标记。

### 6.4 角色权限树（Plan Task 10）

- 使用 `/permissions/tree` 的模块分组与 `module_name`。
- 模块级三态全选、按权限码/名称搜索。
- `admin` 角色：权限矩阵只读，底部仅「关闭」。
- 内置角色：删除按钮禁用；后端返回 40303。
- 使用中角色：删除返回 40306 并提示用户数。

### 6.5 权限管理（Plan Task 10）

- 模块筛选（服务端 `module` 参数）与关键词搜索。
- 内置权限标记 `is_system`；删除按钮禁用。
- 权限码创建前端按 PRD 4.2 正则校验，后端 Mock 再次校验并返回 400。

---

## 七、Mock 测试发现并修复的问题

| # | 问题 | 影响 | 修复 |
|---|---|---|---|
| 1 | 旧实现基于 V1 OpenAPI，权限码为 `system:user:view` | 与 V2 PRD 不一致，菜单与后端对不上 | 全量切换为 `system.user:read` 等 63 条目录 |
| 2 | 登录响应携带 permissions 且 localStorage 缓存用户 | 违反 D6/D12，权限可能脏读 | 登录只存 Token；权限独立拉取、仅内存 |
| 3 | 缺少 `/users/me/permissions` 与 `/permissions/tree` | 前端无法做权限收敛与权限树 | 新增 API、Service、Store 与 Mock |
| 4 | 用户接口缺少更新/删除 | 无法启用/禁用、删除用户 | 按 7.2.3 / 7.4 补齐并实现自我保护 |
| 5 | 内置角色/权限可被删除或缩减 | 违反 D2/D5，有锁死风险 | Mock 返回 40303；UI 禁用删除/缩减 |
| 6 | 删除使用中的角色无提示 | 用户角色悬空 | Mock 返回 40306；UI 提示 user_count |
| 7 | 角色权限分组按 `code.split(':')` 解析 | `system.user:read` 被错误归为 `system` | 使用后端 `module` 字段分组 |
| 8 | 路由过滤器让空权限占位子路由保留受限父菜单 | 无权限用户仍看到系统管理 | 父路由需自身授权或存在「已授权」子路由 |
| 9 | 旧版 `BaseService` 与 RBAC 服务重复且无测试 | 死代码、覆盖率虚低 | 移除 `services/base.ts`，统一使用 `services/rbac/base.ts` |
| 10 | 测试间 Mock 数据污染 | 用例顺序依赖 | `resetMockData()` + 全局 `beforeEach` |
| 11 | 登录页仍用 AI 紫渐变与旧验证码字段 | 视觉与字段均不合规 | 品牌深蓝灰配色；`captcha_key/captcha_code` |

---

## 八、冒烟验证

| 检查项 | 结果 |
|---|---|
| `vue-tsc -b` | ✅ 0 错误 |
| `vite build` | ✅ 854ms，产物正常 |
| `npm run dev` | ✅ 就绪 |
| `GET /`、`/src/pages/system/index.vue`、`/mockServiceWorker.js` | ✅ 均 200 |

**未执行**：Playwright 浏览器 E2E（环境未安装浏览器内核）。建议后续安装后覆盖：登录（含验证码）→ 系统概览 → 用户启停/分配角色 → 角色权限树 → 权限筛选。

---

## 九、结论

1. **全 API 覆盖**：V2 规划的 27 个 RBAC 端点全部实现并被 Mock 测试覆盖，覆盖率 100%。
2. **授权能力落地**：权限上下文、权限树、菜单/路由/按钮收敛、403 兜底均已实现，权限不持久化。
3. **安全边界**：五类业务错误码（40302–40306）与 401 语义在 Mock 中可复现并被断言。
4. **质量指标**：176 条用例全部通过；RBAC API 模块行覆盖 100%，核心 Store 行覆盖 100%。
5. **后续建议**：
   - 后端按 Plan Task 1–7/11/12 落地后，用同一套契约做联调回归。
   - 补充浏览器 E2E 与 `admin/operator/viewer` 三账号的按钮级收敛验收（AC-23~AC-30）。
   - 将 `npm run test:coverage` 纳入 CI，对 `apis/modules` 与 `store/modules/permission.ts` 设 90% 行覆盖率阈值。

---

## 附录：运行方式

```bash
cd frontend
npm install
npm run test            # 176 条 Mock 测试
npm run test:coverage   # 覆盖率（输出 docs/tests/coverage）
npm run dev             # MSW Mock：admin / 123456（验证码显示在图片中）
npm run build           # 类型检查 + 生产构建
```
