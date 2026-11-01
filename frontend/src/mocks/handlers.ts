/**
 * Mock请求处理器 - MSW
 */

import { http, HttpResponse } from 'msw'
import { mockUsers, mockRoles, mockPermissions, paginateUsers } from './data'

// 使用通配前缀，同时兼容浏览器环境与 Node 测试环境
const API_BASE = '*/api'

// 响应包装
function ok(data: any) {
  return HttpResponse.json({
    code: 200,
    message: 'success',
    data,
    timestamp: Date.now(),
  })
}

function fail(code: number, message: string) {
  return HttpResponse.json(
    {
      code,
      message,
      data: null,
      timestamp: Date.now(),
    },
    { status: code }
  )
}

// 认证相关
export const authHandlers = [
  // 登录
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }

    if (!body.username || !body.password) {
      return fail(400, '用户名和密码不能为空')
    }

    const user = mockUsers.find((u) => u.username === body.username)

    if (!user || body.password !== '123456') {
      return fail(401, '用户名或密码错误')
    }

    return ok({
      access_token: 'mock-access-token-' + Date.now(),
      refresh_token: 'mock-refresh-token-' + Date.now(),
      token_type: 'Bearer',
      expires_in: 7200,
      user: {
        ...user,
        permissions: mockPermissions,
      },
    })
  }),

  // 登出
  http.post(`${API_BASE}/auth/logout`, () => {
    return ok(null)
  }),

  // 刷新Token
  http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
    const body = (await request.json()) as { refresh_token: string }
    if (!body.refresh_token) {
      return fail(400, 'refresh_token不能为空')
    }
    return ok({
      access_token: 'mock-access-token-' + Date.now(),
      token_type: 'Bearer',
      expires_in: 7200,
    })
  }),

  // 获取当前用户
  http.get(`${API_BASE}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return fail(401, '未授权')
    }
    return ok({
      ...mockUsers[0],
      permissions: mockPermissions,
    })
  }),

  // 获取验证码
  http.get(`${API_BASE}/auth/captcha`, () => {
    return ok({
      captcha_id: 'mock-captcha-id',
      image: 'data:image/png;base64,mock-captcha-image',
    })
  }),
]

// 用户管理相关
export const userHandlers = [
  // 获取用户列表
  http.get(`${API_BASE}/users`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const page_size = Number(url.searchParams.get('page_size') || 20)
    const keyword = url.searchParams.get('keyword') || undefined
    const status = url.searchParams.get('status')
    const role_id = url.searchParams.get('role_id')

    const result = paginateUsers(
      mockUsers,
      page,
      page_size,
      keyword,
      status ? Number(status) : undefined,
      role_id ? Number(role_id) : undefined
    )

    return ok(result)
  }),

  // 获取角色选项（必须在 /users/:id 之前定义，避免路由冲突）
  http.get(`${API_BASE}/users/role-options`, () => {
    return ok(mockRoles)
  }),

  // 获取用户详情
  http.get(`${API_BASE}/users/:id`, ({ params }) => {
    const id = Number(params.id)
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return fail(404, '用户不存在')
    }
    return ok(user)
  }),

  // 创建用户
  http.post(`${API_BASE}/users`, async ({ request }) => {
    const body = (await request.json()) as any
    const newUser: any = {
      id: mockUsers.length + 1,
      username: body.username,
      email: body.email,
      full_name: body.full_name,
      phone: body.phone,
      avatar: '',
      status: body.status ?? 1,
      status_label: body.status === 0 ? '禁用' : '启用',
      roles: mockRoles.filter((r) => body.role_ids?.includes(r.id)),
      last_login_at: undefined,
      last_login_ip: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockUsers.push(newUser)
    return ok(newUser)
  }),

  // 更新用户
  http.put(`${API_BASE}/users/:id`, async ({ params, request }) => {
    const id = Number(params.id)
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return fail(404, '用户不存在')
    }
    const body = (await request.json()) as any
    Object.assign(user, body, {
      updated_at: new Date().toISOString(),
      status_label: body.status === 0 ? '禁用' : '启用',
    })
    return ok(user)
  }),

  // 删除用户
  http.delete(`${API_BASE}/users/:id`, ({ params }) => {
    const id = Number(params.id)
    const index = mockUsers.findIndex((u) => u.id === id)
    if (index === -1) {
      return fail(404, '用户不存在')
    }
    mockUsers.splice(index, 1)
    return ok(null)
  }),

  // 批量删除用户
  http.post(`${API_BASE}/users/batch-delete`, async ({ request }) => {
    const body = (await request.json()) as { ids: number[] }
    body.ids.forEach((id) => {
      const index = mockUsers.findIndex((u) => u.id === id)
      if (index !== -1) {
        mockUsers.splice(index, 1)
      }
    })
    return ok(null)
  }),

  // 重置密码
  http.post(`${API_BASE}/users/:id/reset-password`, ({ params }) => {
    const id = Number(params.id)
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return fail(404, '用户不存在')
    }
    return ok(null)
  }),

  // 切换状态
  http.patch(`${API_BASE}/users/:id/status`, async ({ params, request }) => {
    const id = Number(params.id)
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return fail(404, '用户不存在')
    }
    const body = (await request.json()) as { status: number }
    user.status = body.status
    user.status_label = body.status === 0 ? '禁用' : '启用'
    return ok(null)
  }),
]

// 所有Mock处理器
export const handlers = [...authHandlers, ...userHandlers]
