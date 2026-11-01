/**
 * API层测试 - RBAC 全接口覆盖
 * 对照 docs/openapi.json，逐一验证 Auth / Captcha / User / Role / Permission 端点
 */

import { describe, it, expect } from 'vitest'
import * as authApi from '@/apis/modules/auth'
import * as rbacApi from '@/apis/modules/rbac'
import { getMockCaptchaCode } from '@/mocks/data'

/** 获取验证码并返回 key / code（Mock 环境可通过测试辅助读取 code） */
async function fetchCaptcha() {
  const captcha = await authApi.getCaptchaApi()
  const code = getMockCaptchaCode(captcha.key)
  if (!code) throw new Error('mock captcha code not found')
  return { key: captcha.key, code }
}

/** 以 admin 身份登录并返回令牌 */
async function loginAsAdmin() {
  const { key, code } = await fetchCaptcha()
  return authApi.loginApi({
    username: 'admin',
    password: '123456',
    captcha_key: key,
    captcha_code: code,
  })
}

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
    const valid = await authApi.verifyCaptchaApi({ key, code })
    expect(valid).toBe(true)
  })

  it('POST /v1/captcha 校验错误验证码', async () => {
    const { key } = await fetchCaptcha()
    const valid = await authApi.verifyCaptchaApi({ key, code: 'ZZZZ' })
    expect(valid).toBe(false)
  })

  it('验证码一次性：校验成功后立即失效', async () => {
    const { key, code } = await fetchCaptcha()
    expect(await authApi.verifyCaptchaApi({ key, code })).toBe(true)
    expect(await authApi.verifyCaptchaApi({ key, code })).toBe(false)
  })

  it('POST /v1/captcha 缺少参数返回 400', async () => {
    await expect(authApi.verifyCaptchaApi({ key: '', code: '' })).rejects.toMatchObject({ code: 400 })
  })
})

/* ============================================================
 * 登录
 * ============================================================ */

describe('RBAC API - 认证登录', () => {
  it('POST /v1/auth/login 登录成功', async () => {
    const result = await loginAsAdmin()
    expect(result.access_token).toMatch(/^mock-token-1-/)
    expect(result.token_type).toBe('bearer')
    expect(result.user.username).toBe('admin')
    expect(result.user.roles.length).toBeGreaterThan(0)
    expect(result.user.permissions).toContain('system:user:view')
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

  it('禁用账号登录返回 403', async () => {
    const { key, code } = await fetchCaptcha()
    await expect(
      authApi.loginApi({ username: 'wangwu', password: '123456', captcha_key: key, captcha_code: code })
    ).rejects.toMatchObject({ code: 403 })
  })
})

/* ============================================================
 * 用户
 * ============================================================ */

describe('RBAC API - 用户', () => {
  it('GET /v1/users 列表（offset/limit）', async () => {
    const all = await rbacApi.getUsersApi({ offset: 0, limit: 100 })
    expect(Array.isArray(all)).toBe(true)
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

    const keyword = await rbacApi.searchUsersApi({ page: 1, page_size: 10, keyword: 'zhang' })
    expect(keyword.items.length).toBe(1)
    expect(keyword.items[0].username).toBe('zhangsan')
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

  it('GET /v1/users/{id} 返回用户详情（含角色）', async () => {
    const user = await rbacApi.getUserApi(2)
    expect(user.username).toBe('zhangsan')
    expect(user.roles.length).toBe(1)
    expect(user.roles[0].code).toBe('admin')
  })

  it('GET /v1/users/{id} 不存在返回 404', async () => {
    await expect(rbacApi.getUserApi(999)).rejects.toMatchObject({ code: 404 })
  })

  it('GET /v1/users/{id}/roles 返回角色列表', async () => {
    const roles = await rbacApi.getUserRolesApi(1)
    expect(roles.length).toBe(1)
    expect(roles[0].code).toBe('super_admin')
  })

  it('GET /v1/users/{id}/roles 用户不存在返回 404', async () => {
    await expect(rbacApi.getUserRolesApi(999)).rejects.toMatchObject({ code: 404 })
  })

  it('PUT /v1/users/{id}/roles 分配角色', async () => {
    const updated = await rbacApi.assignUserRolesApi(3, { role_ids: [1, 4] })
    expect(updated.roles.map((r) => r.code).sort()).toEqual(['auditor', 'super_admin'])

    const roles = await rbacApi.getUserRolesApi(3)
    expect(roles.length).toBe(2)
  })

  it('PUT /v1/users/{id}/roles 空数组清空角色', async () => {
    const updated = await rbacApi.assignUserRolesApi(3, { role_ids: [] })
    expect(updated.roles).toEqual([])
  })

  it('PUT /v1/users/{id}/roles 非法角色返回 400', async () => {
    await expect(
      rbacApi.assignUserRolesApi(3, { role_ids: [999] })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('PUT /v1/users/{id}/roles 用户不存在返回 404', async () => {
    await expect(
      rbacApi.assignUserRolesApi(999, { role_ids: [1] })
    ).rejects.toMatchObject({ code: 404 })
  })

  it('GET /v1/users/me 需要认证', async () => {
    const login = await loginAsAdmin()
    localStorage.setItem('access_token', login.access_token)

    const me = await rbacApi.getCurrentUserApi()
    expect(me.username).toBe('admin')
    expect(me.roles.length).toBe(1)
  })

  it('GET /v1/users/me 未携带令牌返回 401', async () => {
    localStorage.removeItem('access_token')
    await expect(rbacApi.getCurrentUserApi()).rejects.toMatchObject({ code: 401 })
  })
})

/* ============================================================
 * 角色
 * ============================================================ */

describe('RBAC API - 角色', () => {
  it('GET /v1/roles/ 获取全部角色', async () => {
    const roles = await rbacApi.getRolesApi()
    expect(roles.length).toBe(4)
    expect(roles[0].permissions.length).toBeGreaterThan(0)
  })

  it('GET /v1/roles/search 分页与关键词', async () => {
    const page = await rbacApi.searchRolesApi({ page: 1, page_size: 2 })
    expect(page.items.length).toBe(2)
    expect(page.total).toBe(4)

    const keyword = await rbacApi.searchRolesApi({ page: 1, page_size: 10, keyword: '审计' })
    expect(keyword.total).toBe(1)
    expect(keyword.items[0].code).toBe('auditor')
  })

  it('POST /v1/roles 创建角色', async () => {
    const role = await rbacApi.createRoleApi({ code: 'editor', name: '编辑员', description: '内容编辑' })
    expect(role.id).toBeGreaterThan(0)
    expect(role.permissions).toEqual([])

    const list = await rbacApi.getRolesApi()
    expect(list.some((r) => r.code === 'editor')).toBe(true)
  })

  it('POST /v1/roles 重复编码返回 400', async () => {
    await expect(
      rbacApi.createRoleApi({ code: 'admin', name: '重复' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('POST /v1/roles 缺少字段返回 400', async () => {
    await expect(rbacApi.createRoleApi({ code: '', name: '' })).rejects.toMatchObject({ code: 400 })
  })

  it('GET /v1/roles/{id} 角色详情', async () => {
    const role = await rbacApi.getRoleApi(1)
    expect(role.code).toBe('super_admin')
    expect(role.permissions.length).toBe(15)
  })

  it('GET /v1/roles/{id} 不存在返回 404', async () => {
    await expect(rbacApi.getRoleApi(999)).rejects.toMatchObject({ code: 404 })
  })

  it('PUT /v1/roles/{id} 更新角色', async () => {
    const updated = await rbacApi.updateRoleApi(4, { name: '审计专员', description: '只读审计' })
    expect(updated.name).toBe('审计专员')
    expect(updated.description).toBe('只读审计')
    expect(updated.code).toBe('auditor')
  })

  it('PUT /v1/roles/{id} 不存在返回 404', async () => {
    await expect(rbacApi.updateRoleApi(999, { name: 'x' })).rejects.toMatchObject({ code: 404 })
  })

  it('PUT /v1/roles/{id}/permissions 分配权限', async () => {
    const role = await rbacApi.assignRolePermissionsApi(3, { permission_ids: [1, 2, 5] })
    expect(role.permissions.map((p) => p.id).sort()).toEqual([1, 2, 5])
  })

  it('PUT /v1/roles/{id}/permissions 非法权限返回 400', async () => {
    await expect(
      rbacApi.assignRolePermissionsApi(3, { permission_ids: [999] })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('DELETE /v1/roles/{id} 删除角色并同步用户', async () => {
    await expect(rbacApi.deleteRoleApi(4)).resolves.toBeNull()

    const list = await rbacApi.getRolesApi()
    expect(list.some((r) => r.id === 4)).toBe(false)

    // 该角色原本属于 zhaoliu，删除后应从用户身上移除
    const user = await rbacApi.getUserApi(5)
    expect(user.roles.some((r) => r.id === 4)).toBe(false)
  })

  it('DELETE /v1/roles/{id} 不存在返回 404', async () => {
    await expect(rbacApi.deleteRoleApi(999)).rejects.toMatchObject({ code: 404 })
  })
})

/* ============================================================
 * 权限
 * ============================================================ */

describe('RBAC API - 权限', () => {
  it('GET /v1/permissions/ 获取全部权限', async () => {
    const permissions = await rbacApi.getPermissionsApi()
    expect(permissions.length).toBe(15)
    expect(permissions[0]).toHaveProperty('code')
  })

  it('GET /v1/permissions/search 分页与关键词', async () => {
    const page = await rbacApi.searchPermissionsApi({ page: 1, page_size: 5 })
    expect(page.items.length).toBe(5)
    expect(page.total).toBe(15)

    const keyword = await rbacApi.searchPermissionsApi({ page: 1, page_size: 50, keyword: 'monitor' })
    expect(keyword.total).toBe(2)
    expect(keyword.items.every((p) => p.code.startsWith('monitor:'))).toBe(true)
  })

  it('POST /v1/permissions 创建权限', async () => {
    const permission = await rbacApi.createPermissionApi({
      code: 'system:user:update',
      name: '更新用户',
      description: '修改用户信息',
    })
    expect(permission.id).toBeGreaterThan(0)
    expect(permission.code).toBe('system:user:update')
  })

  it('POST /v1/permissions 重复编码返回 400', async () => {
    await expect(
      rbacApi.createPermissionApi({ code: 'dashboard:view', name: '重复' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('POST /v1/permissions 缺少字段返回 400', async () => {
    await expect(
      rbacApi.createPermissionApi({ code: '', name: '' })
    ).rejects.toMatchObject({ code: 400 })
  })

  it('GET /v1/permissions/{id} 权限详情', async () => {
    const permission = await rbacApi.getPermissionApi(1)
    expect(permission.code).toBe('dashboard:view')
  })

  it('GET /v1/permissions/{id} 不存在返回 404', async () => {
    await expect(rbacApi.getPermissionApi(999)).rejects.toMatchObject({ code: 404 })
  })

  it('PUT /v1/permissions/{id} 更新权限并同步角色', async () => {
    const updated = await rbacApi.updatePermissionApi(1, { name: '访问工作台' })
    expect(updated.name).toBe('访问工作台')

    const role = await rbacApi.getRoleApi(1)
    const matched = role.permissions.find((p) => p.id === 1)
    expect(matched?.name).toBe('访问工作台')
  })

  it('PUT /v1/permissions/{id} 不存在返回 404', async () => {
    await expect(rbacApi.updatePermissionApi(999, { name: 'x' })).rejects.toMatchObject({ code: 404 })
  })

  it('DELETE /v1/permissions/{id} 删除权限并同步角色', async () => {
    await expect(rbacApi.deletePermissionApi(15)).resolves.toBeNull()

    const permissions = await rbacApi.getPermissionsApi()
    expect(permissions.some((p) => p.id === 15)).toBe(false)

    const role = await rbacApi.getRoleApi(1)
    expect(role.permissions.some((p) => p.id === 15)).toBe(false)
  })

  it('DELETE /v1/permissions/{id} 不存在返回 404', async () => {
    await expect(rbacApi.deletePermissionApi(999)).rejects.toMatchObject({ code: 404 })
  })
})

/* ============================================================
 * 工具方法
 * ============================================================ */

describe('RBAC API - 工具方法', () => {
  it('getPermissionModule 解析模块前缀', () => {
    expect(rbacApi.getPermissionModule('system:user:view')).toBe('system')
    expect(rbacApi.getPermissionModule('dashboard:view')).toBe('dashboard')
    expect(rbacApi.getPermissionModule('misc')).toBe('misc')
  })
})
