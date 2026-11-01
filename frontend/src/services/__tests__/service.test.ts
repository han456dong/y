/**
 * Service层测试 - 认证与 RBAC 业务逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { authService } from '@/services/auth'
import { rbacUserService, rbacRoleService, rbacPermissionService, RbacRoleService } from '@/services/rbac'
import { apiLogin, loginParams } from '@/test/helpers'

/* ============================================================
 * AuthService
 * ============================================================ */

describe('Service层 - AuthService', () => {
  beforeEach(() => {
    localStorage.clear()
    authService.reset()
  })

  it('登录成功并同步用户/权限/角色', async () => {
    const result = await authService.login(await loginParams())

    expect(result).not.toBeNull()
    expect(authService.isAuthenticated.value).toBe(true)
    expect(authService.user.value?.username).toBe('admin')
    expect(authService.roles.value).toContain('super_admin')
    expect(authService.permissions.value).toContain('system:user:view')
  })

  it('登录失败 - 密码错误', async () => {
    await expect(authService.login(await loginParams('admin', 'bad-pass'))).rejects.toThrow()
    expect(authService.isAuthenticated.value).toBe(false)
  })

  it('获取当前用户信息', async () => {
    await authService.login(await loginParams())
    const user = await authService.fetchUserInfo()
    expect(user).not.toBeNull()
    expect(user!.username).toBe('admin')
  })

  it('权限检查', async () => {
    await authService.login(await loginParams())

    expect(authService.hasPermission('system:user:view')).toBe(true)
    expect(authService.hasPermission(['system:user:view', 'nope'])).toBe(true)
    expect(authService.hasPermission('nope')).toBe(false)
    expect(authService.hasRole('super_admin')).toBe(true)
    expect(authService.isAdmin).toBe(true)
  })

  it('登出清空登录态', async () => {
    await authService.login(await loginParams())
    await authService.logout(false)

    expect(authService.isAuthenticated.value).toBe(false)
    expect(authService.user.value).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('getState 返回状态快照', async () => {
    await authService.login(await loginParams())
    const state = authService.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.permissions.length).toBeGreaterThan(0)
  })

  it('未登录时 fetchUserInfo 返回 null', async () => {
    const user = await authService.fetchUserInfo()
    expect(user).toBeNull()
  })
})

/* ============================================================
 * 用户服务
 * ============================================================ */

describe('Service层 - RbacUserService', () => {
  beforeEach(() => {
    rbacUserService.reset()
  })

  it('加载用户列表', async () => {
    const result = await rbacUserService.load({ page: 1, page_size: 10 })
    expect(result).not.toBeNull()
    expect(rbacUserService.items.value.length).toBe(5)
    expect(rbacUserService.pagination.value.total).toBe(5)
    expect(rbacUserService.loading.value).toBe(false)
  })

  it('关键词搜索', async () => {
    await rbacUserService.search('lisi')
    expect(rbacUserService.items.value.length).toBe(1)
    expect(rbacUserService.items.value[0].username).toBe('lisi')
  })

  it('分页切换', async () => {
    await rbacUserService.load({ page: 1, page_size: 2 })
    expect(rbacUserService.items.value.length).toBe(2)

    await rbacUserService.setPage(3)
    expect(rbacUserService.pagination.value.page).toBe(3)
    expect(rbacUserService.items.value.length).toBe(1)

    await rbacUserService.setPageSize(10)
    expect(rbacUserService.pagination.value.page).toBe(1)
    expect(rbacUserService.pagination.value.page_size).toBe(10)
  })

  it('创建用户并更新本地列表', async () => {
    await rbacUserService.load({ page: 1, page_size: 10 })
    const before = rbacUserService.pagination.value.total

    const user = await rbacUserService.createUser({
      username: 'serviceuser',
      email: 'service@chenguang.com',
      password: '123456',
    })

    expect(user?.username).toBe('serviceuser')
    expect(rbacUserService.pagination.value.total).toBe(before + 1)
    expect(rbacUserService.items.value[0].username).toBe('serviceuser')
  })

  it('创建重复用户返回 null', async () => {
    const user = await rbacUserService.createUser({
      username: 'admin',
      email: 'dup@chenguang.com',
      password: '123456',
    })
    expect(user).toBeNull()
    expect(rbacUserService.error.value).not.toBeNull()
  })

  it('获取用户详情与角色', async () => {
    const detail = await rbacUserService.fetchDetail(2)
    expect(detail?.username).toBe('zhangsan')
    expect(detail?.roles.length).toBe(1)

    const roles = await rbacUserService.fetchUserRoles(2)
    expect(roles[0].code).toBe('admin')
  })

  it('分配角色并同步详情', async () => {
    const updated = await rbacUserService.assignRoles(3, [2, 4])
    expect(updated?.roles.map((r) => r.code).sort()).toEqual(['admin', 'auditor'])
    expect(rbacUserService.detail.value?.id).toBe(3)
  })

  it('listAll 返回完整列表', async () => {
    const users = await rbacUserService.listAll()
    expect(users.length).toBe(5)
    expect(users[0]).toHaveProperty('roles')
  })

  it('reset 清空状态', async () => {
    await rbacUserService.load()
    rbacUserService.reset()
    expect(rbacUserService.items.value).toEqual([])
    expect(rbacUserService.detail.value).toBeNull()
  })
})

/* ============================================================
 * 角色服务
 * ============================================================ */

describe('Service层 - RbacRoleService', () => {
  beforeEach(() => {
    rbacRoleService.reset()
  })

  it('加载角色列表与分页', async () => {
    await rbacRoleService.load({ page: 1, page_size: 2 })
    expect(rbacRoleService.items.value.length).toBe(2)
    expect(rbacRoleService.pagination.value.total).toBe(4)

    await rbacRoleService.setPage(2)
    expect(rbacRoleService.items.value.length).toBe(2)
  })

  it('搜索角色', async () => {
    await rbacRoleService.search('super')
    expect(rbacRoleService.items.value.length).toBe(1)
    expect(rbacRoleService.items.value[0].code).toBe('super_admin')
  })

  it('listAll 返回全部角色', async () => {
    const roles = await rbacRoleService.listAll()
    expect(roles.length).toBe(4)
  })

  it('创建角色', async () => {
    const role = await rbacRoleService.createRole({ code: 'ops', name: '运维' })
    expect(role?.code).toBe('ops')

    const list = await rbacRoleService.listAll()
    expect(list.some((r) => r.code === 'ops')).toBe(true)
  })

  it('创建重复角色返回 null', async () => {
    const role = await rbacRoleService.createRole({ code: 'admin', name: '重复' })
    expect(role).toBeNull()
  })

  it('更新角色', async () => {
    const role = await rbacRoleService.updateRole(2, { name: '平台管理员' })
    expect(role?.name).toBe('平台管理员')
  })

  it('删除角色', async () => {
    const ok = await rbacRoleService.deleteRole(4)
    expect(ok).toBe(true)

    const list = await rbacRoleService.listAll()
    expect(list.some((r) => r.id === 4)).toBe(false)
  })

  it('分配角色权限', async () => {
    const role = await rbacRoleService.assignPermissions(3, [1, 2])
    expect(role?.permissions.map((p) => p.id).sort()).toEqual([1, 2])
  })

  it('角色详情', async () => {
    const role = await rbacRoleService.fetchDetail(1)
    expect(role?.code).toBe('super_admin')
    expect(role?.permissions.length).toBe(15)
  })

  it('权限按模块分组', () => {
    const permissions = [
      { id: 1, code: 'system:user:view', name: 'a', description: null },
      { id: 2, code: 'system:role:view', name: 'b', description: null },
      { id: 3, code: 'monitor:online:view', name: 'c', description: null },
    ]
    const groups = RbacRoleService.groupPermissionsByModule(permissions)
    expect(Object.keys(groups).sort()).toEqual(['monitor', 'system'])
    expect(groups.system.length).toBe(2)
  })
})

/* ============================================================
 * 权限服务
 * ============================================================ */

describe('Service层 - RbacPermissionService', () => {
  beforeEach(() => {
    rbacPermissionService.reset()
  })

  it('加载权限列表与分页', async () => {
    await rbacPermissionService.load({ page: 1, page_size: 5 })
    expect(rbacPermissionService.items.value.length).toBe(5)
    expect(rbacPermissionService.pagination.value.total).toBe(15)
  })

  it('搜索权限', async () => {
    await rbacPermissionService.search('monitor')
    expect(rbacPermissionService.items.value.length).toBe(2)
  })

  it('listAll 返回全部权限', async () => {
    const permissions = await rbacPermissionService.listAll()
    expect(permissions.length).toBe(15)
  })

  it('创建权限', async () => {
    const permission = await rbacPermissionService.createPermission({
      code: 'system:dict:view',
      name: '查看字典',
    })
    expect(permission?.code).toBe('system:dict:view')
  })

  it('创建重复权限返回 null', async () => {
    const permission = await rbacPermissionService.createPermission({
      code: 'dashboard:view',
      name: '重复',
    })
    expect(permission).toBeNull()
  })

  it('更新权限', async () => {
    const permission = await rbacPermissionService.updatePermission(1, { name: '首页访问' })
    expect(permission?.name).toBe('首页访问')
  })

  it('删除权限', async () => {
    const ok = await rbacPermissionService.deletePermission(15)
    expect(ok).toBe(true)

    const list = await rbacPermissionService.listAll()
    expect(list.some((p) => p.id === 15)).toBe(false)
  })

  it('权限详情', async () => {
    const permission = await rbacPermissionService.fetchDetail(1)
    expect(permission?.code).toBe('dashboard:view')
  })

  it('模块分组与统计', async () => {
    await rbacPermissionService.load({ page: 1, page_size: 100 })
    const modules = Object.keys(rbacPermissionService.moduleGroups.value)
    expect(modules).toContain('system')
    expect(modules).toContain('monitor')
    expect(rbacPermissionService.moduleStats.value.length).toBeGreaterThan(0)
  })

  it('计算属性 hasData / isEmpty', async () => {
    await rbacPermissionService.load()
    expect(rbacPermissionService.hasData.value).toBe(true)
    expect(rbacPermissionService.isEmpty.value).toBe(false)
  })
})

/* ============================================================
 * 跨服务一致性
 * ============================================================ */

describe('Service层 - 跨资源一致性', () => {
  it('删除角色后用户服务可见最新状态', async () => {
    await rbacRoleService.deleteRole(2)
    const user = await rbacUserService.fetchDetail(2)
    expect(user?.roles).toEqual([])
  })

  it('登录后可通过 API 获取当前用户', async () => {
    const login = await apiLogin()
    localStorage.setItem('access_token', login.access_token)

    const me = await rbacUserService.fetchDetail(login.user.id)
    expect(me?.username).toBe('admin')
  })
})
