/**
 * Mock请求处理器 - RBAC V2 全量接口
 * 覆盖 rbac-plan.md / PRD V2 的 27 个端点，并实现接口鉴权与安全边界
 */

import { http, HttpResponse } from 'msw'
import {
  mockUsers,
  mockRoles,
  mockPermissions,
  mockPasswords,
  mockUserRoles,
  resolvePermissionsByIds,
  resolveRolesByIds,
  getUserRoleIds,
  getUserRoleLites,
  getUserRoles,
  getEffectivePermissionCodes,
  getPermissionVersion,
  bumpPermissionVersion,
  syncRoleUserCount,
  toUserRead,
  toUserWithRoles,
  toRoleLite,
  buildPermissionTree,
  paginate,
  filterByKeyword,
  createCaptchaCode,
  saveCaptcha,
  verifyCaptcha,
  buildCaptchaImage,
  nextUserId,
  nextRoleId,
  nextPermissionId,
  PERMISSION_CODE_PATTERN,
} from './data'
import type { MockUserRecord } from './data'
import type { Permission, Role, UserWithRoles } from '@/apis/modules/rbac'

const API = '*/api/v1'

/* ============================================================
 * 响应辅助
 * ============================================================ */

function ok<T>(data: T) {
  return HttpResponse.json({ code: 200, message: 'success', data, timestamp: Date.now() })
}

/** 业务失败：HTTP 状态 + 业务码（PRD 7.1） */
function fail(status: number, message: string, bizCode?: number) {
  return HttpResponse.json(
    { code: status, message, data: null, biz_code: bizCode, timestamp: Date.now() },
    { status }
  )
}

function parseTokenUserId(request: Request): number | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const match = /^mock-token-(\d+)-/.exec(auth.slice('Bearer '.length))
  return match ? Number(match[1]) : null
}

function getCaller(request: Request): MockUserRecord | null {
  const userId = parseTokenUserId(request)
  if (userId === null) return null
  return mockUsers.find((u) => u.id === userId) || null
}

/** 鉴权：登录 + 账号启用 + 权限码（超管直通） */
function authorize(request: Request, requiredCode?: string): Response | null {
  const caller = getCaller(request)
  if (!caller) return fail(401, '未登录或 Token 已失效', 40100)
  if (!caller.is_active) return fail(401, '账号已被禁用', 40101)
  if (!requiredCode) return null
  if (caller.is_superuser) return null

  const codes = getEffectivePermissionCodes(caller)
  if (!codes.includes(requiredCode)) {
    return fail(403, `缺少权限码：${requiredCode}`, 40301)
  }
  return null
}

function activeSuperuserCount(): number {
  return mockUsers.filter((u) => u.is_superuser && u.is_active).length
}

/** 用户授权上下文（PRD 7.2.1） */
function buildPermissionContext(user: MockUserRecord) {
  return {
    user_id: user.id,
    username: user.username,
    is_superuser: user.is_superuser,
    roles: getUserRoleLites(user.id),
    permissions: getEffectivePermissionCodes(user),
    permission_version: getPermissionVersion(),
    cached_at: new Date().toISOString(),
  }
}

/* ============================================================
 * 认证
 * ============================================================ */

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      username?: string
      password?: string
      captcha_key?: string
      captcha_code?: string
    }

    if (!body.username || !body.password) return fail(400, '用户名和密码不能为空')
    if (!body.captcha_key || !body.captcha_code) return fail(400, '验证码不能为空')
    if (!verifyCaptcha(body.captcha_key, body.captcha_code)) {
      return fail(400, '验证码错误或已过期')
    }

    const user = mockUsers.find((u) => u.username === body.username)
    if (!user || mockPasswords[user.username] !== body.password) {
      return fail(401, '用户名或密码错误', 40100)
    }
    if (!user.is_active) return fail(401, '账号已被禁用', 40101)

    user.last_login = new Date().toISOString().slice(0, 19).replace('T', ' ')

    return ok({
      access_token: `mock-token-${user.id}-${Date.now()}`,
      refresh_token: `mock-refresh-${user.id}-${Date.now()}`,
      token_type: 'bearer',
      expires_in: 7200,
      user: toUserRead(user),
    })
  }),
]

/* ============================================================
 * 验证码
 * ============================================================ */

export const captchaHandlers = [
  http.get(`${API}/captcha`, () => {
    const code = createCaptchaCode()
    const key = saveCaptcha(code)
    return ok({ key, image: buildCaptchaImage(code) })
  }),

  http.post(`${API}/captcha`, async ({ request }) => {
    const body = (await request.json()) as { key?: string; code?: string }
    if (!body.key || !body.code) return fail(400, '验证码 key 与 code 不能为空')
    return ok(verifyCaptcha(body.key, body.code))
  }),
]

/* ============================================================
 * 用户
 * ============================================================ */

export const userHandlers = [
  // 当前用户信息（仅登录）
  http.get(`${API}/users/me`, ({ request }) => {
    const denied = authorize(request)
    if (denied) return denied
    const caller = getCaller(request)!
    return ok(toUserRead(caller))
  }),

  // 当前用户权限上下文（仅登录，PRD 7.2.1）
  http.get(`${API}/users/me/permissions`, ({ request }) => {
    const denied = authorize(request)
    if (denied) return denied
    return ok(buildPermissionContext(getCaller(request)!))
  }),

  // 分页搜索用户
  http.get(`${API}/users/search`, ({ request }) => {
    const denied = authorize(request, 'system.user:read')
    if (denied) return denied

    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    const keyword = url.searchParams.get('keyword')

    const filtered = filterByKeyword(mockUsers, keyword, (u) => `${u.username} ${u.email}`)
    return ok(paginate(filtered.map(toUserRead), page, pageSize))
  }),

  // 用户列表（offset/limit）
  http.get(`${API}/users`, ({ request }) => {
    const denied = authorize(request, 'system.user:read')
    if (denied) return denied

    const url = new URL(request.url)
    const offset = Number(url.searchParams.get('offset') || 0)
    const limit = Number(url.searchParams.get('limit') || 100)
    return ok(mockUsers.slice(offset, offset + limit).map(toUserRead))
  }),

  // 创建用户
  http.post(`${API}/users`, async ({ request }) => {
    const denied = authorize(request, 'system.user:create')
    if (denied) return denied

    const body = (await request.json()) as { username?: string; email?: string; password?: string }
    if (!body.username || !body.email || !body.password) {
      return fail(400, '用户名、邮箱、密码均为必填')
    }
    if (mockUsers.some((u) => u.username === body.username)) return fail(400, '用户名已存在')
    if (mockUsers.some((u) => u.email === body.email)) return fail(400, '邮箱已被使用')

    const user: MockUserRecord = {
      id: nextUserId(),
      username: body.username,
      email: body.email,
      is_active: true,
      is_superuser: false,
      last_login: null,
    }
    mockUsers.push(user)
    mockUserRoles[user.id] = []
    mockPasswords[user.username] = body.password
    return ok(toUserRead(user))
  }),

  // 用户详情
  http.get(`${API}/users/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.user:read')
    if (denied) return denied

    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')
    return ok(toUserWithRoles(user))
  }),

  // 用户角色列表
  http.get(`${API}/users/:id/roles`, ({ request, params }) => {
    const denied = authorize(request, 'system.user:read')
    if (denied) return denied

    const userId = Number(params.id)
    if (!mockUsers.some((u) => u.id === userId)) return fail(404, '用户不存在')
    return ok(getUserRoleLites(userId))
  }),

  // 更新用户（邮箱 / 启停，PRD 7.2.3）
  http.put(`${API}/users/:id`, async ({ request, params }) => {
    const denied = authorize(request, 'system.user:update')
    if (denied) return denied

    const caller = getCaller(request)!
    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')

    const body = (await request.json()) as { email?: string; is_active?: boolean }

    // 自我操作保护（40304）
    if (userId === caller.id && body.is_active === false) {
      return fail(403, '不能禁用当前登录账号', 40304)
    }
    // 最后超管保护（40305）
    if (user.is_superuser && body.is_active === false && activeSuperuserCount() <= 1) {
      return fail(403, '系统必须保留至少一个启用的超级管理员', 40305)
    }
    // 邮箱唯一
    if (body.email && mockUsers.some((u) => u.id !== userId && u.email === body.email)) {
      return fail(400, '邮箱已被使用')
    }

    if (body.email !== undefined) user.email = body.email
    if (body.is_active !== undefined) user.is_active = body.is_active
    return ok(toUserRead(user))
  }),

  // 删除用户
  http.delete(`${API}/users/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.user:delete')
    if (denied) return denied

    const caller = getCaller(request)!
    const userId = Number(params.id)
    const index = mockUsers.findIndex((u) => u.id === userId)
    if (index === -1) return fail(404, '用户不存在')

    const target = mockUsers[index]
    if (userId === caller.id) return fail(403, '不能删除当前登录账号', 40304)
    if (target.is_superuser && activeSuperuserCount() <= 1) {
      return fail(403, '系统必须保留至少一个启用的超级管理员', 40305)
    }

    mockUsers.splice(index, 1)
    delete mockUserRoles[userId]
    delete mockPasswords[target.username]
    syncRoleUserCount()
    return ok(null)
  }),

  // 分配用户角色
  http.put(`${API}/users/:id/roles`, async ({ request, params }) => {
    const denied = authorize(request, 'system.user:assign')
    if (denied) return denied

    const caller = getCaller(request)!
    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')

    const body = (await request.json()) as { role_ids?: number[] }
    if (!Array.isArray(body.role_ids)) return fail(400, 'role_ids 必须为数组')

    const unknown = body.role_ids.find((id) => !mockRoles.some((r) => r.id === id))
    if (unknown !== undefined) return fail(400, `角色 ${unknown} 不存在`)

    // 自我移除全部角色（40304）
    if (userId === caller.id && body.role_ids.length === 0) {
      return fail(403, '不能移除自己的全部角色', 40304)
    }
    // 非超管自我提权到 admin（40302）
    if (userId === caller.id && !caller.is_superuser) {
      const adminRole = mockRoles.find((r) => r.code === 'admin')
      if (adminRole && body.role_ids.includes(adminRole.id)) {
        return fail(403, '不能给自己分配超级管理员角色', 40302)
      }
    }

    mockUserRoles[userId] = [...body.role_ids]
    syncRoleUserCount()
    return ok(toUserWithRoles(user))
  }),
]

/* ============================================================
 * 角色
 * ============================================================ */

export const roleHandlers = [
  // 所有角色
  http.get(`${API}/roles/`, ({ request }) => {
    const denied = authorize(request, 'system.role:read')
    if (denied) return denied
    return ok(structuredClone(mockRoles))
  }),

  // 分页搜索角色
  http.get(`${API}/roles/search`, ({ request }) => {
    const denied = authorize(request, 'system.role:read')
    if (denied) return denied

    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    const keyword = url.searchParams.get('keyword')

    const filtered = filterByKeyword(
      mockRoles,
      keyword,
      (r) => `${r.code} ${r.name} ${r.description || ''}`
    )
    return ok(paginate(structuredClone(filtered), page, pageSize))
  }),

  // 创建角色
  http.post(`${API}/roles`, async ({ request }) => {
    const denied = authorize(request, 'system.role:create')
    if (denied) return denied

    const body = (await request.json()) as { code?: string; name?: string; description?: string | null }
    if (!body.code || !body.name) return fail(400, '角色编码与名称不能为空')
    if (!/^[a-z][a-z0-9_]*$/.test(body.code)) return fail(400, '角色编码格式不正确')
    if (mockRoles.some((r) => r.code === body.code)) return fail(400, '角色编码已存在')

    const role: Role = {
      id: nextRoleId(),
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      is_system: false,
      sort_order: mockRoles.length + 1,
      user_count: 0,
      permissions: [],
    }
    mockRoles.push(role)
    bumpPermissionVersion()
    return ok(structuredClone(role))
  }),

  // 角色详情
  http.get(`${API}/roles/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.role:read')
    if (denied) return denied

    const role = mockRoles.find((r) => r.id === Number(params.id))
    if (!role) return fail(404, '角色不存在')
    return ok(structuredClone(role))
  }),

  // 更新角色（内置角色允许改名称/描述，PRD D2）
  http.put(`${API}/roles/:id`, async ({ request, params }) => {
    const denied = authorize(request, 'system.role:update')
    if (denied) return denied

    const role = mockRoles.find((r) => r.id === Number(params.id))
    if (!role) return fail(404, '角色不存在')

    const body = (await request.json()) as { name?: string | null; description?: string | null }
    if (body.name !== undefined && body.name !== null) role.name = body.name
    if (body.description !== undefined) role.description = body.description
    return ok(structuredClone(role))
  }),

  // 删除角色（内置保护 40303 / 使用中 40306）
  http.delete(`${API}/roles/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.role:delete')
    if (denied) return denied

    const roleId = Number(params.id)
    const index = mockRoles.findIndex((r) => r.id === roleId)
    if (index === -1) return fail(404, '角色不存在')

    const role = mockRoles[index]
    if (role.is_system) return fail(403, '内置角色不允许删除', 40303)

    const inUse = Object.values(mockUserRoles).filter((ids) => ids.includes(roleId)).length
    if (inUse > 0) return fail(403, `角色仍被 ${inUse} 个用户使用`, 40306)

    mockRoles.splice(index, 1)
    bumpPermissionVersion()
    syncRoleUserCount()
    return ok(null)
  }),

  // 分配角色权限（admin 固定全量，不可缩减，PRD D2）
  http.put(`${API}/roles/:id/permissions`, async ({ request, params }) => {
    const denied = authorize(request, 'system.role:assign')
    if (denied) return denied

    const role = mockRoles.find((r) => r.id === Number(params.id))
    if (!role) return fail(404, '角色不存在')
    if (role.code === 'admin') return fail(403, '内置超级管理员角色权限固定，不可修改', 40303)

    const body = (await request.json()) as { permission_ids?: number[] }
    if (!Array.isArray(body.permission_ids)) return fail(400, 'permission_ids 必须为数组')

    const unknown = body.permission_ids.find((id) => !mockPermissions.some((p) => p.id === id))
    if (unknown !== undefined) return fail(400, `权限 ${unknown} 不存在`)

    role.permissions = resolvePermissionsByIds(body.permission_ids)
    bumpPermissionVersion()
    return ok(structuredClone(role))
  }),
]

/* ============================================================
 * 权限
 * ============================================================ */

export const permissionHandlers = [
  // 所有权限
  http.get(`${API}/permissions/`, ({ request }) => {
    const denied = authorize(request, 'system.permission:read')
    if (denied) return denied
    return ok(structuredClone(mockPermissions))
  }),

  // 权限树（PRD 7.2.2）
  http.get(`${API}/permissions/tree`, ({ request }) => {
    const denied = authorize(request, 'system.permission:read')
    if (denied) return denied
    return ok(buildPermissionTree())
  }),

  // 分页搜索权限
  http.get(`${API}/permissions/search`, ({ request }) => {
    const denied = authorize(request, 'system.permission:read')
    if (denied) return denied

    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    const keyword = url.searchParams.get('keyword')
    const module = url.searchParams.get('module')

    let filtered = filterByKeyword(
      mockPermissions,
      keyword,
      (p) => `${p.code} ${p.name} ${p.description || ''}`
    )
    if (module) filtered = filtered.filter((p) => p.module === module)

    return ok(paginate(structuredClone(filtered), page, pageSize))
  }),

  // 创建权限（格式校验，PRD 4.2）
  http.post(`${API}/permissions`, async ({ request }) => {
    const denied = authorize(request, 'system.permission:create')
    if (denied) return denied

    const body = (await request.json()) as { code?: string; name?: string; description?: string | null }
    if (!body.code || !body.name) return fail(400, '权限编码与名称不能为空')
    if (!PERMISSION_CODE_PATTERN.test(body.code)) {
      return fail(400, '权限码格式不正确，应为 模块:操作（如 agent:read、system.user:read）')
    }
    if (mockPermissions.some((p) => p.code === body.code)) return fail(400, '权限编码已存在')

    const module = body.code.split(':')[0]
    const action = body.code.split(':')[1]
    const permission: Permission = {
      id: nextPermissionId(),
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      module,
      action,
      is_system: false,
      sort_order: mockPermissions.length + 1,
    }
    mockPermissions.push(permission)
    bumpPermissionVersion()
    return ok(structuredClone(permission))
  }),

  // 权限详情
  http.get(`${API}/permissions/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.permission:read')
    if (denied) return denied

    const permission = mockPermissions.find((p) => p.id === Number(params.id))
    if (!permission) return fail(404, '权限不存在')
    return ok(structuredClone(permission))
  }),

  // 更新权限（仅名称/描述，code 不可变）
  http.put(`${API}/permissions/:id`, async ({ request, params }) => {
    const denied = authorize(request, 'system.permission:update')
    if (denied) return denied

    const permissionId = Number(params.id)
    const permission = mockPermissions.find((p) => p.id === permissionId)
    if (!permission) return fail(404, '权限不存在')

    const body = (await request.json()) as { name?: string | null; description?: string | null }
    if (body.name !== undefined && body.name !== null) permission.name = body.name
    if (body.description !== undefined) permission.description = body.description

    mockRoles.forEach((role) => {
      role.permissions = role.permissions.map((p) =>
        p.id === permissionId ? structuredClone(permission) : p
      )
    })
    bumpPermissionVersion()
    return ok(structuredClone(permission))
  }),

  // 删除权限（内置保护 40303）
  http.delete(`${API}/permissions/:id`, ({ request, params }) => {
    const denied = authorize(request, 'system.permission:delete')
    if (denied) return denied

    const permissionId = Number(params.id)
    const index = mockPermissions.findIndex((p) => p.id === permissionId)
    if (index === -1) return fail(404, '权限不存在')

    const permission = mockPermissions[index]
    if (permission.is_system) return fail(403, '内置权限不允许删除', 40303)

    mockPermissions.splice(index, 1)
    mockRoles.forEach((role) => {
      role.permissions = role.permissions.filter((p) => p.id !== permissionId)
    })
    bumpPermissionVersion()
    return ok(null)
  }),
]

/* ============================================================
 * 汇总
 * ============================================================ */

export const handlers = [
  ...authHandlers,
  ...captchaHandlers,
  ...userHandlers,
  ...roleHandlers,
  ...permissionHandlers,
]
