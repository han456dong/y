# 辰光 Agent 平台 — 项目需求说明书 V2
## RBAC 授权能力增强版（PRD）

| 项目 | 内容 |
|---|---|
| 文档版本 | V2.0 |
| 文档状态 | 待评审（需求对齐稿） |
| 编写日期 | 2026-10-25 |
| 适用范围 | 辰光 Agent 平台前后端全量模块 |
| 本次主题 | 在现有认证与 RBAC 数据结构之上，补齐「授权（Authorization）」能力 |
| 交付物 | 本需求文档；本期不编写任何业务代码 |
| 关联文档 | `docs/PROJECT_SPEC.md`（V1 项目说明书）、`app/docs/09-系统管理.md`、`app/docs/10-API接口规范.md` |

> **阅读说明**
> 本文是 V2 版独立 PRD，可单独作为开发依据。第一部分说明为什么要做、现状差在哪里；第二部分给出授权模型与权限目录；第三部分逐项描述功能需求；第四部分给出数据、接口、前端改造规格；第五部分给出验收标准、里程碑、风险与决策记录。
>
> **需求对齐方式**：本稿采用「默认决策 + 可推翻」的方式推进。凡属文档作者补充的决策，均在文末《决策记录》中逐条列出并说明理由；评审时可直接推翻，不需要重新走一轮问答。

---

# 第一部分 背景、目标与范围

## 1. 背景

### 1.1 项目现状

辰光 Agent 平台是一个企业级 AI Agent 管理平台，包含 Agent 管理、模型管理、Prompt 管理、知识库（RAG）、工具管理、对话日志、数据统计和系统管理八个业务域。前后端分离：

- 后端：Python 3.13 + FastAPI + SQLAlchemy 2.0（异步）+ MySQL/SQLite + Redis + MinIO
- 前端：React 19 + TypeScript + Vite + Shadcn UI
- 统一响应：HTTP 200 + `{code, message, data}` 业务码（V1 约定）

### 1.2 已经具备的 RBAC 能力

项目已经完成 RBAC 的**数据模型**和**管理接口**：

| 能力 | 现状 | 代码位置 |
|---|---|---|
| 用户、角色、权限三张表 | 已实现 | `src/modules/user/model.py`、`src/modules/role/model.py`、`src/modules/permission/model.py` |
| 用户-角色、角色-权限多对多 | 已实现，复合主键防重 | `src/modules/role/model.py` |
| 登录（验证码 + JWT） | 已实现，Token 30 分钟 | `src/modules/auth/service.py`、`src/modules/captcha/` |
| 当前用户解析 | 已实现 `get_current_user` | `src/core/deps.py:16-35` |
| 用户 CRUD / 分配角色 | 已实现 | `src/modules/user/api.py` |
| 角色 CRUD / 分配权限 | 已实现 | `src/modules/role/api.py` |
| 权限 CRUD | 已实现 | `src/modules/permission/api.py` |
| 前端登录守卫 | 仅判断「是否登录」 | `app/src/components/AuthGuard.tsx` |
| 前端用户/角色/权限管理页 | 已对接真实后端 CRUD | `app/src/pages/system/` |
| 初始数据 | admin/operator 两个角色、13 条权限 | `init_data.py:26-44` |

### 1.3 真正缺失的是「授权」

当前系统只完成了「你是谁」（认证），没有完成「你能做什么」（授权）。具体证据：

| 缺口 | 现状证据 | 影响 |
|---|---|---|
| 业务接口不校验登录 | `src/modules/agent/api.py` 全部路由没有 `get_current_user` 依赖；model/prompt/knowledge/tool/provider 同样如此 | 未登录也能直接调用业务 CRUD |
| 没有权限码拦截 | 全仓库不存在 `require_permission`、`has_permission` 一类的依赖或装饰器 | 任何登录用户都能执行任何操作 |
| 超级管理员字段未使用 | `User.is_superuser` 存在（`src/modules/user/model.py:18`），但没有任何判断 | 无法区分超级管理员与普通管理员 |
| 权限码粒度不统一 | 种子数据同时存在 `user:list`、`role:assign`、`agent:*`（`init_data.py:31-44`） | 无法按操作精确授权 |
| 权限缺少结构化字段 | `Permission` 只有 `code/name/description`（`src/modules/permission/model.py`） | 无法按模块分组、无法生成权限树 |
| 前端菜单写死 | `app/src/layouts/DashboardLayout.tsx:34-53` 菜单项是常量数组 | 无权限用户仍能看到并进入所有菜单 |
| 前端无按钮级控制 | 各列表页的「新建/编辑/删除/发布」按钮无条件渲染 | 无权限用户能点到操作入口 |
| 前端 401 处理有漏洞 | `app/src/services/api/client.ts:25` 只判断 HTTP 401；而后端业务异常统一返回 HTTP 200 + code=401 | Token 过期时前端不会自动跳转登录 |
| 无权限变更后的失效机制 | 无缓存、无版本号 | 角色调整后无法保证下一次请求立即生效 |

### 1.4 本次要解决的问题

一句话：**把「登录即可用」升级为「按角色授予的最小权限可用」，并让前端界面随权限收敛。**

具体包括四件事：

1. 权限目录标准化：把散落的权限码整理成「模块 + 操作」的完整目录。
2. 后端强制鉴权：所有业务接口必须「已登录 + 拥有对应权限码」才能访问。
3. 前端权限收敛：菜单、路由、按钮按权限显示，越权访问进入 403 页面。
4. 管理端闭环：角色-权限分配升级为按模块分组的权限树；用户-角色分配、账号启停、内置资源保护形成闭环。

## 2. 目标与成功标准

### 2.1 目标

| 编号 | 目标 | 可衡量的结果 |
|---|---|---|
| G1 | 所有业务接口都受保护 | 未带 Token 调用任一业务接口返回 401；带 Token 但无权限返回 403 |
| G2 | 权限按最小粒度授予 | 63 条权限码覆盖 16 个模块；角色可按模块勾选具体操作 |
| G3 | 前端界面随权限收敛 | 无权限的菜单不显示、无权限的路由不可进、无权限的按钮不渲染 |
| G4 | 授权变更及时生效 | 角色/权限变更后，受影响用户最迟 10 分钟内生效；主动失效路径下一次请求立即生效 |
| G5 | 管理端可自助配置 | 管理员可在页面完成角色创建、权限勾选、用户分配角色、账号启停，无需改代码 |
| G6 | 关键安全边界成立 | 防自提权、防删除最后一个超管、内置角色/权限受保护 |

### 2.2 成功标准（验收视角）

- 使用 `admin` 登录：所有菜单、页面、按钮可见可用。
- 使用 `operator` 登录：只能看到业务模块，看不到系统管理；可创建/编辑/发布，不能删除；不能进入系统管理页面。
- 使用 `viewer` 登录：所有业务模块只读；所有「新建/编辑/删除/发布/测试」按钮不可见；直接输入创建页 URL 进入 403。
- 直接 `curl` 业务接口不带 Token：返回 401；带 viewer 的 Token 调删除接口：返回 403。
- 把 operator 的 `agent:create` 权限收回后，operator 下一次刷新页面，新建按钮消失，接口调用返回 403。
- 非超管无法给自己分配 admin 角色，无法修改内置角色，无法删除内置权限。

### 2.3 非目标（本期明确不做）

| 非目标 | 原因 |
|---|---|
| 数据行级权限（只能看自己创建的 Agent） | 需要业务表增加 owner 字段和数据过滤层，影响面远大于授权框架本身 |
| 字段级权限 / 敏感字段脱敏 | 本期无明确业务诉求 |
| 多租户隔离 | 平台当前是单租户部署 |
| SSO、LDAP、OAuth2 第三方登录 | 与本次授权主题无关 |
| API Key 的权限范围（scope） | 后端 API Key 模块尚未实现，权限模型先预留 `system.apikey:*` |
| 审批流（角色申请、权限审批） | 属于流程能力，不是 RBAC 核心 |
| Token 刷新机制 / 单点登出 | 现有 30 分钟 JWT 行为保持不变；登出仍是前端清除 Token |

### 2.4 反目标（即使技术上跑通，也算失败）

| 反目标 | 为什么算失败 |
|---|---|
| 只在前端隐藏按钮，后端不校验 | 任何人用 curl 都能绕过，等于没有授权 |
| 所有接口只校验「已登录」 | 无法区分运营和只读用户，不符合最小权限原则 |
| 权限码写死在代码里，新增模块必须改鉴权代码 | 无法自助配置，违背 RBAC 的初衷 |
| 默认放行、权限码不存在时静默通过 | 配置遗漏会变成安全漏洞 |
| 超管之外的任何角色都能修改内置角色/权限 | 一次误操作即可锁死平台 |
| 授权改造导致现有 admin 无法登录或大面积 403 | 上线即事故 |

---

# 第二部分 授权模型与权限目录

## 3. 术语与角色

### 3.1 术语

| 术语 | 含义 |
|---|---|
| 认证（Authentication） | 证明「你是谁」，本平台用 JWT 实现 |
| 授权（Authorization） | 判断「你能不能做这件事」，本平台用 RBAC 实现 |
| 用户（User） | 登录主体 |
| 角色（Role） | 权限的集合，用户通过角色获得权限 |
| 权限（Permission） | 一个可授权的原子操作，由权限码唯一标识 |
| 权限码（Permission Code） | 形如 `agent:create` 的字符串 |
| 超级管理员（Superuser） | `users.is_superuser = true` 的用户，绕过所有权限码校验 |
| 内置角色/权限 | 系统初始化创建、受保护、不可删除的角色/权限 |
| 越权 | 用户执行了超出其角色授权范围的操作 |
| 权限收敛 | 前端只展示当前用户有权访问的入口 |

### 3.2 内置角色

本期预置 3 个内置角色（`is_system = true`）：

| 角色编码 | 名称 | 定位 | 说明 |
|---|---|---|---|
| `admin` | 超级管理员 | 平台管理者 | 拥有全部 63 条权限；绑定 `is_superuser=true` 的账号可直接绕过校验 |
| `operator` | 运营人员 | 日常业务操作 | 业务模块的查看、创建、编辑、发布、测试；不能删除；不能进入系统管理 |
| `viewer` | 只读观察员 | 查看与汇报 | 所有业务模块只读；不能创建、编辑、删除、发布、测试 |

> **默认决策 D1**：V1 种子数据只有 `admin`、`operator`，本稿新增 `viewer`。理由是「只读用户」是 RBAC 演示和实际使用中最常见的第二类角色，没有它无法验证按钮级收敛。
>
> **默认决策 D2**：三个内置角色均设置 `is_system = true`，允许超管编辑其「名称/描述」，但禁止删除角色、禁止修改 `code`；`admin` 角色的权限集合固定为全量，不允许缩减，避免把自己锁在门外。

### 3.3 用户画像

| 画像 | 典型行为 | 对应角色 |
|---|---|---|
| 平台管理员 | 管理用户、角色、权限、系统配置 | admin |
| Agent 运营 | 创建和维护 Agent、Prompt、知识库、工具，做发布 | operator |
| 业务观察者 | 查看数据、看对话记录、导出报表 | viewer |
| 数据分析师（可选，由管理员自建） | 只看对话与统计 | 管理员按需创建角色 |

## 4. 权限模型

### 4.1 模型关系

```
User ──M:N──> Role ──M:N──> Permission
      user_roles     role_permissions
```

- 一个用户可以拥有多个角色。
- 一个角色可以拥有多条权限。
- **用户的有效权限 = 所有角色权限的并集**。
- 用户没有任何角色时，有效权限为空集：只能访问「仅需登录」的接口。
- `is_superuser = true` 时，跳过权限码判断，直接放行。

### 4.2 权限码规范

**格式**：`模块:操作`

- 模块：小写字母、数字、下划线；允许用点号分层，例如 `system.user`。
- 操作：小写字母、数字、下划线，例如 `read`、`create`、`update`、`delete`、`publish`、`test`、`assign`、`upload`、`export`、`annotate`。
- 正则约束（供实现校验）：`^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$`
- 权限码全局唯一，创建后不可修改（与现有 `PermissionUpdate` 不允许改 `code` 的约定一致）。

**操作动词词表**（统一语义，避免同义词扩散）：

| 操作 | 含义 | 典型接口 |
|---|---|---|
| `read` | 查看列表、详情、版本、分段 | GET |
| `create` | 新建资源 | POST 集合 |
| `update` | 修改资源、启停、改配置 | PUT / POST 动作 |
| `delete` | 删除资源 | DELETE |
| `publish` | 发布、回滚 | POST publish / rollback |
| `test` | 测试、试运行、检索测试、监控 | POST test / monitor |
| `assign` | 分配关系（给用户分配角色、给角色分配权限） | PUT 关系 |
| `upload` | 上传文件、重试解析 | POST 文件 |
| `export` | 导出 | GET 导出 |
| `annotate` | 标注 | POST 标注 |

> **默认决策 D3**：不再支持 `*` 通配权限码。V1 中的 `agent:*` 等将被迁移为具体权限码。理由：通配会让「权限树勾选」失去意义，也会让最小权限审计变困难；超级管理员的「全放行」由 `is_superuser` 承担，不需要通配符。

### 4.3 校验规则

后端判断顺序固定为：

1. Token 是否存在且有效？否 → 401。
2. 用户是否存在且 `is_active = true`？否 → 401。
3. 用户是否 `is_superuser = true`？是 → 放行。
4. 用户的有效权限码集合是否包含接口要求的权限码？否 → 403。
5. 通过。

补充规则：

- **精确匹配**：`agent:create` 不会匹配 `agent:read`，也不会匹配 `agent:*`。
- **默认拒绝**：接口声明了权限码，但当前用户权限集合取不到该码，一律拒绝。
- **不存在的权限码**：视为配置错误，启动时记录 ERROR 日志；运行时按拒绝处理，绝不静默放行。
- **多个权限码**：本期一个接口只声明一个权限码；若未来需要「满足其一」，在依赖层扩展为 OR 语义，不改变权限目录。

### 4.4 权限目录（63 条 / 16 个模块）

> 说明：`dashboard`、`conversation`、`analytics`、`system.apikey`、`system.audit`、`system.alert`、`system.settings` 的后端接口尚未实现，但权限码先纳入目录。前端可以先做菜单/路由收敛；后端接口实现时直接挂对应权限码。

| 模块 | 模块显示名 | 权限码 | 权限名称 | 说明 |
|---|---|---|---|---|
| dashboard | 工作台 | `dashboard:read` | 查看工作台 | 工作台大盘数据 |
| agent | Agent 管理 | `agent:read` | 查看 Agent | 列表、详情、版本列表 |
| agent | Agent 管理 | `agent:create` | 创建 Agent | 新建 Agent |
| agent | Agent 管理 | `agent:update` | 编辑 Agent | 修改、启动、停止 |
| agent | Agent 管理 | `agent:delete` | 删除 Agent | 删除 Agent |
| agent | Agent 管理 | `agent:publish` | 发布 Agent | 发布版本、回滚版本 |
| agent | Agent 管理 | `agent:test` | 测试 Agent | 对话测试、监控 |
| model | 模型管理 | `model:read` | 查看模型 | 模型列表、详情 |
| model | 模型管理 | `model:create` | 添加模型 | 新建模型 |
| model | 模型管理 | `model:update` | 编辑模型 | 修改模型 |
| model | 模型管理 | `model:delete` | 删除模型 | 删除模型 |
| model | 模型管理 | `model:test` | 测试模型 | 连接/效果测试 |
| provider | 供应商管理 | `provider:read` | 查看供应商 | 供应商列表、详情 |
| provider | 供应商管理 | `provider:create` | 创建供应商 | 新建供应商 |
| provider | 供应商管理 | `provider:update` | 编辑供应商 | 修改供应商 |
| provider | 供应商管理 | `provider:delete` | 删除供应商 | 删除供应商 |
| provider | 供应商管理 | `provider:test` | 测试供应商 | 测试连接 |
| prompt | Prompt 管理 | `prompt:read` | 查看 Prompt | 列表、详情、版本列表 |
| prompt | Prompt 管理 | `prompt:create` | 创建 Prompt | 新建 Prompt |
| prompt | Prompt 管理 | `prompt:update` | 编辑 Prompt | 修改 Prompt |
| prompt | Prompt 管理 | `prompt:delete` | 删除 Prompt | 删除 Prompt |
| prompt | Prompt 管理 | `prompt:publish` | 发布 Prompt | 发布版本、回滚版本 |
| knowledge | 知识库管理 | `knowledge:read` | 查看知识库 | 知识库、文档、分段查看 |
| knowledge | 知识库管理 | `knowledge:create` | 创建知识库 | 新建知识库 |
| knowledge | 知识库管理 | `knowledge:update` | 编辑知识库 | 修改知识库、改配置、编辑分段 |
| knowledge | 知识库管理 | `knowledge:delete` | 删除知识库 | 删除知识库、文档、分段 |
| knowledge | 知识库管理 | `knowledge:upload` | 上传文档 | 上传文档、重试解析 |
| knowledge | 知识库管理 | `knowledge:test` | 检索测试 | 检索效果测试 |
| tool | 工具管理 | `tool:read` | 查看工具 | 工具列表、详情 |
| tool | 工具管理 | `tool:create` | 注册工具 | 新建工具 |
| tool | 工具管理 | `tool:update` | 编辑工具 | 修改、启用、禁用 |
| tool | 工具管理 | `tool:delete` | 删除工具 | 删除工具 |
| tool | 工具管理 | `tool:test` | 测试工具 | 调用测试 |
| conversation | 对话日志 | `conversation:read` | 查看对话 | 对话列表、详情 |
| conversation | 对话日志 | `conversation:annotate` | 标注对话 | 标注、评价 |
| conversation | 对话日志 | `conversation:export` | 导出对话 | 导出记录 |
| analytics | 数据统计 | `analytics:read` | 查看统计 | 用量、费用、评估 |
| analytics | 数据统计 | `analytics:export` | 导出统计 | 导出报表 |
| system.user | 用户管理 | `system.user:read` | 查看用户 | 用户列表、详情、角色 |
| system.user | 用户管理 | `system.user:create` | 创建用户 | 新建用户 |
| system.user | 用户管理 | `system.user:update` | 编辑用户 | 修改资料、启用/禁用 |
| system.user | 用户管理 | `system.user:delete` | 删除用户 | 删除用户 |
| system.user | 用户管理 | `system.user:assign` | 分配角色 | 给用户分配角色 |
| system.role | 角色管理 | `system.role:read` | 查看角色 | 角色列表、详情 |
| system.role | 角色管理 | `system.role:create` | 创建角色 | 新建角色 |
| system.role | 角色管理 | `system.role:update` | 编辑角色 | 修改角色 |
| system.role | 角色管理 | `system.role:delete` | 删除角色 | 删除角色 |
| system.role | 角色管理 | `system.role:assign` | 分配权限 | 给角色分配权限 |
| system.permission | 权限管理 | `system.permission:read` | 查看权限 | 权限列表、权限树 |
| system.permission | 权限管理 | `system.permission:create` | 创建权限 | 新建权限 |
| system.permission | 权限管理 | `system.permission:update` | 编辑权限 | 修改名称/描述 |
| system.permission | 权限管理 | `system.permission:delete` | 删除权限 | 删除非内置权限 |
| system.apikey | API 密钥 | `system.apikey:read` | 查看密钥 | API Key 列表 |
| system.apikey | API 密钥 | `system.apikey:create` | 创建密钥 | 新建 API Key |
| system.apikey | API 密钥 | `system.apikey:update` | 编辑密钥 | 修改、启停 |
| system.apikey | API 密钥 | `system.apikey:delete` | 删除密钥 | 删除 API Key |
| system.audit | 审计日志 | `system.audit:read` | 查看审计 | 审计日志查看 |
| system.alert | 告警规则 | `system.alert:read` | 查看告警 | 告警规则列表 |
| system.alert | 告警规则 | `system.alert:create` | 创建告警 | 新建告警规则 |
| system.alert | 告警规则 | `system.alert:update` | 编辑告警 | 修改、启停 |
| system.alert | 告警规则 | `system.alert:delete` | 删除告警 | 删除告警规则 |
| system.settings | 系统配置 | `system.settings:read` | 查看配置 | 系统配置查看 |
| system.settings | 系统配置 | `system.settings:update` | 修改配置 | 系统配置修改 |

> **计数口径**：上表共 63 条。后续新增模块时，权限目录同步增加；权限目录是「系统能力清单」，不是「代码里的枚举」，允许管理员在页面新增自定义权限码，但内置权限不可删除。

### 4.5 内置角色权限矩阵

✅ = 拥有，— = 不拥有。

| 模块 | 权限 | admin | operator | viewer |
|---|---|:---:|:---:|:---:|
| dashboard | `dashboard:read` | ✅ | ✅ | ✅ |
| agent | `agent:read` | ✅ | ✅ | ✅ |
| agent | `agent:create` | ✅ | ✅ | — |
| agent | `agent:update` | ✅ | ✅ | — |
| agent | `agent:delete` | ✅ | — | — |
| agent | `agent:publish` | ✅ | ✅ | — |
| agent | `agent:test` | ✅ | ✅ | — |
| model | `model:read` | ✅ | ✅ | ✅ |
| model | `model:create` | ✅ | — | — |
| model | `model:update` | ✅ | — | — |
| model | `model:delete` | ✅ | — | — |
| model | `model:test` | ✅ | ✅ | — |
| provider | `provider:read` | ✅ | ✅ | — |
| provider | `provider:create` | ✅ | — | — |
| provider | `provider:update` | ✅ | — | — |
| provider | `provider:delete` | ✅ | — | — |
| provider | `provider:test` | ✅ | ✅ | — |
| prompt | `prompt:read` | ✅ | ✅ | ✅ |
| prompt | `prompt:create` | ✅ | ✅ | — |
| prompt | `prompt:update` | ✅ | ✅ | — |
| prompt | `prompt:delete` | ✅ | — | — |
| prompt | `prompt:publish` | ✅ | ✅ | — |
| knowledge | `knowledge:read` | ✅ | ✅ | ✅ |
| knowledge | `knowledge:create` | ✅ | ✅ | — |
| knowledge | `knowledge:update` | ✅ | ✅ | — |
| knowledge | `knowledge:delete` | ✅ | — | — |
| knowledge | `knowledge:upload` | ✅ | ✅ | — |
| knowledge | `knowledge:test` | ✅ | ✅ | — |
| tool | `tool:read` | ✅ | ✅ | ✅ |
| tool | `tool:create` | ✅ | ✅ | — |
| tool | `tool:update` | ✅ | ✅ | — |
| tool | `tool:delete` | ✅ | — | — |
| tool | `tool:test` | ✅ | ✅ | — |
| conversation | `conversation:read` | ✅ | ✅ | ✅ |
| conversation | `conversation:annotate` | ✅ | ✅ | — |
| conversation | `conversation:export` | ✅ | — | — |
| analytics | `analytics:read` | ✅ | ✅ | ✅ |
| analytics | `analytics:export` | ✅ | ✅ | — |
| system.* | 全部 22 条 | ✅ | — | — |

> **默认决策 D4**：`operator` 不拥有任何 `delete` 权限，删除一律留给 `admin`。理由：删除是不可逆操作，演示环境和真实运营场景都不应默认授予。
>
> **默认决策 D5**：`admin` 角色固定拥有全部 63 条权限，且不允许通过「分配权限」界面缩减。真正的兜底是 `is_superuser`，角色权限集合只用于展示和审计。

## 5. 授权范围边界

### 5.1 本期范围（P0 / P1）

| 优先级 | 范围 | 交付形态 |
|---|---|---|
| P0 | 权限目录标准化 + 数据迁移 + 种子数据 | 数据库变更、初始化脚本 |
| P0 | 后端接口强制鉴权（现有全部业务接口） | 鉴权依赖、路由改造 |
| P0 | 当前用户权限查询接口 | 新增 API |
| P0 | 前端菜单/路由/按钮按权限收敛 | 前端改造 |
| P0 | 内置角色/权限保护、防自提权、最后超管保护 | 服务层规则 |
| P1 | 权限缓存与主动失效 | Redis 缓存 |
| P1 | 角色-权限分配树、用户角色/状态管理 | 管理端页面增强 |
| P1 | 403 页面、401/403 语义化处理 | 前端改造 |
| P1 | RBAC 灰度开关（`RBAC_ENFORCE`） | 配置项 |
| P2 | 授权失败审计日志 | 后续迭代 |
| P2 | 数据行级权限、API Key scope | 后续迭代 |

### 5.2 不做（重申）

见 2.3。尤其强调：本期不引入行级数据权限，不做多租户，不做 SSO。

---

# 第三部分 功能需求

> 编号规则：FR-xx。每条需求包含「描述 / 规则 / 涉及面 / 验收」。验收细节汇总见第 10 章。

## FR-01 登录后获取当前用户权限

**描述**：用户登录成功后，前端需要拿到当前用户的身份、角色、超级管理员标记和有效权限码集合，用于驱动菜单、路由和按钮。

**规则**：

1. 新增接口 `GET /api/v1/users/me/permissions`，仅需登录，不需要额外权限码。
2. 返回内容包含：用户 ID、用户名、`is_superuser`、角色列表（id/code/name）、有效权限码列表（去重、排序）。
3. 权限码来源：用户所有角色的权限并集；`is_superuser=true` 时返回全部权限码，并额外返回 `is_superuser=true` 供前端直接放行。
4. 该接口不得返回密码、密码哈希等敏感字段。
5. 登录接口 `POST /auth/login` 的响应保持不变，不把权限塞进 JWT。

> **默认决策 D6**：JWT 只携带 `sub/username/email`，不携带权限码。理由：权限会随管理员操作变化，塞进 Token 会导致「改了权限但旧 Token 仍生效」；JWT 也没有可靠的主动失效手段。

**涉及面**：后端新增接口；前端登录流程、应用启动流程。

**验收**：

- admin 调用返回 63 条权限码且 `is_superuser=true`。
- viewer 调用只返回 9 条只读权限码，`is_superuser=false`。
- 未登录调用返回 401。
- 同一用户重复调用，权限码顺序稳定（便于前端做 diff）。

## FR-02 后端接口强制鉴权

**描述**：除公开白名单外，所有后端接口必须校验「已登录 + 拥有接口声明的权限码」。

**规则**：

1. 鉴权依赖统一为一个可复用的依赖工厂，接口声明所需权限码；禁止每个接口手写 if 判断。
2. 校验顺序见 4.3。
3. 公开白名单（不需要 Token）：
   - `GET /health`
   - `POST /api/v1/auth/login`
   - `GET /api/v1/captcha`
   - `POST /api/v1/captcha`
4. 仅需登录、不需要权限码的接口：
   - `GET /api/v1/users/me`
   - `GET /api/v1/users/me/permissions`
5. 其余全部接口必须声明权限码，映射见 7.4。
6. 未声明权限码的业务接口视为配置错误：启动时输出 WARN 清单；运行时不放行（默认拒绝）。
7. 鉴权失败不得泄露内部信息（不返回 SQL、堆栈、用户权限明细）。

**涉及面**：`src/core/deps.py`、所有 `src/modules/*/api.py`、异常处理、`src/main.py` 启动检查。

**验收**：

- 遍历 7.4 的接口表，未带 Token 全部返回 401（公开白名单除外）。
- 用 viewer 的 Token 调用每个写接口，全部返回 403。
- 用 viewer 的 Token 调用只读接口，全部成功。
- 用 admin 的 Token 调用全部接口，全部成功。
- 启动日志能看到「已保护接口数 / 未声明权限码接口数」。

## FR-03 权限缓存与失效

**描述**：避免每个请求都查三张表，同时保证权限变更后能及时生效。

**规则**：

1. 缓存键按用户维度：`rbac:perms:{perm_version}:{user_id}`。
2. 缓存值包含：`is_superuser`、权限码数组、角色编码数组、生成时间。
3. TTL 建议 600 秒（10 分钟），可配置。
4. 全局权限版本键 `rbac:perm_version`：
   - 角色-权限关系变更、权限目录增删改、内置角色权限调整时，版本号 +1。
   - 版本号变化后，旧缓存键自然失效，无需扫描删除。
5. 用户-角色关系变更、用户启用/禁用/删除时，直接删除该用户的缓存键。
6. Redis 不可用时不阻断业务：回退到数据库查询，记录 WARN 日志；数据库也失败时返回 500。
7. 缓存内容不得包含密码等敏感信息。
8. 提供管理员手动「刷新权限缓存」的能力（可放在系统配置页，P1 可选）。

> **默认决策 D7**：采用「全局版本号 + 用户键删除」的混合失效策略，而不是遍历删除。理由：角色权限变更影响面可能很大，版本号一次性失效最可靠；用户维度变更则精确删除，避免误伤。

**涉及面**：`src/infra/redis_cache.py`、授权服务、角色/权限/用户服务。

**验收**：

- 连续两次请求同一用户接口，第二次命中缓存（日志可见）。
- 修改角色权限后，受影响用户下一次请求使用新权限（版本号已变）。
- 修改用户角色后，该用户下一次请求使用新角色（键已删）。
- 停掉 Redis 后，鉴权仍能工作（走数据库），并输出 WARN。
- 缓存中的权限码与数据库一致。

## FR-04 前端菜单与路由收敛

**描述**：前端根据当前用户权限决定「菜单是否显示」和「路由是否可进入」。

**规则**：

1. 侧边栏菜单项增加 `permission` 元数据；渲染前过滤。
2. 「系统管理」父菜单：只要拥有任意 `system.*` 权限就显示；子菜单按各自权限显示。
3. 路由增加权限守卫：进入路由前检查权限，不满足时进入 403 页面，不渲染页面内容。
4. 路由权限映射见 8.2。
5. 权限数据尚未加载完成时，显示加载态，不得先渲染再闪烁隐藏。
6. 权限加载失败（网络/后端异常）时：
   - 若因 401，清除 Token 并跳转登录。
   - 其他错误显示「权限加载失败，请重试」，不默认放行。
7. 直接输入无权限的 URL，必须进入 403，不得短暂显示页面内容。

**涉及面**：`app/src/App.tsx`、`app/src/layouts/DashboardLayout.tsx`、新增权限上下文与路由守卫组件。

**验收**：

- viewer 登录后侧边栏没有「系统管理」。
- operator 登录后系统管理不可见；直接访问 `/system/users` 进入 403。
- admin 登录后全部菜单可见。
- 刷新页面时无「菜单先全量显示再消失」的闪烁。
- 后端不可用时不会显示全量菜单（默认拒绝）。

## FR-05 按钮级权限

**描述**：页面内的操作按钮按权限渲染。无权限时按钮不显示（而不是置灰），避免用户反复尝试。

**规则**：

1. 提供统一的权限判断能力：`has(code)`、`hasAny(codes)`、`hasAll(codes)`、`isSuperuser`。
2. 提供声明式组件：`<Can permission="agent:create">...</Can>`，可选 `fallback`。
3. 按钮权限矩阵见 8.4；页面开发必须按矩阵包裹。
4. 表格行内操作、批量操作、空状态引导按钮、详情页操作按钮都要覆盖。
5. 表单提交按钮与对应接口权限保持一致；禁止「按钮可见但接口必然 403」。
6. 前端隐藏只是体验层，不能替代后端校验。

**涉及面**：全部业务列表页/详情页/创建页；新增权限 Hook 与 `Can` 组件。

**验收**：

- viewer 在 Agent 列表页看不到「新建」「编辑」「删除」「发布」「测试」。
- operator 看得到「新建/编辑/发布/测试」，看不到「删除」。
- admin 全部可见。
- 权限变更并刷新后，按钮状态随之变化。

## FR-06 403 与 401 处理

**描述**：统一处理「未登录」和「无权限」两类错误，给出明确反馈。

**规则**：

1. HTTP 语义：
   - 未登录/Token 无效/过期：HTTP 401，业务码 `40100`。
   - 账号被禁用：HTTP 401，业务码 `40101`。
   - 已登录但无权限：HTTP 403，业务码 `40300`（通用）或 `40301`（缺少指定权限）。
2. 其余业务异常保持 V1 约定：HTTP 200 + 业务码。
3. 前端 API 客户端：
   - HTTP 401 → 清除 Token → 跳转 `/login`，并记录回跳地址。
   - HTTP 403 → 解析响应体 message → 弹出提示；路由级无权限进入 `/403`。
   - 业务码 `401xx` / `403xx` 也做同样处理，防止后端状态码配置遗漏。
4. 新增 `/403` 页面：说明「没有访问权限」，提供「返回工作台」按钮；不暴露需要什么权限码。
5. 不在 403 页面展示当前用户的权限清单。

**涉及面**：`src/core/exceptions.py`、`app/src/services/api/client.ts`、新增 403 页面、路由。

**验收**：

- Token 过期后调用任意接口，自动回到登录页。
- 无权限调用接口，出现明确提示，不跳登录页。
- 直接访问无权限路由，进入 403 页面。
- 403 页面不泄露权限码细节。

## FR-07 角色-权限分配

**描述**：管理员在角色管理页为角色勾选权限，界面按模块分组，支持全选/半选/搜索。

**规则**：

1. 数据来源：`GET /api/v1/permissions/tree`，按模块分组返回。
2. 交互：
   - 左侧/上方展示模块分组，每组可全选/取消全选。
   - 模块内展示具体权限，带名称、权限码、说明。
   - 已选数量 / 总数实时显示。
   - 支持按权限码/名称搜索过滤。
   - 保存采用「整体替换」语义（与现有接口一致）。
3. 内置角色 `admin`：权限勾选区只读，展示「内置角色拥有全部权限」。
4. 内置角色 `operator` / `viewer`：允许调整权限，但删除角色/改编码被禁止。
5. 保存成功后：刷新角色列表、刷新当前用户权限（若当前用户受影响）、提示「权限已更新，相关用户最迟 10 分钟内生效」。
6. 权限分配失败（含无效权限 ID）要给出明确错误，不静默部分保存。

**涉及面**：`app/src/pages/system/Roles.tsx`、角色服务、权限树接口。

**验收**：

- 勾选/取消模块全选状态正确（全选、半选、未选三态）。
- 保存后重新打开，勾选状态与保存一致。
- 给 operator 增加 `agent:delete` 后，operator 刷新页面能看到删除按钮，接口也允许删除。
- 给 operator 移除 `agent:create` 后，新建按钮消失，接口返回 403。
- admin 角色的权限区不可编辑。

## FR-08 用户-角色分配与账号状态

**描述**：管理员可以给用户分配一个或多个角色，并启用/禁用账号。

**规则**：

1. 用户列表新增「角色」列，展示角色名称（多角色用逗号或标签）。
2. 分配角色：多选，支持搜索；保存整体替换；至少保留一个角色？——不强制，允许用户暂时无角色（此时只能访问需登录接口）。
3. 禁用/启用用户：
   - 新增 `PUT /api/v1/users/{id}`，允许修改 `email`、`is_active`。
   - 禁用后，该用户已有 Token 在下一次请求时返回 401（账号已禁用）。
   - 禁用/删除用户时，删除其权限缓存。
4. 安全限制：
   - 用户不能禁用/删除自己。
   - 用户不能修改自己的角色（防止自提权）。
   - 非超管不能把 `admin` 角色分配给任何人。
   - 系统必须保留至少一个启用的超级管理员。
5. 用户列表搜索、分页保持现有行为。

**涉及面**：`src/modules/user/`、`app/src/pages/system/Users.tsx`。

**验收**：

- admin 可以给用户分配 operator + viewer 两个角色，权限为两者并集。
- 被禁用用户再次请求接口返回 401。
- admin 不能禁用自己，接口返回明确错误。
- 非超管调用分配 admin 角色接口返回 403。
- 删除最后一个超管被拒绝。

## FR-09 权限目录管理

**描述**：管理员可以查看、创建、编辑、删除权限；系统内置权限受保护。

**规则**：

1. 权限列表增加：
   - 模块列（显示模块名，颜色区分）。
   - 权限码列。
   - 内置标记。
   - 操作列（编辑/删除）。
2. 筛选：按模块筛选、按关键词搜索。
3. 创建权限：
   - 输入权限码（校验格式）、名称、描述。
   - 后端从权限码解析 `module` 与 `action` 并落库；解析失败拒绝创建。
   - 权限码全局唯一，重复报错。
4. 编辑权限：只能改名称、描述，不能改权限码、模块、操作。
5. 删除权限：
   - 内置权限禁止删除。
   - 删除前提示「将同时从所有角色中移除该权限」。
   - 删除后角色-权限关联级联清理，并刷新权限缓存版本。
6. 内置权限清单以本文 4.4 为准；初始化后 `is_system=true`。

**涉及面**：`src/modules/permission/`、`app/src/pages/system/Permissions.tsx`。

**验收**：

- 内置权限显示锁标识，删除按钮不可用。
- 创建 `custom:read` 成功，模块自动归为 `custom`。
- 创建 `Agent:Create` 或 `agent`（无冒号）失败，提示格式错误。
- 删除自定义权限后，角色详情中不再出现该权限。

## FR-10 安全边界与越权防护

**描述**：授权功能本身不能成为提权通道，必须设置硬性边界。

**规则**：

1. **防自提权**：用户不能修改自己的角色；非超管不能分配/创建 `is_system=true` 的角色；非超管不能持有 `system.role:assign` 且同时能修改角色定义（默认矩阵已保证只有 admin 有系统权限）。
2. **最后超管保护**：系统必须至少保留一个 `is_superuser=true` 且 `is_active=true` 的用户；删除、禁用、取消超管标记的操作若会导致 0 个超管，拒绝。
3. **内置资源保护**：
   - 内置角色不可删除、不可改 `code`。
   - 内置权限不可删除、不可改 `code`。
   - `admin` 角色权限集合不可缩减。
4. **自我操作保护**：不能删除自己、不能禁用自己、不能移除自己的全部角色（若该操作会导致自己失去所有系统管理权限，提示风险但仍允许？——本稿选择禁止直接自我降权，需由另一位超管操作）。
5. **敏感接口二次确认**：删除角色、删除用户、重置权限需要前端二次确认。
6. **错误信息最小化**：403 响应只说明「无权限」，不返回用户缺少的具体权限码列表（便于排查可在服务端日志记录）。
7. **审计留痕（P2）**：授权失败、角色/权限变更、用户角色变更写入审计日志；本期至少保证服务端日志包含操作者、目标、结果。

> **默认决策 D8**：本期采用「禁止自我降权」而不是「允许但提示」。理由：演示/单管理员环境下，误操作导致锁死的代价远高于便利性；需要降权时由另一位超管操作。

**涉及面**：用户服务、角色服务、权限服务、鉴权依赖。

**验收**：

- admin 尝试删除自己 → 拒绝。
- admin 尝试禁用自己 → 拒绝。
- 唯一超管尝试取消自己的 `is_superuser` → 拒绝。
- 非超管尝试修改 admin 角色 → 拒绝。
- 删除内置权限 → 拒绝。
- 普通用户给自己分配 admin 角色 → 拒绝。

## FR-11 授权审计（P2，本期只留接口位）

**描述**：记录「谁在什么时间尝试了什么操作，结果如何」，用于安全审计和问题排查。

**本期要求**：

1. P0/P1 不建审计表，但服务端日志必须记录：
   - 时间、用户 ID、用户名、HTTP 方法、路径、所需权限码、结果（通过/拒绝）、来源 IP。
2. P2 再落库为 `audit_logs`，字段建议：用户、动作、模块、目标 ID、结果、IP、User-Agent、时间。
3. 前端 `/system/audit` 页面本期保持 Mock 或「待实现」状态，不接真实接口。

**验收**：

- 一次 403 请求能在后端日志中看到用户、路径、权限码、拒绝原因。
- 日志不包含 Token 明文、密码。

## FR-12 Mock 模式兼容

**描述**：前端默认 `VITE_USE_MOCK=true`，授权改造不能破坏 Mock 开发体验。

**规则**：

1. Mock 认证服务提供 `getPermissions()`，返回全部 63 条权限码，`is_superuser=true`。
2. Mock 模式下菜单、路由、按钮全部可见，行为与真实 admin 一致。
3. Mock 模式下不发起真实权限接口请求。
4. 切换到真实后端（`VITE_USE_MOCK=false`）时，权限流程自动生效，无需改页面代码。
5. Mock 数据中的角色/权限字段与后端类型保持镜像（`id/code/name/description/module/action/is_system`）。

**验收**：

- `npm run dev` 默认 Mock 模式，所有页面功能不退化。
- 关闭 Mock 后，viewer 账号登录看到收敛后的界面。
- 两种模式切换不需要修改页面组件。

---

# 第四部分 数据、接口与前端规格

## 6. 数据模型变更

### 6.1 `permissions` 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK, 自增 | 沿用 BaseModel |
| `code` | VARCHAR(100) | UNIQUE, NOT NULL | 权限码，如 `system.user:read` |
| `name` | VARCHAR(100) | NOT NULL | 权限名称 |
| `description` | VARCHAR(200) | NULL | 描述 |
| `module` | VARCHAR(50) | NOT NULL, INDEX | 模块标识，如 `system.user` |
| `action` | VARCHAR(50) | NOT NULL | 操作标识，如 `read` |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT TRUE | 是否内置 |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | 排序，模块内展示用 |
| `created_at` | DATETIME | NOT NULL | 沿用 BaseModel |
| `updated_at` | DATETIME | NOT NULL | 沿用 BaseModel |

索引建议：

- `UNIQUE(code)`（已有）
- `INDEX(module, sort_order)`
- `INDEX(is_system)`

### 6.2 `roles` 表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `is_system` | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否内置角色 |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | 展示排序 |

其余字段不变（`code`、`name`、`description`）。

> **默认决策 D9**：不给角色增加 `data_scope`（数据范围）字段。行级权限不在本期范围，提前加字段会让实现者误以为需要处理数据过滤。

### 6.3 `users` 表

不新增字段。`is_superuser` 已存在（`src/modules/user/model.py:18`），本期开始真正参与鉴权。

### 6.4 关联表

`user_roles`、`role_permissions` 结构不变；删除角色/权限时依赖现有 `ON DELETE CASCADE` 清理关联。

### 6.5 数据迁移步骤（供实现阶段参考，不在本期执行）

1. 新增列：`permissions.module/action/is_system/sort_order`、`roles.is_system/sort_order`，均给默认值，保证旧数据可读。
2. 回填：从 `code` 前缀解析 `module`、`action`；解析失败的旧权限码记录日志并保留。
3. 插入 4.4 的 63 条内置权限（幂等）。
4. 把旧权限码映射到新权限码：
   - `user:list` → `system.user:read`
   - `user:create` → `system.user:create`
   - `user:update` → `system.user:update`
   - `user:delete` → `system.user:delete`
   - `role:list` → `system.role:read`
   - `role:assign` → `system.role:assign`
   - `permission:list` → `system.permission:read`
   - `agent:*` → `agent:read/create/update/delete/publish/test`
   - `model:*` → `model:read/create/update/delete/test`
   - `prompt:*` → `prompt:read/create/update/delete/publish`
   - `knowledge:*` → `knowledge:read/create/update/delete/upload/test`
   - `tool:*` → `tool:read/create/update/delete/test`
5. 重挂角色权限：
   - `admin` → 全部 63 条。
   - `operator` → 按 4.5 矩阵。
   - `viewer` → 按 4.5 矩阵（若不存在则创建）。
6. 标记内置：63 条权限与 3 个角色 `is_system=true`。
7. 清理旧权限码（确认无角色引用后再删除；本次保留只读归档也可以）。
8. 更新 `init_data.py` 的种子数据，保证全新环境初始化即为新结构。
9. 迁移必须可重复执行（幂等），失败可回滚。

## 7. API 规格

### 7.1 通用约定

**响应包装**（不变）：

```json
{ "code": 200, "message": "success", "data": {} }
```

**认证错误**（本期新增语义化状态码）：

| 场景 | HTTP 状态 | code | message |
|---|---:|---|---|
| 未带 Token | 401 | 40100 | 未登录或 Token 已失效 |
| Token 无效/过期 | 401 | 40100 | 未登录或 Token 已失效 |
| 账号被禁用 | 401 | 40101 | 账号已被禁用 |
| 缺少权限码 | 403 | 40301 | 无权限执行该操作 |
| 通用越权 | 403 | 40302 | 越权操作 |
| 内置资源保护 | 403 | 40303 | 内置资源不允许该操作 |
| 自我操作保护 | 403 | 40304 | 不允许对自己执行该操作 |
| 最后超管保护 | 403 | 40305 | 系统必须保留至少一个超级管理员 |
| 角色仍被用户使用 | 409 | 40306 | 角色仍被用户使用，无法删除 |

> **默认决策 D10**：认证/授权错误使用真实 HTTP 401/403，其余业务错误维持 HTTP 200 + 业务码。理由：前端拦截器需要区分「回登录页」和「提示无权限」，语义化状态码最可靠；同时保留业务码便于日志与前端二次判断。

### 7.2 新增接口

#### 7.2.1 获取当前用户权限

`GET /api/v1/users/me/permissions`

- 鉴权：仅需登录。
- 响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "user_id": 1,
    "username": "admin",
    "is_superuser": true,
    "roles": [
      { "id": 1, "code": "admin", "name": "超级管理员" }
    ],
    "permissions": ["agent:create", "agent:read", "..."],
    "permission_version": 12,
    "cached_at": "2026-10-25T10:00:00+08:00"
  }
}
```

说明：

- `permissions` 去重、按字典序排序。
- `permission_version` 用于前端判断是否需要刷新。
- `cached_at` 便于排查缓存问题。

#### 7.2.2 权限树

`GET /api/v1/permissions/tree`

- 鉴权：`system.permission:read` 或 `system.role:assign`（满足其一即可；本期实现为 `system.permission:read`）。
- 响应：

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "module": "agent",
      "module_name": "Agent 管理",
      "permissions": [
        { "id": 2, "code": "agent:read", "name": "查看 Agent", "action": "read", "is_system": true }
      ]
    }
  ]
}
```

- 模块按固定顺序返回，模块内按 `sort_order`、`id` 排序。
- 无权限码的模块不返回。

#### 7.2.3 更新用户（新增）

`PUT /api/v1/users/{user_id}`

- 鉴权：`system.user:update`
- 请求：

```json
{ "email": "new@example.com", "is_active": false }
```

- 规则：
  - 字段均可选，只更新传入字段。
  - 不能禁用自己。
  - 不能让超管数量归零。
  - 邮箱唯一性校验沿用现有逻辑。
- 响应：`UserRead`（含角色与 `is_superuser`）。

#### 7.2.4 可选新增（P1）

| 接口 | 说明 | 权限 |
|---|---|---|
| `POST /api/v1/auth/logout` | 服务端可选黑名单（P2，本期前端清 Token 即可） | 登录 |
| `PUT /api/v1/users/{id}/password` | 管理员重置密码（P2） | `system.user:update` |
| `POST /api/v1/roles/{id}/users` | 角色关联用户列表（若角色删除提示需要） | `system.role:read` |

### 7.3 既有接口的响应扩展

| Schema | 新增字段 | 说明 |
|---|---|---|
| `PermissionRead` | `module`、`action`、`is_system`、`sort_order` | 前端模块分组、内置标记 |
| `RoleRead` | `is_system`、`user_count` | 内置标记、删除前提示用户数 |
| `UserRead` | `roles`（精简）、`is_superuser`、`last_login` | 用户列表展示角色与状态 |
| `UserWithRolesRead` | `is_superuser`、`last_login` | 详情页 |
| `TokenResponse` | 不变 | 不塞权限 |

> **默认决策 D11**：`UserRead` 直接带精简角色和 `is_superuser`，避免用户列表 N+1 查询。角色精简结构只含 `id/code/name`，不嵌套权限，避免响应膨胀。

### 7.4 接口-权限映射（全量）

> 前缀统一为 `/api/v1`。标注「公开」的接口不需要 Token；标注「登录」的接口只需要 Token。

| 模块 | 方法与路径 | 权限码 | 备注 |
|---|---|---|---|
| 健康检查 | `GET /health` | 公开 | 不在 /api/v1 下 |
| 认证 | `POST /auth/login` | 公开 | |
| 验证码 | `GET /captcha` | 公开 | |
| 验证码 | `POST /captcha` | 公开 | |
| 用户 | `GET /users/me` | 登录 | 当前用户信息 |
| 用户 | `GET /users/me/permissions` | 登录 | 新增 |
| 用户 | `POST /users` | `system.user:create` | |
| 用户 | `GET /users/search` | `system.user:read` | |
| 用户 | `GET /users` | `system.user:read` | |
| 用户 | `GET /users/{user_id}` | `system.user:read` | |
| 用户 | `GET /users/{user_id}/roles` | `system.user:read` | |
| 用户 | `PUT /users/{user_id}` | `system.user:update` | 新增 |
| 用户 | `PUT /users/{user_id}/roles` | `system.user:assign` | |
| 用户 | `DELETE /users/{user_id}` | `system.user:delete` | |
| 角色 | `GET /roles/search` | `system.role:read` | |
| 角色 | `GET /roles/` | `system.role:read` | |
| 角色 | `GET /roles/{role_id}` | `system.role:read` | |
| 角色 | `POST /roles` | `system.role:create` | |
| 角色 | `PUT /roles/{role_id}` | `system.role:update` | |
| 角色 | `PUT /roles/{role_id}/permissions` | `system.role:assign` | |
| 角色 | `DELETE /roles/{role_id}` | `system.role:delete` | |
| 权限 | `GET /permissions/search` | `system.permission:read` | |
| 权限 | `GET /permissions/` | `system.permission:read` | |
| 权限 | `GET /permissions/tree` | `system.permission:read` | 新增 |
| 权限 | `GET /permissions/{permission_id}` | `system.permission:read` | |
| 权限 | `POST /permissions` | `system.permission:create` | |
| 权限 | `PUT /permissions/{permission_id}` | `system.permission:update` | |
| 权限 | `DELETE /permissions/{permission_id}` | `system.permission:delete` | |
| 供应商 | `POST /providers` | `provider:create` | |
| 供应商 | `GET /providers` | `provider:read` | |
| 供应商 | `GET /providers/{provider_id}` | `provider:read` | |
| 供应商 | `PUT /providers/{provider_id}` | `provider:update` | |
| 供应商 | `DELETE /providers/{provider_id}` | `provider:delete` | |
| 供应商 | `POST /providers/{provider_id}/test` | `provider:test` | |
| 模型 | `POST /models` | `model:create` | |
| 模型 | `GET /models` | `model:read` | |
| 模型 | `GET /models/{model_id}` | `model:read` | |
| 模型 | `PUT /models/{model_id}` | `model:update` | |
| 模型 | `DELETE /models/{model_id}` | `model:delete` | |
| Prompt | `POST /prompts` | `prompt:create` | |
| Prompt | `GET /prompts` | `prompt:read` | |
| Prompt | `GET /prompts/{prompt_id}` | `prompt:read` | |
| Prompt | `PUT /prompts/{prompt_id}` | `prompt:update` | |
| Prompt | `DELETE /prompts/{prompt_id}` | `prompt:delete` | |
| Prompt | `POST /prompts/{prompt_id}/publish` | `prompt:publish` | |
| Prompt | `GET /prompts/{prompt_id}/versions` | `prompt:read` | |
| Prompt | `POST /prompts/{prompt_id}/rollback` | `prompt:publish` | |
| 知识库 | `POST /knowledge-bases` | `knowledge:create` | |
| 知识库 | `GET /knowledge-bases` | `knowledge:read` | |
| 知识库 | `GET /knowledge-bases/{kb_id}` | `knowledge:read` | |
| 知识库 | `PUT /knowledge-bases/{kb_id}` | `knowledge:update` | |
| 知识库 | `PUT /knowledge-bases/{kb_id}/config` | `knowledge:update` | |
| 知识库 | `DELETE /knowledge-bases/{kb_id}` | `knowledge:delete` | |
| 知识库 | `POST /knowledge-bases/{kb_id}/documents` | `knowledge:upload` | |
| 知识库 | `GET /knowledge-bases/{kb_id}/documents` | `knowledge:read` | |
| 知识库 | `DELETE /knowledge-bases/{kb_id}/documents/{doc_id}` | `knowledge:delete` | |
| 知识库 | `POST /knowledge-bases/{kb_id}/documents/{doc_id}/retry` | `knowledge:upload` | |
| 知识库 | `GET /knowledge-bases/{kb_id}/documents/{doc_id}/segments` | `knowledge:read` | |
| 知识库 | `GET /knowledge-bases/{kb_id}/segments` | `knowledge:read` | |
| 知识库 | `PUT /knowledge-bases/{kb_id}/segments/{seg_id}` | `knowledge:update` | |
| 知识库 | `DELETE /knowledge-bases/{kb_id}/segments/{seg_id}` | `knowledge:delete` | |
| 知识库 | `POST /knowledge-bases/{kb_id}/retrieval-test` | `knowledge:test` | |
| 工具 | `POST /tools` | `tool:create` | |
| 工具 | `GET /tools` | `tool:read` | |
| 工具 | `GET /tools/{tool_id}` | `tool:read` | |
| 工具 | `PUT /tools/{tool_id}` | `tool:update` | |
| 工具 | `DELETE /tools/{tool_id}` | `tool:delete` | |
| 工具 | `POST /tools/{tool_id}/enable` | `tool:update` | |
| 工具 | `POST /tools/{tool_id}/disable` | `tool:update` | |
| 工具 | `POST /tools/{tool_id}/test` | `tool:test` | |
| Agent | `POST /agents` | `agent:create` | |
| Agent | `GET /agents` | `agent:read` | |
| Agent | `GET /agents/{agent_id}` | `agent:read` | |
| Agent | `PUT /agents/{agent_id}` | `agent:update` | |
| Agent | `DELETE /agents/{agent_id}` | `agent:delete` | |
| Agent | `POST /agents/{agent_id}/start` | `agent:update` | |
| Agent | `POST /agents/{agent_id}/stop` | `agent:update` | |
| Agent | `POST /agents/{agent_id}/publish` | `agent:publish` | |
| Agent | `GET /agents/{agent_id}/versions` | `agent:read` | |
| Agent | `POST /agents/{agent_id}/rollback` | `agent:publish` | |

> 未实现的后端模块（对话、统计、API Key、审计、告警、系统配置）在接口落地时，按 4.4 的权限码直接挂载，本表不预列不存在的路径。

### 7.5 授权失败日志要求

每条拒绝日志至少包含：

- 时间、请求 ID（若中间件已生成）、用户 ID/用户名、HTTP 方法、路径、所需权限码、结果、客户端 IP。
- 不记录 Token 明文、密码、请求体中的敏感字段。

---

## 8. 前端改造规格

### 8.1 权限状态管理

**目标**：全应用共享一份「当前用户权限」状态。

**要求**：

1. 登录成功后立即拉取权限；应用启动（已有 Token）时也拉取一次。
2. 权限状态提供：`loading`、`error`、`permissions: Set<string>`、`isSuperuser`、`roles`、`permissionVersion`。
3. 提供操作：`refreshPermissions()`、`clearPermissions()`。
4. 退出登录时清空权限状态。
5. 权限未加载完成时，受保护页面显示加载态，不渲染业务内容。
6. 权限状态不写入长期存储（避免脏数据）；页面刷新后重新拉取。可以临时写入 `sessionStorage` 仅用于减少首屏闪烁，但必须以接口结果为准。

> **默认决策 D12**：权限不持久化到 `localStorage`，只存内存（必要时 `sessionStorage` 做过渡）。理由：权限是安全敏感数据，持久化后可能与服务端不一致；每次启动重新拉取成本很低。

### 8.2 路由-权限映射

| 路由 | 权限码 | 说明 |
|---|---|---|
| `/` | `dashboard:read` | 工作台 |
| `/profile` | 登录 | 个人信息 |
| `/settings` | 登录 | 个人设置 |
| `/agents` | `agent:read` | Agent 列表 |
| `/agents/create` | `agent:create` | 新建 |
| `/agents/:id` | `agent:read` | 详情 |
| `/agents/:id/edit` | `agent:update` | 编辑 |
| `/agents/:id/test` | `agent:test` | 测试 |
| `/agents/:id/versions` | `agent:read` | 版本 |
| `/agents/:id/monitor` | `agent:test` | 监控 |
| `/models` | `model:read` | 模型列表 |
| `/models/create` | `model:create` | 新建 |
| `/models/:id/edit` | `model:update` | 编辑 |
| `/models/:id/test` | `model:test` | 测试 |
| `/models/providers` | `provider:read` | 供应商 |
| `/prompts` | `prompt:read` | Prompt 列表 |
| `/prompts/create` | `prompt:create` | 新建 |
| `/prompts/:id` | `prompt:read` | 详情 |
| `/prompts/:id/edit` | `prompt:update` | 编辑 |
| `/prompts/:id/versions` | `prompt:read` | 版本 |
| `/knowledge` | `knowledge:read` | 知识库列表 |
| `/knowledge/create` | `knowledge:create` | 新建 |
| `/knowledge/:id` | `knowledge:read` | 详情 |
| `/knowledge/:id/documents` | `knowledge:read` | 文档 |
| `/knowledge/:id/segments` | `knowledge:read` | 分段 |
| `/knowledge/:id/test` | `knowledge:test` | 检索测试 |
| `/tools` | `tool:read` | 工具列表 |
| `/tools/create` | `tool:create` | 新建 |
| `/tools/:id` | `tool:read` | 详情 |
| `/conversations` | `conversation:read` | 对话列表 |
| `/conversations/:id` | `conversation:read` | 对话详情 |
| `/analytics` | `analytics:read` | 用量 |
| `/analytics/costs` | `analytics:read` | 费用 |
| `/analytics/evaluation` | `analytics:read` | 评估 |
| `/system/users` | `system.user:read` | 用户管理 |
| `/system/roles` | `system.role:read` | 角色管理 |
| `/system/permissions` | `system.permission:read` | 权限管理 |
| `/system/api-keys` | `system.apikey:read` | API 密钥 |
| `/system/audit` | `system.audit:read` | 审计 |
| `/system/alerts` | `system.alert:read` | 告警 |
| `/system/settings` | `system.settings:read` | 系统配置 |
| `/403` | 登录 | 无权限页 |
| `*` | 登录 | 404 占位 |

### 8.3 菜单规则

| 菜单 | 显示条件 |
|---|---|
| 工作台 | `dashboard:read` |
| Agent 管理 | `agent:read` |
| 模型管理 | `model:read` |
| Prompt 管理 | `prompt:read` |
| 知识库 | `knowledge:read` |
| 工具管理 | `tool:read` |
| 对话日志 | `conversation:read` |
| 数据统计 | `analytics:read` |
| 系统管理（父级） | 任意 `system.*` 权限 |
| ├ 用户管理 | `system.user:read` |
| ├ 角色管理 | `system.role:read` |
| ├ 权限管理 | `system.permission:read` |
| ├ API 密钥 | `system.apikey:read` |
| ├ 审计日志 | `system.audit:read` |
| ├ 告警规则 | `system.alert:read` |
| └ 系统配置 | `system.settings:read` |

补充：

- 菜单顺序保持现有顺序。
- 父菜单在无任何子项可显示时整体隐藏。
- 面包屑对无权页面不生成可点击链接。

### 8.4 按钮权限矩阵

| 页面 | 按钮/操作 | 权限码 |
|---|---|---|
| Agent 列表 | 新建 | `agent:create` |
| Agent 列表 | 编辑 | `agent:update` |
| Agent 列表 | 删除 | `agent:delete` |
| Agent 列表 | 启动/停止 | `agent:update` |
| Agent 列表/详情 | 发布/回滚 | `agent:publish` |
| Agent 列表/详情 | 测试 | `agent:test` |
| Agent 详情 | 监控 | `agent:test` |
| 模型列表 | 新建 | `model:create` |
| 模型列表 | 编辑 | `model:update` |
| 模型列表 | 删除 | `model:delete` |
| 模型列表 | 测试 | `model:test` |
| 供应商页 | 新建/编辑/删除/测试 | `provider:create/update/delete/test` |
| Prompt 列表 | 新建 | `prompt:create` |
| Prompt 列表 | 编辑 | `prompt:update` |
| Prompt 列表 | 删除 | `prompt:delete` |
| Prompt 列表/详情 | 发布/回滚 | `prompt:publish` |
| 知识库列表 | 新建 | `knowledge:create` |
| 知识库详情 | 编辑/改配置 | `knowledge:update` |
| 知识库详情 | 删除 | `knowledge:delete` |
| 文档页 | 上传/重试 | `knowledge:upload` |
| 文档页 | 删除文档 | `knowledge:delete` |
| 分段页 | 编辑分段 | `knowledge:update` |
| 分段页 | 删除分段 | `knowledge:delete` |
| 检索测试页 | 开始测试 | `knowledge:test` |
| 工具列表 | 新建 | `tool:create` |
| 工具列表/详情 | 编辑/启用/禁用 | `tool:update` |
| 工具列表/详情 | 删除 | `tool:delete` |
| 工具详情 | 调用测试 | `tool:test` |
| 对话详情 | 标注 | `conversation:annotate` |
| 对话列表 | 导出 | `conversation:export` |
| 统计页 | 导出 | `analytics:export` |
| 用户管理 | 添加用户 | `system.user:create` |
| 用户管理 | 编辑/启用/禁用 | `system.user:update` |
| 用户管理 | 删除 | `system.user:delete` |
| 用户管理 | 分配角色 | `system.user:assign` |
| 角色管理 | 创建角色 | `system.role:create` |
| 角色管理 | 编辑角色 | `system.role:update` |
| 角色管理 | 删除角色 | `system.role:delete` |
| 角色管理 | 分配权限 | `system.role:assign` |
| 权限管理 | 创建权限 | `system.permission:create` |
| 权限管理 | 编辑权限 | `system.permission:update` |
| 权限管理 | 删除权限 | `system.permission:delete` |

### 8.5 前端组件与能力清单

| 能力 | 形态 | 要求 |
|---|---|---|
| 权限上下文 | Provider + Hook | 应用根部包裹；提供 `loading/error/permissions/isSuperuser` |
| 权限判断 | `usePermissions()` | `has/hasAny/hasAll` |
| 声明式渲染 | `<Can permission="...">` | 支持 `fallback`、单码与数组 |
| 路由守卫 | `PermissionGuard` | 包裹在 `AuthGuard` 内层；无权限跳 `/403` |
| API 客户端 | 拦截器增强 | 401/403 语义化处理 |
| 403 页面 | 独立页面 | 不泄露权限细节 |
| 角色权限树 | 管理端组件 | 模块分组、三态全选、搜索 |
| 用户角色分配 | 管理端弹窗 | 多选、搜索、整体替换 |
| 权限管理页 | 管理端页面 | 模块筛选、内置标记、格式校验 |

### 8.6 页面改造清单

| 页面/文件 | 改造内容 |
|---|---|
| `app/src/App.tsx` | 路由包裹权限守卫；新增 `/403` |
| `app/src/layouts/DashboardLayout.tsx` | 菜单增加权限元数据并过滤；系统管理父菜单动态显示 |
| `app/src/components/AuthGuard.tsx` | 保持登录判断；与权限守卫分层 |
| 新增权限 Provider/Hook/Can | 见 8.5 |
| `app/src/services/api/client.ts` | 401/403 处理；业务码兜底 |
| `app/src/services/api/system.ts` | 新增权限查询、权限树、更新用户等接口类型 |
| `app/src/services/auth.ts` / mock | 新增 `getPermissions` |
| `app/src/pages/system/Roles.tsx` | 权限分配改为分组树；内置角色只读 |
| `app/src/pages/system/Users.tsx` | 角色列、启用/禁用、自我操作保护提示 |
| `app/src/pages/system/Permissions.tsx` | 模块筛选、内置标记、格式校验 |
| 各业务列表/详情页 | 按 8.4 包裹按钮 |
| 新增 `app/src/pages/Forbidden.tsx` | 403 页面 |

---

# 第五部分 非功能、验收、实施

## 9. 非功能需求

### 9.1 性能

| 指标 | 要求 |
|---|---|
| 鉴权额外耗时（缓存命中） | p95 ≤ 5ms |
| 鉴权额外耗时（缓存未命中） | p95 ≤ 20ms |
| 权限查询接口 | p95 ≤ 100ms（63 条权限规模） |
| 前端首屏权限加载 | 不额外增加超过 1 次网络往返；加载期间显示骨架 |
| 权限变更生效 | 主动失效下一次请求生效；最迟不超过缓存 TTL（10 分钟） |

### 9.2 可靠性

- Redis 故障时降级到数据库，不阻断登录和业务。
- 数据库故障时明确返回 500，不返回「默认放行」。
- 权限目录缺少某权限码时，接口拒绝并记录 ERROR，不静默通过。
- 灰度开关 `RBAC_ENFORCE=false` 时只记录「本应拒绝」日志并放行，仅用于上线观察；启动时必须打印显著 WARN。

### 9.3 安全

- 密码、Token 不进入权限缓存、不进入日志。
- 403 响应不回显所需权限码（服务端日志可以记录）。
- 防自提权、最后超管保护、内置资源保护必须由后端强制执行，不能只靠前端隐藏。
- 权限码创建时做格式与唯一性校验，防止伪造或重复。
- 所有授权判断以服务端为准；前端状态仅用于展示。

### 9.4 兼容性

- 现有 `admin` 账号（`is_superuser=true`）升级后仍可登录并访问全部功能。
- 现有前端 Mock 模式不退化。
- 现有业务接口的响应结构只增字段、不改字段，避免破坏页面。
- 数据库迁移可回滚；旧权限码在迁移期间保留可读。

### 9.5 可观测性

- 启动日志输出：受保护接口数、未声明权限码接口清单、RBAC 开关状态。
- 授权拒绝日志结构化输出，便于检索。
- 权限缓存命中/未命中计数（日志或指标），便于评估缓存效果。

### 9.6 可维护性

- 权限码集中维护为「权限目录」常量/种子数据，新增模块只改目录和接口声明，不改鉴权核心。
- 权限判断逻辑只有一处实现，禁止散落的手写判断。
- 前端权限映射集中在一个配置文件，路由、菜单、按钮共用同一套权限码。

## 10. 验收标准

> 采用 Given / When / Then 描述，逐条可测试。

### 10.1 认证与基础授权

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-01 | 未登录 | 调用任意业务接口 | 返回 HTTP 401，code=40100 |
| AC-02 | 使用过期 Token | 调用任意接口 | 返回 HTTP 401；前端自动回登录页 |
| AC-03 | 被禁用用户 | 使用旧 Token 调用接口 | 返回 HTTP 401，code=40101 |
| AC-04 | viewer 登录 | 调用 `POST /agents` | 返回 HTTP 403，code=40301 |
| AC-05 | viewer 登录 | 调用 `GET /agents` | 返回 200 和列表 |
| AC-06 | admin 登录 | 调用任意权限接口 | 返回 200 |
| AC-07 | 超管用户 | 即使角色权限被清空 | 仍可访问全部接口（`is_superuser` 直通） |

### 10.2 权限目录与迁移

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-08 | 全新数据库 | 执行初始化 | 生成 63 条权限、3 个内置角色、admin 用户 |
| AC-09 | 旧数据库 | 执行迁移 | 旧权限码正确映射；admin 拥有全部新权限；无重复权限 |
| AC-10 | 管理员 | 创建权限 `custom:read` | 成功，`module=custom`、`action=read`、`is_system=false` |
| AC-11 | 管理员 | 创建权限 `Agent:Create` | 失败，提示格式错误 |
| AC-12 | 管理员 | 删除内置权限 | 失败，code=40303 |
| AC-13 | 管理员 | 删除自定义权限 | 成功，且所有角色中该权限消失 |

### 10.3 角色与用户管理

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-14 | 管理员 | 给 operator 勾选 `agent:delete` | 保存成功；operator 刷新后可删除 Agent |
| AC-15 | 管理员 | 取消 operator 的 `agent:create` | operator 的新建按钮消失；接口 403 |
| AC-16 | 管理员 | 给用户分配 operator + viewer | 用户有效权限为并集 |
| AC-17 | admin 用户 | 删除/禁用自己 | 拒绝，code=40304 |
| AC-18 | 唯一超管 | 取消自己的超管标记 | 拒绝，code=40305 |
| AC-19 | 非超管 | 给自己分配 admin 角色 | 拒绝，code=40302 |
| AC-20 | 管理员 | 删除仍被用户使用的角色 | 拒绝，code=40306；提示用户数 |
| AC-21 | 管理员 | 删除无人使用的自定义角色 | 成功 |
| AC-22 | 管理员 | 修改内置角色 `code` | 拒绝，code=40303 |

### 10.4 前端收敛

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-23 | viewer 登录 | 查看侧边栏 | 无「系统管理」 |
| AC-24 | operator 登录 | 访问 `/system/users` | 进入 403 页面 |
| AC-25 | viewer 登录 | 打开 Agent 列表 | 无新建/编辑/删除/发布/测试按钮 |
| AC-26 | operator 登录 | 打开 Agent 列表 | 有新建/编辑/发布/测试，无删除 |
| AC-27 | admin 登录 | 打开全部页面 | 菜单、路由、按钮完整 |
| AC-28 | 任意用户 | 刷新页面 | 不出现「先全量显示再隐藏」的闪烁 |
| AC-29 | 权限接口失败（非 401） | 打开应用 | 显示错误与重试，不显示全量菜单 |
| AC-30 | 权限变更后 | 用户刷新页面 | 菜单和按钮同步变化 |

### 10.5 缓存与降级

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-31 | 同一用户连续请求 | 第二次请求 | 命中缓存，权限结果一致 |
| AC-32 | 角色权限变更 | 受影响用户下一次请求 | 使用新权限（版本号失效） |
| AC-33 | 用户角色变更 | 该用户下一次请求 | 使用新角色（键删除） |
| AC-34 | Redis 停止 | 用户请求接口 | 鉴权正常（走数据库），日志有 WARN |
| AC-35 | 权限码配置错误 | 请求对应接口 | 拒绝并记录 ERROR，不放行 |

### 10.6 Mock 与兼容

| 编号 | Given | When | Then |
|---|---|---|---|
| AC-36 | `VITE_USE_MOCK=true` | 打开任意页面 | 功能与改造前一致，无接口报错 |
| AC-37 | `VITE_USE_MOCK=false` | viewer 登录 | 界面按权限收敛 |
| AC-38 | 旧版前端调用新增字段前的接口 | 请求用户/角色/权限 | 响应兼容，不因新增字段报错 |
| AC-39 | 现有 admin/123456 | 登录 | 成功，拥有全部权限 |

## 11. 实施阶段与里程碑

> 本期只交付需求文档；以下为后续实现阶段的划分建议，供排期使用。

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| M1 权限模型与目录 | 表结构变更、63 条权限种子、迁移脚本、内置角色矩阵 | 数据库可用的新权限目录 | 无 |
| M2 授权核心 | 鉴权依赖、权限聚合服务、401/403 语义、日志 | 后端可强制鉴权 | M1 |
| M3 接口改造 | 全部现有业务接口挂权限码、启动检查、灰度开关 | 所有接口受保护 | M2 |
| M4 权限查询与缓存 | `/users/me/permissions`、权限树、Redis 缓存与失效 | 前端可获取权限 | M2 |
| M5 前端权限体系 | Provider/Hook/Can、菜单过滤、路由守卫、403 页、客户端改造 | 前端按权限收敛 | M4 |
| M6 管理端增强 | 权限树分配、用户角色/状态、内置保护、格式校验 | 管理闭环 | M4、M5 |
| M7 测试与验收 | 后端接口矩阵测试、前端手工验收、迁移演练 | 验收报告 | M3、M6 |

**关键路径**：M1 → M2 → M3/M4 → M5 → M6 → M7。

**灰度建议**：

1. 先在开发环境打开 `RBAC_ENFORCE=false`，观察日志中「本应拒绝」的请求，补齐权限种子。
2. 确认 admin/operator 的权限矩阵无误后切换为 `true`。
3. 生产环境上线首日保留详细日志，第二天复核拒绝记录。

## 12. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 接口一次性加鉴权导致现有前端大面积 403 | 业务不可用 | 先补全权限种子与角色矩阵；灰度开关观察；按模块分批开启 |
| 旧权限码与新权限码映射遗漏 | 部分角色权限丢失 | 迁移脚本幂等 + 迁移前后对比报告 + 保留旧码只读 |
| `is_superuser` 账号只有一个，误操作锁死 | 平台不可管理 | 强制最后超管保护；初始化至少一个超管；文档提示 |
| Redis 缓存导致权限变更不及时 | 用户看到旧权限 | 版本号 + 主动删除；TTL 兜底；提供手动刷新 |
| 前端只隐藏按钮而后端漏挂权限 | 安全漏洞 | 接口清单逐项核对；启动检查未声明权限码的接口；接口测试覆盖 |
| 权限码粒度过细导致配置繁琐 | 管理成本高 | 63 条按模块分组；内置角色矩阵兜底；权限树支持模块全选 |
| 30 分钟 JWT 过期频繁 | 用户体验差 | 本期不改认证机制；前端 401 自动回登录；后续迭代考虑刷新 Token |
| 前端权限状态与服务端不一致 | 操作失败 | 以服务端为准；403 时触发一次权限刷新；关键操作失败后提示重新登录/刷新 |
| 权限目录与代码漂移 | 新接口无权限码 | 权限码集中目录 + 启动检查 + Code Review 清单 |
| 迁移期间新旧权限并存 | 角色权限重复 | 迁移脚本去重；`code` 唯一约束；迁移后清理旧码 |

## 13. 决策记录（默认决策，可推翻）

> 本节列出文档作者在「不阻塞推进」前提下做出的默认选择。评审时可以逐条确认或推翻；推翻后只需修改对应章节，不影响整体结构。

| 编号 | 决策 | 理由 | 影响章节 |
|---|---|---|---|
| D1 | 新增内置角色 `viewer` | 提供只读角色，便于验证按钮级收敛 | 3.2、4.5 |
| D2 | 三个内置角色 `is_system=true`，admin 权限不可缩减 | 防止误操作锁死平台 | 3.2、FR-07、FR-10 |
| D3 | 取消 `*` 通配权限码，改为精确权限码 | 权限树可解释、可审计；超管由 `is_superuser` 兜底 | 4.2、6.5 |
| D4 | operator 不拥有任何 delete 权限 | 删除不可逆，默认最小权限 | 4.5 |
| D5 | admin 角色固定全量权限 | 兜底由超管标记承担；角色权限用于展示/审计 | 4.5、FR-07 |
| D6 | JWT 不携带权限 | 避免权限变更后旧 Token 仍生效 | FR-01 |
| D7 | 权限缓存采用「全局版本号 + 用户键删除」 | 兼顾可靠失效与精确失效 | FR-03 |
| D8 | 禁止自我降权/自我禁用/自我删除 | 避免单管理员环境锁死 | FR-10 |
| D9 | 不增加数据范围字段 | 行级权限不在本期范围 | 6.2 |
| D10 | 认证/授权错误使用真实 HTTP 401/403 | 前端能可靠区分回登录与无权限 | 7.1、FR-06 |
| D11 | `UserRead` 直接带精简角色与 `is_superuser` | 避免用户列表 N+1 | 7.3 |
| D12 | 前端权限不持久化到 localStorage | 避免脏权限；启动重新拉取成本低 | 8.1 |
| D13 | 本期不做授权审计落库，只记服务端日志 | 控制范围；审计表列为 P2 | FR-11 |
| D14 | 灰度开关 `RBAC_ENFORCE` 默认 true | 生产默认安全；开发/排障可临时关闭 | 9.2、11 |

## 14. 附录

### 14.1 现有代码证据索引

| 结论 | 证据 |
|---|---|
| `get_current_user` 只解析用户，不判断权限 | `src/core/deps.py:16-35` |
| 业务接口未使用登录依赖 | `src/modules/agent/api.py:19-100`、`src/modules/model/api.py`、`src/modules/prompt/api.py`、`src/modules/knowledge/api.py`、`src/modules/tool/api.py`、`src/modules/provider/api.py` |
| 只有 `/users/me` 使用 `get_current_user` | `src/modules/user/api.py:46-51` |
| `is_superuser` 字段存在但未参与判断 | `src/modules/user/model.py:18` |
| 权限表缺少模块/操作字段 | `src/modules/permission/model.py:5-9` |
| 角色-权限、用户-角色关联已就绪 | `src/modules/role/model.py:7-34` |
| 现有权限种子粒度不统一 | `init_data.py:31-44` |
| 现有种子角色只有 admin/operator | `init_data.py:26-29` |
| 前端只有登录守卫 | `app/src/components/AuthGuard.tsx:8-16` |
| 前端菜单写死 | `app/src/layouts/DashboardLayout.tsx:34-53` |
| 前端路由仅包 AuthGuard | `app/src/App.tsx:25-85` |
| API 客户端只识别 HTTP 401 | `app/src/services/api/client.ts:24-37` |
| 角色权限分配目前是平铺复选框 | `app/src/pages/system/Roles.tsx:112-159` |
| 权限管理页按 code 前缀推断模块 | `app/src/pages/system/Permissions.tsx:23-48` |
| 前端设计文档已设想「模块 × 操作」权限矩阵 | `app/docs/09-系统管理.md:61-90` |

### 14.2 与 V1 文档的关系

| V1 内容 | V2 处理 |
|---|---|
| RBAC 模块（用户/角色/权限/认证/验证码）已实现 | 保留；在其上补授权能力 |
| 业务模块后端待实现 | 不影响；新接口落地时按 4.4 挂权限码 |
| 前端 Mock/API 切换机制 | 保留；新增权限服务遵循同一模式 |
| 统一响应格式 | 保留；认证/授权错误例外使用 HTTP 401/403 |
| 登录/JWT/验证码流程 | 保留，不变 |
| 系统管理页面 | 在本期增强（角色权限树、用户角色/状态、权限内置保护） |

### 14.3 需求对齐结论

本稿已完成以下对齐动作：

1. 以 `docs/PROJECT_SPEC.md` 为基线，核对了后端 RBAC 数据结构、认证流程、接口清单和前端页面结构。
2. 明确了「已有认证、缺授权」的核心差距，并把授权拆成权限目录、后端拦截、前端收敛、管理闭环四件事。
3. 给出了可直接开发的权限目录（63 条 / 16 模块）、接口映射表、数据模型变更和前端改造清单。
4. 对无法从现有代码推断的取舍，采用默认决策并集中记录在 13 章，避免阻塞。
5. 本期不编写任何业务代码，仅交付本需求文档。

### 14.4 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-25 | V2.0 | 新增 RBAC 授权能力需求；形成完整 PRD；明确权限目录、接口映射、前端收敛、验收标准与决策记录 |
