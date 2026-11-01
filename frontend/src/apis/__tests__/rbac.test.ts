/**
 * API层测试 - RBAC V2 全接口覆盖
 * 对照 PRD V2 第 7 章与 rbac-plan.md：Auth / Captcha / User / Role / Permission / 权限上下文 / 权限树
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as authApi from '@/apis/modules/auth'
import * as rbacApi from '@/apis/modules/rbac'
import { getMockCaptchaCode } from '@/mocks/data'
import { authenticate, fetchCaptcha } from '@/test/helpers'

beforeEach(async () => {
  localStorage.clear()
  await authenticate('admin')
})

/* ============================================================
 * 验证码
 * ============================================================ */

describe('RBAC API - 验证码', () => {
  it('GET /v1/captcha 返回 key 与图片', async () => {
    const result = await authApi.getCaptchaApi()
    expect(result.key).toBeTruthy()
    expect(result.image.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('POST /v1/captcha 校验正确验证码', async () => {
    const { key, code } = await fetchCaptcha()
    expect(await authApi.verifyCaptchaApi({ key, code })).toBe(true)
  })

  it('POST /v1/captcha 校验错误验证码', async () => {
    const { key } = await fetchCaptcha()
    expect(await authApi.verifyCaptchaApi({ key, code: 'ZZZZ' })).toBe(false)
  })

  it('验证码一次性：成功后立即失效', async () => {
    const { key, code } = await fetchCaptcha()
    expect(await authApi.verifyCaptchaApi({ key, code })).toBe(true)
    expect(await authApi.verifyCaptchaApi({ key, code })).toBe(false)
  })

  it('缺少参数返回 400', async () => {
    await expect(authApi.verifyCaptchaApi({ key: '', code: '' })).rejects.toMatchObject({ code: 400 })
  })
})

/* ============================================================
 * 登录
 * ============================================================ */

describe('RBAC API - 认证登录', () => {
  it('登录成功返回 token 与用户（不含权限码）', async () => {
    const result = await authenticate('admin')
    expect(result.access_token).toMatch(/^mock-token-1-/)
    expect(result.token_type).toBe('bearer')
    expect(result.user.username).toBe('admin')
    expect(result.user.is_superuser).toBe(true)
    expect(result.user.roles.map((r) => r.code)).toEqual(['admin'])
    // PRD D6：JWT 不携带权限码
    expect((result.user as unknown as { permissions?: string[] }).permissions).toBeUndefined()
  })

  it('密码错误返回 401', async () => {
    const { key, code } = await fetchCaptcha()
    await expect(
      authApi.loginApi({ username: 'admin', password: 'wrong', captcha_key: key, captcha_code: code })
    ).rejects.toMatchObject({ code: 401 })
  })

  it('用户不存在返回 401', async () => {
    const { key, code } = await fetchCaptcha()
    await expect(
      authApi.loginApi({ username: 'nobody', password: '123456', captcha_key: key, captcha_code: code })
    ).rejects.toMatchObject({ code: 401 })
  })

  it('缺少验证码返回 400', async () => {
    await expect(
      authApi.loginApi({ username: 'admin', password: '123456', captcha_key: '', captcha_code: '' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('验证码错误返回 400', async () => {
    const { key } = await fetchCaptcha()
    await expect(
      authApi.loginApi({ username: 'admin', password: '123456', captcha_key: key, captcha_code: 'XXXX' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('禁用账号登录返回 401（40101）', async () => {
    const { key, code } = await fetchCaptcha()
    await expect(
      authApi.loginApi({ username: 'viewer02', password: '123456', captcha_key: key, captcha_code: code })
    ).rejects.toMatchObject({ code: 401 })
  })
})

/* ============================================================
 * 当前用户与权限上下文
 * ============================================================ */

describe('RBAC API - 当前用户权限', () => {
  it('GET /v1/users/me 返回用户与角色', async () => {
    const me = await rbacApi.getCurrentUserApi()
    expect(me.username).toBe('admin')
    expect(me.is_superuser).toBe(true)
    expect(me.roles.length).toBe(1)
  })

  it('GET /v1/users/me 未携带令牌返回 401', async () => {
    localStorage.removeItem('access_token')
    await expect(rbacApi.getCurrentUserApi()).rejects.toMatchObject({ code: 401 })
  })

  it('GET /v1/users/me/permissions 返回完整上下文', async () => {
    const context = await rbacApi.getMyPermissionsApi()
    expect(context.user_id).toBe(1)
    expect(context.username).toBe('admin')
    expect(context.is_superuser).toBe(true)
    expect(context.roles.map((r) => r.code)).toEqual(['admin'])
    // 超管拥有全部 63 条权限
    expect(context.permissions.length).toBe(63)
    expect(context.permissions).toEqual([...context.permissions].sort())
    expect(context.permission_version).toBeGreaterThan(0)
    expect(context.cached_at).toBeTruthy()
  })

  it('权限上下文按角色聚合（operator）', async () => {
    await authenticate('operator01')
    const context = await rbacApi.getMyPermissionsApi()
    expect(context.is_superuser).toBe(false)
    expect(context.permissions.length).toBe(27)
    expect(context.permissions).toContain('agent:create')
    expect(context.permissions).not.toContain('agent:delete')
  })

  it('viewer 拥有 9 条只读权限', async () => {
    await authenticate('viewer01')
    const context = await rbacApi.getMyPermissionsApi()
    expect(context.permissions.length).toBe(9)
    expect(context.permissions).toContain('dashboard:read')
    expect(context.permissions).toContain('provider:read')
    expect(context.permissions).not.toContain('agent:create')
  })
})

/* ============================================================
 * 用户
 * ============================================================ */

describe('RBAC API - 用户', () => {
  it('GET /v1/users 列表（offset/limit）', async () => {
    const all = await rbacApi.getUsersApi({ offset: 0, limit: 100 })
    expect(all.length).toBe(5)

    const limited = await rbacApi.getUsersApi({ offset: 1, limit: 2 })
    expect(limited.length).toBe(2)
    expect(limited[0].id).toBe(2)
  })

  it('GET /v1/users/search 分页与关键词', async () => {
    const page1 = await rbacApi.searchUsersApi({ page: 1, page_size: 2 })
    expect(page1.items.length).toBe(2)
    expect(page1.total).toBe(5)
    expect(page1.page).toBe(1)
    expect(page1.page_size).toBe(2)

    const keyword = await rbacApi.searchUsersApi({ page: 1, page_size: 10, keyword: 'viewer' })
    expect(keyword.total).toBe(2)
  })

  it('POST /v1/users 创建用户', async () => {
    const created = await rbacApi.createUserApi({
      username: 'newuser',
      email: 'newuser@chenguang.com',
      password: '123456',
    })
    expect(created.id).toBeGreaterThan(0)
    expect(created.username).toBe('newuser')
    expect(created.is_active).toBe(true)
    expect(created.is_superuser).toBe(false)
    expect(created.roles).toEqual([])

    const searched = await rbacApi.searchUsersApi({ page: 1, page_size: 10, keyword: 'newuser' })
    expect(searched.total).toBe(1)
  })

  it('POST /v1/users 重复用户名返回 400', async () => {
    await expect(
      rbacApi.createUserApi({ username: 'admin', email: 'other@x.com', password: '123456' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('POST /v1/users 缺少字段返回 400', async () => {
    await expect(
      rbacApi.createUserApi({ username: '', email: '', password: '' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('GET /v1/users/{id} 返回详情与角色', async () => {
    const user = await rbacApi.getUserApi(2)
    expect(user.username).toBe('operator01')
    expect(user.roles.map((r) => r.code)).toEqual(['operator'])
  })

  it('GET /v1/users/{id} 不存在返回 404', async () => {
    await expect(rbacApi.getUserApi(999)).rejects.toMatchObject({ code: 404 })
  })

  it('GET /v1/users/{id}/roles 返回精简角色', async () => {
    const roles = await rbacApi.getUserRolesApi(3)
    expect(roles.length).toBe(1)
    expect(roles[0].code).toBe('viewer')
    expect(roles[0]).not.toHaveProperty('permissions')
  })

  it('PUT /v1/users/{id}/roles 分配角色', async () => {
    const roles = await rbacApi.getRolesApi()
    const operatorId = roles.find((r) => r.code === 'operator')!.id
    const viewerId = roles.find((r) => r.code === 'viewer')!.id

    const updated = await rbacApi.assignUserRolesApi(5, { role_ids: [operatorId, viewerId] })
    expect(updated.roles.map((r) => r.code).sort()).toEqual(['operator', 'viewer'])
  })

  it('PUT /v1/users/{id}/roles 非法角色返回 400', async () => {
    await expect(
      rbacApi.assignUserRolesApi(3, { role_ids: [999] })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('PUT /v1/users/{id} 更新邮箱', async () => {
    const updated = await rbacApi.updateUserApi(2, { email: 'op-new@chenguang.com' })
    expect(updated.email).toBe('op-new@chenguang.com')
  })

  it('PUT /v1/users/{id} 启用/禁用用户', async () => {
    const disabled = await rbacApi.updateUserApi(4, { is_active: true })
    expect(disabled.is_active).toBe(true)
  })

  it('PUT /v1/users/{id} 邮箱重复返回 400', async () => {
    await expect(
      rbacApi.updateUserApi(2, { email: 'admin@chenguang.com' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('DELETE /v1/users/{id} 删除普通用户', async () => {
    await expect(rbacApi.deleteUserApi(5)).resolves.toBeNull()
    const list = await rbacApi.searchUsersApi({ page: 1, page_size: 10 })
    expect(list.total).toBe(4)
  })
})

/* ============================================================
 * 角色
 * ============================================================ */

describe('RBAC API - 角色', () => {
  it('GET /v1/roles/ 返回 4 个角色（含内置标记与用户数）', async () => {
    const roles = await rbacApi.getRolesApi()
    expect(roles.length).toBe(4)
    expect(roles.filter((r) => r.is_system).length).toBe(3)
    expect(roles.find((r) => r.code === 'admin')!.permissions.length).toBe(63)
    expect(roles.find((r) => r.code === 'operator')!.permissions.length).toBe(27)
    expect(roles.find((r) => r.code === 'viewer')!.permissions.length).toBe(9)
  })

  it('GET /v1/roles/search 分页与关键词', async () => {
    const page = await rbacApi.searchRolesApi({ page: 1, page_size: 2 })
    expect(page.items.length).toBe(2)
    expect(page.total).toBe(4)

    const keyword = await rbacApi.searchRolesApi({ page: 1, page_size: 10, keyword: '观察' })
    expect(keyword.total).toBe(1)
    expect(keyword.items[0].code).toBe('viewer')
  })

  it('POST /v1/roles 创建角色（非内置）', async () => {
    const role = await rbacApi.createRoleApi({ code: 'editor', name: '编辑员', description: '内容编辑' })
    expect(role.is_system).toBe(false)
    expect(role.user_count).toBe(0)
    expect(role.permissions).toEqual([])
  })

  it('POST /v1/roles 重复编码返回 400', async () => {
    await expect(rbacApi.createRoleApi({ code: 'admin', name: '重复' })).rejects.toMatchObject({ code: 400 })
  })

  it('POST /v1/roles 非法编码返回 400', async () => {
    await expect(rbacApi.createRoleApi({ code: 'Bad-Code', name: '非法' })).rejects.toMatchObject({ code: 400 })
  })

  it('GET /v1/roles/{id} 角色详情', async () => {
    const role = await rbacApi.getRoleApi(1)
    expect(role.code).toBe('admin')
    expect(role.is_system).toBe(true)
    expect(role.permissions.length).toBe(63)
  })

  it('PUT /v1/roles/{id} 更新名称与描述', async () => {
    const updated = await rbacApi.updateRoleApi(3, { name: '只读用户', description: '仅查看' })
    expect(updated.name).toBe('只读用户')
    expect(updated.code).toBe('viewer')
  })

  it('PUT /v1/roles/{id}/permissions 分配权限', async () => {
    const perms = await rbacApi.getPermissionsApi()
    const ids = perms.filter((p) => ['agent:read', 'agent:create'].includes(p.code)).map((p) => p.id)
    const role = await rbacApi.assignRolePermissionsApi(4, { permission_ids: ids })
    expect(role.permissions.map((p) => p.code).sort()).toEqual(['agent:create', 'agent:read'])
  })

  it('DELETE /v1/roles/{id} 删除未使用的自定义角色', async () => {
    const role = await rbacApi.createRoleApi({ code: 'temp', name: '临时' })
    await expect(rbacApi.deleteRoleApi(role.id)).resolves.toBeNull()
    const list = await rbacApi.getRolesApi()
    expect(list.some((r) => r.id === role.id)).toBe(false)
  })
})

/* ============================================================
 * 权限
 * ============================================================ */

describe('RBAC API - 权限', () => {
  it('GET /v1/permissions/ 返回 63 条权限', async () => {
    const permissions = await rbacApi.getPermissionsApi()
    expect(permissions.length).toBe(63)
    expect(permissions[0]).toHaveProperty('module')
    expect(permissions[0]).toHaveProperty('action')
    expect(permissions[0]).toHaveProperty('is_system')
  })

  it('GET /v1/permissions/tree 按 16 个模块分组', async () => {
    const tree = await rbacApi.getPermissionTreeApi()
    expect(tree.length).toBe(16)
    expect(tree[0].module).toBe('dashboard')
    expect(tree[0].module_name).toBe('工作台')
    expect(tree.every((g) => g.permissions.length > 0)).toBe(true)
    expect(tree.reduce((sum, g) => sum + g.permissions.length, 0)).toBe(63)
  })

  it('GET /v1/permissions/search 分页、关键词与模块筛选', async () => {
    const page = await rbacApi.searchPermissionsApi({ page: 1, page_size: 5 })
    expect(page.items.length).toBe(5)
    expect(page.total).toBe(63)

    const keyword = await rbacApi.searchPermissionsApi({ page: 1, page_size: 50, keyword: 'agent' })
    expect(keyword.items.every((p) => p.code.startsWith('agent:'))).toBe(true)

    const filtered = await rbacApi.searchPermissionsApi({ page: 1, page_size: 50, module: 'system.user' })
    expect(filtered.items.every((p) => p.module === 'system.user')).toBe(true)
    expect(filtered.total).toBe(5)
  })

  it('POST /v1/permissions 创建自定义权限', async () => {
    const permission = await rbacApi.createPermissionApi({
      code: 'custom.report:read',
      name: '查看自定义报表',
    })
    expect(permission.is_system).toBe(false)
    expect(permission.module).toBe('custom.report')
    expect(permission.action).toBe('read')
  })

  it('POST /v1/permissions 格式错误返回 400', async () => {
    await expect(
      rbacApi.createPermissionApi({ code: 'invalidcode', name: '非法' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('POST /v1/permissions 重复编码返回 400', async () => {
    await expect(
      rbacApi.createPermissionApi({ code: 'agent:read', name: '重复' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('GET /v1/permissions/{id} 权限详情', async () => {
    const permission = await rbacApi.getPermissionApi(1)
    expect(permission.code).toBe('dashboard:read')
    expect(permission.module).toBe('dashboard')
  })

  it('PUT /v1/permissions/{id} 更新并同步角色', async () => {
    const updated = await rbacApi.updatePermissionApi(1, { name: '访问工作台' })
    expect(updated.name).toBe('访问工作台')

    const role = await rbacApi.getRoleApi(1)
    expect(role.permissions.find((p) => p.id === 1)?.name).toBe('访问工作台')
  })

  it('DELETE /v1/permissions/{id} 删除自定义权限', async () => {
    const permission = await rbacApi.createPermissionApi({ code: 'custom:read', name: '自定义' })
    await expect(rbacApi.deletePermissionApi(permission.id)).resolves.toBeNull()

    const permissions = await rbacApi.getPermissionsApi()
    expect(permissions.some((p) => p.id === permission.id)).toBe(false)
  })

  it('DELETE /v1/permissions/{id} 不存在返回 404', async () => {
    await expect(rbacApi.deletePermissionApi(999)).rejects.toMatchObject({ code: 404 })
  })
})

/* ============================================================
 * 鉴权与安全边界
 * ============================================================ */

describe('RBAC API - 鉴权与安全边界', () => {
  it('未登录访问受保护接口返回 401', async () => {
    localStorage.removeItem('access_token')
    await expect(rbacApi.searchUsersApi({ page: 1, page_size: 10 })).rejects.toMatchObject({ code: 401 })
  })

  it('viewer 访问系统管理接口返回 403', async () => {
    await authenticate('viewer01')
    await expect(rbacApi.searchUsersApi({ page: 1, page_size: 10 })).rejects.toMatchObject({ code: 403 })
    await expect(rbacApi.getPermissionTreeApi()).rejects.toMatchObject({ code: 403 })
  })

  it('operator 无法创建角色（403）', async () => {
    await authenticate('operator01')
    await expect(rbacApi.createRoleApi({ code: 'x', name: 'x' })).rejects.toMatchObject({ code: 403 })
  })

  it('内置角色不可删除（40303）', async () => {
    await expect(rbacApi.deleteRoleApi(1)).rejects.toMatchObject({ code: 403 })
  })

  it('角色仍被使用时不可删除（40306）', async () => {
    // analyst 角色被 analyst01 使用
    await expect(rbacApi.deleteRoleApi(4)).rejects.toMatchObject({ code: 403 })
  })

  it('内置权限不可删除（40303）', async () => {
    await expect(rbacApi.deletePermissionApi(1)).rejects.toMatchObject({ code: 403 })
  })

  it('admin 角色权限不可缩减（40303）', async () => {
    await expect(
      rbacApi.assignRolePermissionsApi(1, { permission_ids: [1] })
    ).rejects.toMatchObject({ code: 403 })
  })

  it('不能禁用自己（40304）', async () => {
    await expect(rbacApi.updateUserApi(1, { is_active: false })).rejects.toMatchObject({ code: 403 })
  })

  it('不能删除自己（40304）', async () => {
    await expect(rbacApi.deleteUserApi(1)).rejects.toMatchObject({ code: 403 })
  })

  it('不能移除自己的全部角色（40304）', async () => {
    await expect(rbacApi.assignUserRolesApi(1, { role_ids: [] })).rejects.toMatchObject({ code: 403 })
  })

  it('最后超管保护（40305）', async () => {
    // 给 operator01 一个可管理用户的角色
    const perms = await rbacApi.getPermissionsApi()
    const ids = perms
      .filter((p) => ['system.user:update', 'system.user:delete', 'system.user:assign', 'system.role:assign'].includes(p.code))
      .map((p) => p.id)
    const manager = await rbacApi.createRoleApi({ code: 'manager', name: '管理员助理' })
    await rbacApi.assignRolePermissionsApi(manager.id, { permission_ids: ids })
    await rbacApi.assignUserRolesApi(2, { role_ids: [manager.id] })

    await authenticate('operator01')
    await expect(rbacApi.updateUserApi(1, { is_active: false })).rejects.toMatchObject({ code: 403 })
    await expect(rbacApi.deleteUserApi(1)).rejects.toMatchObject({ code: 403 })
  })

  it('非超管不能给自己分配 admin 角色（40302）', async () => {
    const perms = await rbacApi.getPermissionsApi()
    const ids = perms.filter((p) => p.code === 'system.user:assign').map((p) => p.id)
    const manager = await rbacApi.createRoleApi({ code: 'assigner', name: '授权员' })
    await rbacApi.assignRolePermissionsApi(manager.id, { permission_ids: ids })
    await rbacApi.assignUserRolesApi(2, { role_ids: [manager.id] })

    await authenticate('operator01')
    await expect(
      rbacApi.assignUserRolesApi(2, { role_ids: [manager.id, 1] })
    ).rejects.toMatchObject({ code: 403 })
  })
})

/* ============================================================
 * 工具方法
 * ============================================================ */

describe('RBAC API - 工具方法', () => {
  it('getPermissionModule 解析模块前缀', () => {
    expect(rbacApi.getPermissionModule('system.user:read')).toBe('system.user')
    expect(rbacApi.getPermissionModule('agent:read')).toBe('agent')
  })

  it('isValidPermissionCode 校验权限码格式', () => {
    expect(rbacApi.isValidPermissionCode('agent:read')).toBe(true)
    expect(rbacApi.isValidPermissionCode('system.user:read')).toBe(true)
    expect(rbacApi.isValidPermissionCode('invalid')).toBe(false)
    expect(rbacApi.isValidPermissionCode('Agent:Read')).toBe(false)
  })
})
