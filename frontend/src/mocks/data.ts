/**
 * Mock数据 - RBAC（用户 / 角色 / 权限 / 验证码）
 * 支持内存增删改查，并提供 resetMockData() 用于测试隔离
 */

import type { Permission, Role, User, UserWithRoles } from '@/apis/modules/rbac'

/* ============================================================
 * 初始数据定义
 * ============================================================ */

const initialPermissions: Permission[] = [
  { id: 1, code: 'dashboard:view', name: '查看工作台', description: '访问工作台首页' },
  { id: 2, code: 'system:user:view', name: '查看用户', description: '查看用户列表与详情' },
  { id: 3, code: 'system:user:create', name: '创建用户', description: '创建新用户账号' },
  { id: 4, code: 'system:user:assign_role', name: '分配用户角色', description: '为用户分配角色' },
  { id: 5, code: 'system:role:view', name: '查看角色', description: '查看角色列表与详情' },
  { id: 6, code: 'system:role:create', name: '创建角色', description: '创建新角色' },
  { id: 7, code: 'system:role:update', name: '更新角色', description: '修改角色信息' },
  { id: 8, code: 'system:role:delete', name: '删除角色', description: '删除角色' },
  { id: 9, code: 'system:role:assign_permission', name: '分配角色权限', description: '为角色分配权限' },
  { id: 10, code: 'system:permission:view', name: '查看权限', description: '查看权限列表与详情' },
  { id: 11, code: 'system:permission:create', name: '创建权限', description: '创建新权限' },
  { id: 12, code: 'system:permission:update', name: '更新权限', description: '修改权限信息' },
  { id: 13, code: 'system:permission:delete', name: '删除权限', description: '删除权限' },
  { id: 14, code: 'monitor:online:view', name: '查看在线用户', description: '查看在线用户列表' },
  { id: 15, code: 'monitor:server:view', name: '查看服务监控', description: '查看服务器状态' },
]

const initialRoles: Role[] = [
  {
    id: 1,
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有系统全部权限',
    permissions: [...initialPermissions],
  },
  {
    id: 2,
    code: 'admin',
    name: '管理员',
    description: '负责日常用户与角色管理',
    permissions: initialPermissions.filter((p) => p.id <= 12),
  },
  {
    id: 3,
    code: 'user',
    name: '普通用户',
    description: '仅可访问工作台',
    permissions: initialPermissions.filter((p) => p.code === 'dashboard:view'),
  },
  {
    id: 4,
    code: 'auditor',
    name: '审计员',
    description: '查看监控与在线用户',
    permissions: initialPermissions.filter((p) =>
      ['dashboard:view', 'monitor:online:view', 'monitor:server:view'].includes(p.code)
    ),
  },
]

const initialUsers: UserWithRoles[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@chenguang.com',
    is_active: true,
    roles: [initialRoles[0]],
  },
  {
    id: 2,
    username: 'zhangsan',
    email: 'zhangsan@chenguang.com',
    is_active: true,
    roles: [initialRoles[1]],
  },
  {
    id: 3,
    username: 'lisi',
    email: 'lisi@chenguang.com',
    is_active: true,
    roles: [initialRoles[2]],
  },
  {
    id: 4,
    username: 'wangwu',
    email: 'wangwu@chenguang.com',
    is_active: false,
    roles: [initialRoles[2]],
  },
  {
    id: 5,
    username: 'zhaoliu',
    email: 'zhaoliu@chenguang.com',
    is_active: true,
    roles: [initialRoles[3]],
  },
]

/* ============================================================
 * 可变 Mock 存储
 * ============================================================ */

export let mockPermissions: Permission[] = structuredClone(initialPermissions)
export let mockRoles: Role[] = structuredClone(initialRoles)
export let mockUsers: UserWithRoles[] = structuredClone(initialUsers)

// 用户密码（Mock 统一为 123456，admin 为 123456）
export const mockPasswords: Record<string, string> = {
  admin: '123456',
  zhangsan: '123456',
  lisi: '123456',
  wangwu: '123456',
  zhaoliu: '123456',
}

// 验证码存储：key -> code
const captchaStore = new Map<string, string>()

let userIdSeed = initialUsers.length
let roleIdSeed = initialRoles.length
let permissionIdSeed = initialPermissions.length

/* ============================================================
 * 重置
 * ============================================================ */

export function resetMockData(): void {
  mockPermissions = structuredClone(initialPermissions)
  mockRoles = structuredClone(initialRoles)
  mockUsers = structuredClone(initialUsers)
  captchaStore.clear()
  userIdSeed = initialUsers.length
  roleIdSeed = initialRoles.length
  permissionIdSeed = initialPermissions.length
}

/* ============================================================
 * 查询与变更辅助
 * ============================================================ */

/** 按权限 id 解析完整对象 */
export function resolvePermissions(ids: number[]): Permission[] {
  return mockPermissions.filter((p) => ids.includes(p.id))
}

/** 按角色 id 解析完整对象 */
export function resolveRoles(ids: number[]): Role[] {
  return mockRoles.filter((r) => ids.includes(r.id))
}

/** 用户列表项（列表页附带角色，便于展示） */
export function toUserListItem(user: UserWithRoles): User & { roles: Role[] } {
  const { roles, ...rest } = user
  return { ...rest, roles: roles.map((r) => ({ ...r })) }
}

/** 用户详情（去掉密码等敏感字段，Mock 中无密码字段） */
export function toUserWithRoles(user: UserWithRoles): UserWithRoles {
  return structuredClone(user)
}

/** 分页工具 */
export function paginate<T>(items: T[], page = 1, pageSize = 10) {
  const total = items.length
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    page_size: pageSize,
  }
}

/** 关键词过滤（不区分大小写） */
export function filterByKeyword<T>(items: T[], keyword: string | null | undefined, getText: (item: T) => string): T[] {
  if (!keyword) return items
  const needle = keyword.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => getText(item).toLowerCase().includes(needle))
}

/* ============================================================
 * 验证码
 * ============================================================ */

/** 生成4位验证码（不含易混淆字符） */
export function createCaptchaCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** 保存验证码，返回 key */
export function saveCaptcha(code: string): string {
  const key = `captcha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  captchaStore.set(key, code)
  return key
}

/** 校验验证码（一次性，校验后失效） */
export function verifyCaptcha(key: string, code: string): boolean {
  const expected = captchaStore.get(key)
  if (!expected) return false
  captchaStore.delete(key)
  return expected.toUpperCase() === (code || '').toUpperCase()
}

/** 仅测试使用：读取指定 key 的验证码 */
export function getMockCaptchaCode(key: string): string | undefined {
  return captchaStore.get(key)
}

/** 生成验证码 SVG（data URI，图中包含明文字符以便 Mock 调试） */
export function buildCaptchaImage(code: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
  <rect width="120" height="40" fill="#f1f5f9"/>
  <path d="M0 30 Q30 10 60 26 T120 20" stroke="#cbd5e1" stroke-width="2" fill="none"/>
  <text x="60" y="28" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" letter-spacing="4" fill="#1e293b">${code}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ============================================================
 * ID 生成
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

/* ============================================================
 * 兼容旧 Mock（认证/框架测试）
 * ============================================================ */

/** 所有权限编码 */
export const mockPermissionCodes = initialPermissions.map((p) => p.code)
