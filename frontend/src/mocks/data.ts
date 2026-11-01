/**
 * Mock数据 - RBAC V2
 * 权限目录对齐 PRD 4.4（63 条 / 16 模块），内置角色矩阵对齐 PRD 4.5
 * 提供 resetMockData() 保证测试隔离
 */

import type { Permission, Role, User, UserWithRoles, RoleLite } from '@/apis/modules/rbac'

/* ============================================================
 * 权限目录（63 条 / 16 模块）
 * [module, moduleName, action, name, description]
 * ============================================================ */

const CATALOG_DEFS: Array<[string, string, string, string, string]> = [
  ['dashboard', '工作台', 'read', '查看工作台', '工作台大盘数据'],

  ['agent', 'Agent 管理', 'read', '查看 Agent', '列表、详情、版本列表'],
  ['agent', 'Agent 管理', 'create', '创建 Agent', '新建 Agent'],
  ['agent', 'Agent 管理', 'update', '编辑 Agent', '修改、启动、停止'],
  ['agent', 'Agent 管理', 'delete', '删除 Agent', '删除 Agent'],
  ['agent', 'Agent 管理', 'publish', '发布 Agent', '发布版本、回滚版本'],
  ['agent', 'Agent 管理', 'test', '测试 Agent', '对话测试、监控'],

  ['model', '模型管理', 'read', '查看模型', '模型列表、详情'],
  ['model', '模型管理', 'create', '添加模型', '新建模型'],
  ['model', '模型管理', 'update', '编辑模型', '修改模型'],
  ['model', '模型管理', 'delete', '删除模型', '删除模型'],
  ['model', '模型管理', 'test', '测试模型', '连接/效果测试'],

  ['provider', '供应商管理', 'read', '查看供应商', '供应商列表、详情'],
  ['provider', '供应商管理', 'create', '创建供应商', '新建供应商'],
  ['provider', '供应商管理', 'update', '编辑供应商', '修改供应商'],
  ['provider', '供应商管理', 'delete', '删除供应商', '删除供应商'],
  ['provider', '供应商管理', 'test', '测试供应商', '测试连接'],

  ['prompt', 'Prompt 管理', 'read', '查看 Prompt', '列表、详情、版本列表'],
  ['prompt', 'Prompt 管理', 'create', '创建 Prompt', '新建 Prompt'],
  ['prompt', 'Prompt 管理', 'update', '编辑 Prompt', '修改 Prompt'],
  ['prompt', 'Prompt 管理', 'delete', '删除 Prompt', '删除 Prompt'],
  ['prompt', 'Prompt 管理', 'publish', '发布 Prompt', '发布版本、回滚版本'],

  ['knowledge', '知识库管理', 'read', '查看知识库', '知识库、文档、分段查看'],
  ['knowledge', '知识库管理', 'create', '创建知识库', '新建知识库'],
  ['knowledge', '知识库管理', 'update', '编辑知识库', '修改知识库、改配置、编辑分段'],
  ['knowledge', '知识库管理', 'delete', '删除知识库', '删除知识库、文档、分段'],
  ['knowledge', '知识库管理', 'upload', '上传文档', '上传文档、重试解析'],
  ['knowledge', '知识库管理', 'test', '检索测试', '检索效果测试'],

  ['tool', '工具管理', 'read', '查看工具', '工具列表、详情'],
  ['tool', '工具管理', 'create', '注册工具', '新建工具'],
  ['tool', '工具管理', 'update', '编辑工具', '修改、启用、禁用'],
  ['tool', '工具管理', 'delete', '删除工具', '删除工具'],
  ['tool', '工具管理', 'test', '测试工具', '调用测试'],

  ['conversation', '对话日志', 'read', '查看对话', '对话列表、详情'],
  ['conversation', '对话日志', 'annotate', '标注对话', '标注、评价'],
  ['conversation', '对话日志', 'export', '导出对话', '导出记录'],

  ['analytics', '数据统计', 'read', '查看统计', '用量、费用、评估'],
  ['analytics', '数据统计', 'export', '导出统计', '导出报表'],

  ['system.user', '用户管理', 'read', '查看用户', '用户列表、详情、角色'],
  ['system.user', '用户管理', 'create', '创建用户', '新建用户'],
  ['system.user', '用户管理', 'update', '编辑用户', '修改资料、启用/禁用'],
  ['system.user', '用户管理', 'delete', '删除用户', '删除用户'],
  ['system.user', '用户管理', 'assign', '分配角色', '给用户分配角色'],

  ['system.role', '角色管理', 'read', '查看角色', '角色列表、详情'],
  ['system.role', '角色管理', 'create', '创建角色', '新建角色'],
  ['system.role', '角色管理', 'update', '编辑角色', '修改角色'],
  ['system.role', '角色管理', 'delete', '删除角色', '删除角色'],
  ['system.role', '角色管理', 'assign', '分配权限', '给角色分配权限'],

  ['system.permission', '权限管理', 'read', '查看权限', '权限列表、权限树'],
  ['system.permission', '权限管理', 'create', '创建权限', '新建权限'],
  ['system.permission', '权限管理', 'update', '编辑权限', '修改名称/描述'],
  ['system.permission', '权限管理', 'delete', '删除权限', '删除非内置权限'],

  ['system.apikey', 'API 密钥', 'read', '查看密钥', 'API Key 列表'],
  ['system.apikey', 'API 密钥', 'create', '创建密钥', '新建 API Key'],
  ['system.apikey', 'API 密钥', 'update', '编辑密钥', '修改、启停'],
  ['system.apikey', 'API 密钥', 'delete', '删除密钥', '删除 API Key'],

  ['system.audit', '审计日志', 'read', '查看审计', '审计日志查看'],

  ['system.alert', '告警规则', 'read', '查看告警', '告警规则列表'],
  ['system.alert', '告警规则', 'create', '创建告警', '新建告警规则'],
  ['system.alert', '告警规则', 'update', '编辑告警', '修改、启停'],
  ['system.alert', '告警规则', 'delete', '删除告警', '删除告警规则'],

  ['system.settings', '系统配置', 'read', '查看配置', '系统配置查看'],
  ['system.settings', '系统配置', 'update', '修改配置', '系统配置修改'],
]

/** 模块固定顺序（PRD 7.2.2） */
export const MODULE_ORDER = [
  'dashboard', 'agent', 'model', 'provider', 'prompt', 'knowledge', 'tool',
  'conversation', 'analytics', 'system.user', 'system.role', 'system.permission',
  'system.apikey', 'system.audit', 'system.alert', 'system.settings',
]

/** 模块显示名 */
export const MODULE_NAMES: Record<string, string> = Object.fromEntries(
  CATALOG_DEFS.map(([module, moduleName]) => [module, moduleName])
)

function buildCatalog(): Permission[] {
  return CATALOG_DEFS.map(([module, , action, name, description], index) => ({
    id: index + 1,
    module,
    action,
    code: `${module}:${action}`,
    name,
    description,
    is_system: true,
    sort_order: index + 1,
  }))
}

/* ============================================================
 * 内置角色矩阵（PRD 4.5）
 * ============================================================ */

const OPERATOR_CODES = [
  'dashboard:read',
  'agent:read', 'agent:create', 'agent:update', 'agent:publish', 'agent:test',
  'model:read', 'model:test',
  'provider:read', 'provider:test',
  'prompt:read', 'prompt:create', 'prompt:update', 'prompt:publish',
  'knowledge:read', 'knowledge:create', 'knowledge:update', 'knowledge:upload', 'knowledge:test',
  'tool:read', 'tool:create', 'tool:update', 'tool:test',
  'conversation:read', 'conversation:annotate',
  'analytics:read', 'analytics:export',
]

// viewer：所有 9 个业务模块只读（PRD 3.2）
const VIEWER_CODES = [
  'dashboard:read',
  'agent:read',
  'model:read',
  'provider:read',
  'prompt:read',
  'knowledge:read',
  'tool:read',
  'conversation:read',
  'analytics:read',
]

// 自定义角色（用于验证非内置角色的删除/使用中保护）
const ANALYST_CODES = ['conversation:read', 'analytics:read']

/* ============================================================
 * 可变 Mock 存储
 * ============================================================ */

const initialPermissions = buildCatalog()

function codesToPermissions(codes: string[], catalog: Permission[]): Permission[] {
  return catalog.filter((p) => codes.includes(p.code)).map((p) => ({ ...p }))
}

const initialRoles: Role[] = [
  {
    id: 1,
    code: 'admin',
    name: '超级管理员',
    description: '拥有全部 63 条权限，平台管理者',
    is_system: true,
    sort_order: 1,
    user_count: 1,
    permissions: codesToPermissions(initialPermissions.map((p) => p.code), initialPermissions),
  },
  {
    id: 2,
    code: 'operator',
    name: '运营人员',
    description: '日常业务操作，不可删除与系统管理',
    is_system: true,
    sort_order: 2,
    user_count: 2,
    permissions: codesToPermissions(OPERATOR_CODES, initialPermissions),
  },
  {
    id: 3,
    code: 'viewer',
    name: '只读观察员',
    description: '业务模块只读',
    is_system: true,
    sort_order: 3,
    user_count: 2,
    permissions: codesToPermissions(VIEWER_CODES, initialPermissions),
  },
  {
    id: 4,
    code: 'analyst',
    name: '数据分析师',
    description: '仅查看对话与统计',
    is_system: false,
    sort_order: 4,
    user_count: 1,
    permissions: codesToPermissions(ANALYST_CODES, initialPermissions),
  },
]

/** 精简角色（UserRead.roles） */
export function toRoleLite(role: Role): RoleLite {
  return { id: role.id, code: role.code, name: role.name }
}

export interface MockUserRecord {
  id: number
  username: string
  email: string
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
}

const initialUsers: MockUserRecord[] = [
  { id: 1, username: 'admin', email: 'admin@chenguang.com', is_active: true, is_superuser: true, last_login: '2026-10-31 18:20:11' },
  { id: 2, username: 'operator01', email: 'operator01@chenguang.com', is_active: true, is_superuser: false, last_login: '2026-10-30 09:12:45' },
  { id: 3, username: 'viewer01', email: 'viewer01@chenguang.com', is_active: true, is_superuser: false, last_login: '2026-10-29 16:03:22' },
  { id: 4, username: 'viewer02', email: 'viewer02@chenguang.com', is_active: false, is_superuser: false, last_login: null },
  { id: 5, username: 'analyst01', email: 'analyst01@chenguang.com', is_active: true, is_superuser: false, last_login: '2026-10-28 11:47:05' },
]

/** 用户-角色关联 */
const initialUserRoles: Record<number, number[]> = {
  1: [1],
  2: [2],
  3: [3],
  4: [3],
  5: [4],
}

export const mockPasswords: Record<string, string> = {
  admin: '123456',
  operator01: '123456',
  viewer01: '123456',
  viewer02: '123456',
  analyst01: '123456',
}

export let mockPermissions: Permission[] = structuredClone(initialPermissions)
export let mockRoles: Role[] = structuredClone(initialRoles)
export let mockUsers: MockUserRecord[] = structuredClone(initialUsers)
export let mockUserRoles: Record<number, number[]> = structuredClone(initialUserRoles)

let userIdSeed = initialUsers.length
let roleIdSeed = initialRoles.length
let permissionIdSeed = initialPermissions.length
let permissionVersion = 1

const captchaStore = new Map<string, string>()

/* ============================================================
 * 重置
 * ============================================================ */

export function resetMockData(): void {
  mockPermissions = structuredClone(initialPermissions)
  mockRoles = structuredClone(initialRoles)
  mockUsers = structuredClone(initialUsers)
  mockUserRoles = structuredClone(initialUserRoles)
  mockPasswords.admin = '123456'
  mockPasswords.operator01 = '123456'
  mockPasswords.viewer01 = '123456'
  mockPasswords.viewer02 = '123456'
  mockPasswords.analyst01 = '123456'
  captchaStore.clear()
  userIdSeed = initialUsers.length
  roleIdSeed = initialRoles.length
  permissionIdSeed = initialPermissions.length
  permissionVersion = 1
  syncRoleUserCount()
}

/* ============================================================
 * 权限/角色查询
 * ============================================================ */

export function getUserRoleIds(userId: number): number[] {
  return mockUserRoles[userId] || []
}

export function getUserRoles(userId: number): Role[] {
  return getUserRoleIds(userId)
    .map((id) => mockRoles.find((r) => r.id === id))
    .filter((r): r is Role => Boolean(r))
}

export function getUserRoleLites(userId: number): RoleLite[] {
  return getUserRoles(userId).map(toRoleLite)
}

/** 用户有效权限码（超管返回全量；否则角色并集） */
export function getEffectivePermissionCodes(user: MockUserRecord): string[] {
  if (user.is_superuser) return mockPermissions.map((p) => p.code).sort()
  const codes = new Set<string>()
  getUserRoles(user.id).forEach((role) => role.permissions.forEach((p) => codes.add(p.code)))
  return [...codes].sort()
}

/** 转为 API UserRead */
export function toUserRead(user: MockUserRecord): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    is_active: user.is_active,
    is_superuser: user.is_superuser,
    last_login: user.last_login,
    roles: getUserRoleLites(user.id),
  }
}

/** 转为 API UserWithRolesRead */
export function toUserWithRoles(user: MockUserRecord): UserWithRoles {
  return toUserRead(user)
}

export function resolvePermissionsByIds(ids: number[]): Permission[] {
  return mockPermissions.filter((p) => ids.includes(p.id)).map((p) => ({ ...p }))
}

export function resolveRolesByIds(ids: number[]): Role[] {
  return mockRoles.filter((r) => ids.includes(r.id))
}

/** 角色 user_count 由关联关系推导 */
export function syncRoleUserCount(): void {
  mockRoles.forEach((role) => {
    role.user_count = Object.values(mockUserRoles).filter((ids) => ids.includes(role.id)).length
  })
}

/* ============================================================
 * 分页与过滤
 * ============================================================ */

export function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page: safePage,
    page_size: pageSize,
  }
}

export function filterByKeyword<T>(
  items: T[],
  keyword: string | null | undefined,
  getText: (item: T) => string
): T[] {
  if (!keyword) return items
  const needle = keyword.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => getText(item).toLowerCase().includes(needle))
}

/* ============================================================
 * 权限树
 * ============================================================ */

export function buildPermissionTree() {
  return MODULE_ORDER.map((module) => ({
    module,
    module_name: MODULE_NAMES[module] || module,
    permissions: mockPermissions
      .filter((p) => p.module === module)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        action: p.action,
        is_system: p.is_system,
        sort_order: p.sort_order,
      })),
  })).filter((group) => group.permissions.length > 0)
}

/* ============================================================
 * 验证码
 * ============================================================ */

export function createCaptchaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function saveCaptcha(code: string): string {
  const key = `captcha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  captchaStore.set(key, code)
  return key
}

export function verifyCaptcha(key: string, code: string): boolean {
  const expected = captchaStore.get(key)
  if (!expected) return false
  captchaStore.delete(key)
  return expected.toUpperCase() === (code || '').toUpperCase()
}

export function getMockCaptchaCode(key: string): string | undefined {
  return captchaStore.get(key)
}

export function buildCaptchaImage(code: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
  <rect width="120" height="40" fill="#f1f5f9"/>
  <path d="M0 30 Q30 10 60 26 T120 20" stroke="#cbd5e1" stroke-width="2" fill="none"/>
  <text x="60" y="28" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" letter-spacing="4" fill="#1e293b">${code}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ============================================================
 * ID 与版本
 * ============================================================ */

export function nextUserId(): number {
  userIdSeed += 1
  return userIdSeed
}

export function nextRoleId(): number {
  roleIdSeed += 1
  return roleIdSeed
}

export function nextPermissionId(): number {
  permissionIdSeed += 1
  return permissionIdSeed
}

export function getPermissionVersion(): number {
  return permissionVersion
}

export function bumpPermissionVersion(): number {
  permissionVersion += 1
  return permissionVersion
}

export const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$/
