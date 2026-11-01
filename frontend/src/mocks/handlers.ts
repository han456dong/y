/**
 * Mock请求处理器 - RBAC 全量接口
 * 覆盖 docs/openapi.json 中 Auth / Captcha / User / Role / Permission 全部端点
 */

import { http, HttpResponse } from 'msw'
import {
  mockUsers,
  mockRoles,
  mockPermissions,
  mockPasswords,
  resetMockData,
  resolvePermissions,
  resolveRoles,
  toUserListItem,
  paginate,
  filterByKeyword,
  createCaptchaCode,
  saveCaptcha,
  verifyCaptcha,
  buildCaptchaImage,
  nextUserId,
  nextRoleId,
  nextPermissionId,
} from './data'
import type { Permission, Role, User, UserWithRoles } from '@/apis/modules/rbac'

const API = '*/api/v1'

/* ============================================================
 * 响应辅助
 * ============================================================ */

function ok<T>(data: T) {
  return HttpResponse.json({ code: 200, message: 'success', data, timestamp: Date.now() })
}

function fail(status: number, message: string) {
  return HttpResponse.json(
    { code: status, message, data: null, timestamp: Date.now() },
    { status }
  )
}

function parseTokenUserId(request: Request): number | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice('Bearer '.length)
  // 令牌格式：mock-token-{userId}-{timestamp}
  const match = /^mock-token-(\d+)-/.exec(token)
  return match ? Number(match[1]) : null
}

/** 用户详情携带角色与权限码 */
function toLoginUser(user: UserWithRoles) {
  return {
    ...user,
    permissions: [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))],
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
    if (!verifyCaptcha(body.captcha_key, body.captcha_code)) return fail(400, '验证码错误或已过期')

    const user = mockUsers.find((u) => u.username === body.username)
    if (!user) return fail(401, '用户名或密码错误')
    if (mockPasswords[user.username] !== body.password) return fail(401, '用户名或密码错误')
    if (!user.is_active) return fail(403, '账号已被禁用')

    return ok({
      access_token: `mock-token-${user.id}-${Date.now()}`,
      refresh_token: `mock-refresh-${user.id}-${Date.now()}`,
      token_type: 'bearer',
      expires_in: 7200,
      user: toLoginUser(user),
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
  // 获取当前登录用户（必须在 /users/:id 之前）
  http.get(`${API}/users/me`, ({ request }) => {
    const userId = parseTokenUserId(request)
    if (userId === null) return fail(401, '未授权')
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(401, '用户不存在')
    return ok(toLoginUser(user))
  }),

  // 分页搜索用户（必须在 /users/:id 之前）
  http.get(`${API}/users/search`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    const keyword = url.searchParams.get('keyword')

    const filtered = filterByKeyword(mockUsers, keyword, (u) => `${u.username} ${u.email}`)
    return ok(paginate(filtered.map(toUserListItem), page, pageSize))
  }),

  // 用户列表（offset / limit）
  http.get(`${API}/users`, ({ request }) => {
    const url = new URL(request.url)
    const offset = Number(url.searchParams.get('offset') || 0)
    const limit = Number(url.searchParams.get('limit') || 100)
    const items = mockUsers.slice(offset, offset + limit).map(toUserListItem)
    return ok(items)
  }),

  // 创建用户
  http.post(`${API}/users`, async ({ request }) => {
    const body = (await request.json()) as { username?: string; email?: string; password?: string }

    if (!body.username || !body.email || !body.password) {
      return fail(400, '用户名、邮箱、密码均为必填')
    }
    if (mockUsers.some((u) => u.username === body.username)) return fail(400, '用户名已存在')
    if (mockUsers.some((u) => u.email === body.email)) return fail(400, '邮箱已被使用')

    const user: UserWithRoles = {
      id: nextUserId(),
      username: body.username,
      email: body.email,
      is_active: true,
      roles: [],
    }
    mockUsers.push(user)
    mockPasswords[user.username] = body.password

    const created: User = { id: user.id, username: user.username, email: user.email, is_active: user.is_active }
    return ok(created)
  }),

  // 用户详情
  http.get(`${API}/users/:id`, ({ params }) => {
    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')
    return ok(structuredClone(user))
  }),

  // 用户角色列表
  http.get(`${API}/users/:id/roles`, ({ params }) => {
    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')
    return ok(structuredClone(user.roles))
  }),

  // 分配用户角色
  http.put(`${API}/users/:id/roles`, async ({ params, request }) => {
    const userId = Number(params.id)
    const user = mockUsers.find((u) => u.id === userId)
    if (!user) return fail(404, '用户不存在')

    const body = (await request.json()) as { role_ids?: number[] }
    if (!Array.isArray(body.role_ids)) return fail(400, 'role_ids 必须为数组')

    const unknownRole = body.role_ids.find((id) => !mockRoles.some((r) => r.id === id))
    if (unknownRole !== undefined) return fail(400, `角色 ${unknownRole} 不存在`)

    user.roles = structuredClone(resolveRoles(body.role_ids))
    return ok(structuredClone(user))
  }),
]

/* ============================================================
 * 角色
 * ============================================================ */

export const roleHandlers = [
  // 获取所有角色（路径带尾斜杠，与 OpenAPI 一致）
  http.get(`${API}/roles/`, () => ok(structuredClone(mockRoles))),

  // 分页搜索角色（必须在 /roles/:id 之前）
  http.get(`${API}/roles/search`, ({ request }) => {
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
    const body = (await request.json()) as { code?: string; name?: string; description?: string | null }
    if (!body.code || !body.name) return fail(400, '角色编码与名称不能为空')
    if (mockRoles.some((r) => r.code === body.code)) return fail(400, '角色编码已存在')

    const role: Role = {
      id: nextRoleId(),
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      permissions: [],
    }
    mockRoles.push(role)
    return ok(structuredClone(role))
  }),

  // 角色详情
  http.get(`${API}/roles/:id`, ({ params }) => {
    const roleId = Number(params.id)
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return fail(404, '角色不存在')
    return ok(structuredClone(role))
  }),

  // 更新角色
  http.put(`${API}/roles/:id`, async ({ params, request }) => {
    const roleId = Number(params.id)
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return fail(404, '角色不存在')

    const body = (await request.json()) as { name?: string | null; description?: string | null }
    if (body.name !== undefined && body.name !== null) role.name = body.name
    if (body.description !== undefined) role.description = body.description
    return ok(structuredClone(role))
  }),

  // 删除角色
  http.delete(`${API}/roles/:id`, ({ params }) => {
    const roleId = Number(params.id)
    const index = mockRoles.findIndex((r) => r.id === roleId)
    if (index === -1) return fail(404, '角色不存在')

    mockRoles.splice(index, 1)
    // 同步移除用户身上的该角色
    mockUsers.forEach((user) => {
      user.roles = user.roles.filter((r) => r.id !== roleId)
    })
    return ok(null)
  }),

  // 分配角色权限
  http.put(`${API}/roles/:id/permissions`, async ({ params, request }) => {
    const roleId = Number(params.id)
    const role = mockRoles.find((r) => r.id === roleId)
    if (!role) return fail(404, '角色不存在')

    const body = (await request.json()) as { permission_ids?: number[] }
    if (!Array.isArray(body.permission_ids)) return fail(400, 'permission_ids 必须为数组')

    const unknown = body.permission_ids.find((id) => !mockPermissions.some((p) => p.id === id))
    if (unknown !== undefined) return fail(400, `权限 ${unknown} 不存在`)

    role.permissions = structuredClone(resolvePermissions(body.permission_ids))

    // 同步用户对象中角色引用的权限（Mock 为保证一致性）
    mockUsers.forEach((user) => {
      user.roles = user.roles.map((r) => (r.id === roleId ? structuredClone(role) : r))
    })
    return ok(structuredClone(role))
  }),
]

/* ============================================================
 * 权限
 * ============================================================ */

export const permissionHandlers = [
  // 获取所有权限（路径带尾斜杠）
  http.get(`${API}/permissions/`, () => ok(structuredClone(mockPermissions))),

  // 分页搜索权限（必须在 /permissions/:id 之前）
  http.get(`${API}/permissions/search`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('page_size') || 10)
    const keyword = url.searchParams.get('keyword')

    const filtered = filterByKeyword(
      mockPermissions,
      keyword,
      (p) => `${p.code} ${p.name} ${p.description || ''}`
    )
    return ok(paginate(structuredClone(filtered), page, pageSize))
  }),

  // 创建权限
  http.post(`${API}/permissions`, async ({ request }) => {
    const body = (await request.json()) as { code?: string; name?: string; description?: string | null }
    if (!body.code || !body.name) return fail(400, '权限编码与名称不能为空')
    if (mockPermissions.some((p) => p.code === body.code)) return fail(400, '权限编码已存在')

    const permission: Permission = {
      id: nextPermissionId(),
      code: body.code,
      name: body.name,
      description: body.description ?? null,
    }
    mockPermissions.push(permission)
    return ok(structuredClone(permission))
  }),

  // 权限详情
  http.get(`${API}/permissions/:id`, ({ params }) => {
    const permissionId = Number(params.id)
    const permission = mockPermissions.find((p) => p.id === permissionId)
    if (!permission) return fail(404, '权限不存在')
    return ok(structuredClone(permission))
  }),

  // 更新权限
  http.put(`${API}/permissions/:id`, async ({ params, request }) => {
    const permissionId = Number(params.id)
    const permission = mockPermissions.find((p) => p.id === permissionId)
    if (!permission) return fail(404, '权限不存在')

    const body = (await request.json()) as { name?: string | null; description?: string | null }
    if (body.name !== undefined && body.name !== null) permission.name = body.name
    if (body.description !== undefined) permission.description = body.description

    // 同步角色中引用的权限对象
    mockRoles.forEach((role) => {
      role.permissions = role.permissions.map((p) =>
        p.id === permissionId ? structuredClone(permission) : p
      )
    })
    return ok(structuredClone(permission))
  }),

  // 删除权限
  http.delete(`${API}/permissions/:id`, ({ params }) => {
    const permissionId = Number(params.id)
    const index = mockPermissions.findIndex((p) => p.id === permissionId)
    if (index === -1) return fail(404, '权限不存在')

    mockPermissions.splice(index, 1)
    // 同步移除角色上的该权限
    mockRoles.forEach((role) => {
      role.permissions = role.permissions.filter((p) => p.id !== permissionId)
    })
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

export { resetMockData }
