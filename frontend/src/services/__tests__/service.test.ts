/**
 * Service层测试 - 认证与 RBAC V2 业务逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { authService } from '@/services/auth'
import { rbacUserService, rbacRoleService, rbacPermissionService, RbacRoleService } from '@/services/rbac'
import { loginViaService, loginParams } from '@/test/helpers'

beforeEach(async () => {
  localStorage.clear()
  authService.reset()
  await loginViaService('admin')
  rbacUserService.reset()
  rbacRoleService.reset()
  rbacPermissionService.reset()
})

/* ============================================================
 * AuthService
 * ============================================================ */

describe('Service层 - AuthService', () => {
  it('登录成功：仅持久化 Token，不持久化权限/用户', async () => {
    authService.reset()
    const result = await authService.login(await loginParams())

    expect(result).not.toBeNull()
    expect(authService.isAuthenticated.value).toBe(true)
    expect(authService.user.value?.username).toBe('admin')
    expect(authService.user.value?.is_superuser).toBe(true)
    expect(authService.roles.value).toContain('admin')
    expect(authService.isSuperuser).toBe(true)

    // PRD D12：权限不写入 localStorage
    expect(localStorage.getItem('access_token')).toBeTruthy()
    expect(localStorage.getItem('user_info')).toBeNull()
  })

  it('登录失败 - 密码错误', async () => {
    authService.reset()
    await expect(authService.login(await loginParams('admin', 'bad-pass'))).rejects.toThrow()
    expect(authService.isAuthenticated.value).toBe(false)
  })

  it('获取当前用户信息', async () => {
    const user = await authService.fetchUserInfo()
    expect(user?.username).toBe('admin')
    expect(user?.roles.map((r) => r.code)).toEqual(['admin'])
  })

  it('角色判断', () => {
    expect(authService.hasRole('admin')).toBe(true)
    expect(authService.hasRole(['operator', 'admin'])).toBe(true)
    expect(authService.hasRole('viewer')).toBe(false)
    expect(authService.isSuperuser).toBe(true)
  })

  it('登出清空登录态', async () => {
    await authService.logout(false)
    expect(authService.isAuthenticated.value).toBe(false)
    expect(authService.user.value).toBeNull()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('getState 返回状态快照', () => {
    const state = authService.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.roles).toEqual(['admin'])
  })
})

/* ============================================================
 * 用户服务
 * ============================================================ */

describe('Service层 - RbacUserService', () => {
  it('加载用户列表', async () => {
    const result = await rbacUserService.load({ page: 1, page_size: 10 })
    expect(result?.total).toBe(5)
    expect(rbacUserService.items.value.length).toBe(5)
    expect(rbacUserService.loading.value).toBe(false)
  })

  it('关键词搜索', async () => {
    await rbacUserService.search('viewer')
    expect(rbacUserService.items.value.length).toBe(2)
  })

  it('分页切换', async () => {
    await rbacUserService.load({ page: 1, page_size: 2 })
    expect(rbacUserService.items.value.length).toBe(2)

    await rbacUserService.setPage(3)
    expect(rbacUserService.pagination.value.page).toBe(3)
    expect(rbacUserService.items.value.length).toBe(1)

    await rbacUserService.setPageSize(10)
    expect(rbacUserService.pagination.value.page).toBe(1)
  })

  it('创建用户', async () => {
    const user = await rbacUserService.createUser({
      username: 'serviceuser',
      email: 'service@chenguang.com',
      password: '123456',
    })
    expect(user?.username).toBe('serviceuser')
    expect(user?.roles).toEqual([])
  })

  it('创建重复用户返回 null 并记录错误', async () => {
    const user = await rbacUserService.createUser({
      username: 'admin',
      email: 'dup@chenguang.com',
      password: '123456',
    })
    expect(user).toBeNull()
    expect(rbacUserService.error.value).not.toBeNull()
  })

  it('更新用户邮箱与状态', async () => {
    const updated = await rbacUserService.updateUser(2, { email: 'op2@chenguang.com' })
    expect(updated?.email).toBe('op2@chenguang.com')

    const toggled = await rbacUserService.toggleActive(4, true)
    expect(toggled?.is_active).toBe(true)
  })

  it('禁用自己被拒绝', async () => {
    const result = await rbacUserService.toggleActive(1, false)
    expect(result).toBeNull()
    expect(rbacUserService.error.value).not.toBeNull()
  })

  it('删除用户', async () => {
    const ok = await rbacUserService.deleteUser(5)
    expect(ok).toBe(true)
    expect(rbacUserService.items.value.some((u) => u.id === 5)).toBe(false)
  })

  it('删除自己被拒绝', async () => {
    const ok = await rbacUserService.deleteUser(1)
    expect(ok).toBe(false)
  })

  it('获取详情与角色', async () => {
    const detail = await rbacUserService.fetchDetail(2)
    expect(detail?.username).toBe('operator01')

    const roles = await rbacUserService.fetchUserRoles(2)
    expect(roles[0].code).toBe('operator')
  })

  it('分配角色', async () => {
    const updated = await rbacUserService.assignRoles(5, [2, 3])
    expect(updated?.roles.map((r) => r.code).sort()).toEqual(['operator', 'viewer'])
  })

  it('listAll 返回全部用户', async () => {
    const users = await rbacUserService.listAll()
    expect(users.length).toBe(5)
    expect(users[0]).toHaveProperty('is_superuser')
  })
})

/* ============================================================
 * 角色服务
 * ============================================================ */

describe('Service层 - RbacRoleService', () => {
  it('加载角色列表与分页', async () => {
    await rbacRoleService.load({ page: 1, page_size: 2 })
    expect(rbacRoleService.items.value.length).toBe(2)
    expect(rbacRoleService.pagination.value.total).toBe(4)

    await rbacRoleService.setPage(2)
    expect(rbacRoleService.items.value.length).toBe(2)
  })

  it('搜索角色', async () => {
    await rbacRoleService.search('operator')
    expect(rbacRoleService.items.value.length).toBe(1)
    expect(rbacRoleService.items.value[0].code).toBe('operator')
  })

  it('listAll 返回全部角色', async () => {
    const roles = await rbacRoleService.listAll()
    expect(roles.length).toBe(4)
  })

  it('创建与更新角色', async () => {
    const role = await rbacRoleService.createRole({ code: 'ops', name: '运维' })
    expect(role?.is_system).toBe(false)

    const updated = await rbacRoleService.updateRole(role!.id, { name: '运维团队' })
    expect(updated?.name).toBe('运维团队')
  })

  it('创建重复角色返回 null', async () => {
    const role = await rbacRoleService.createRole({ code: 'admin', name: '重复' })
    expect(role).toBeNull()
  })

  it('删除未使用的自定义角色', async () => {
    const role = await rbacRoleService.createRole({ code: 'temp', name: '临时' })
    const ok = await rbacRoleService.deleteRole(role!.id)
    expect(ok).toBe(true)
  })

  it('内置角色不可删除', async () => {
    const ok = await rbacRoleService.deleteRole(1)
    expect(ok).toBe(false)
    expect(rbacRoleService.error.value).not.toBeNull()
  })

  it('使用中的角色不可删除', async () => {
    const ok = await rbacRoleService.deleteRole(4)
    expect(ok).toBe(false)
  })

  it('分配角色权限（自定义角色）', async () => {
    const perms = await rbacPermissionService.listAll()
    const ids = perms.filter((p) => ['conversation:read', 'analytics:read'].includes(p.code)).map((p) => p.id)
    const role = await rbacRoleService.assignPermissions(4, ids)
    expect(role?.permissions.length).toBe(2)
  })

  it('admin 角色权限不可修改', async () => {
    const role = await rbacRoleService.assignPermissions(1, [1])
    expect(role).toBeNull()
  })

  it('角色详情', async () => {
    const role = await rbacRoleService.fetchDetail(1)
    expect(role?.permissions.length).toBe(63)
  })

  it('权限按模块分组', () => {
    const permissions = [
      { id: 1, code: 'system.user:read', name: 'a', description: null, module: 'system.user', action: 'read', is_system: true, sort_order: 1 },
      { id: 2, code: 'system.role:read', name: 'b', description: null, module: 'system.role', action: 'read', is_system: true, sort_order: 2 },
      { id: 3, code: 'system.user:create', name: 'c', description: null, module: 'system.user', action: 'create', is_system: true, sort_order: 3 },
    ]
    const groups = RbacRoleService.groupPermissionsByModule(permissions)
    expect(Object.keys(groups).sort()).toEqual(['system.role', 'system.user'])
    expect(groups['system.user'].length).toBe(2)
  })
})

/* ============================================================
 * 权限服务
 * ============================================================ */

describe('Service层 - RbacPermissionService', () => {
  it('加载权限列表与分页', async () => {
    await rbacPermissionService.load({ page: 1, page_size: 5 })
    expect(rbacPermissionService.items.value.length).toBe(5)
    expect(rbacPermissionService.pagination.value.total).toBe(63)
  })

  it('模块筛选', async () => {
    await rbacPermissionService.load({ page: 1, page_size: 50, module: 'system.role' })
    expect(rbacPermissionService.items.value.every((p) => p.module === 'system.role')).toBe(true)
    expect(rbacPermissionService.items.value.length).toBe(5)
  })

  it('关键词搜索', async () => {
    await rbacPermissionService.search('告警')
    expect(rbacPermissionService.items.value.length).toBe(4)
    expect(rbacPermissionService.items.value.every((p) => p.module === 'system.alert')).toBe(true)
  })

  it('权限树 16 个模块', async () => {
    const tree = await rbacPermissionService.fetchTree()
    expect(tree.length).toBe(16)
    expect(tree.reduce((sum, g) => sum + g.permissions.length, 0)).toBe(63)
  })

  it('创建与更新自定义权限', async () => {
    const permission = await rbacPermissionService.createPermission({
      code: 'custom.export:create',
      name: '创建导出',
    })
    expect(permission?.module).toBe('custom.export')

    const updated = await rbacPermissionService.updatePermission(permission!.id, { name: '创建自定义导出' })
    expect(updated?.name).toBe('创建自定义导出')
  })

  it('创建重复权限返回 null', async () => {
    const permission = await rbacPermissionService.createPermission({ code: 'agent:read', name: '重复' })
    expect(permission).toBeNull()
  })

  it('删除自定义权限', async () => {
    const permission = await rbacPermissionService.createPermission({ code: 'custom.tmp:read', name: '临时' })
    const ok = await rbacPermissionService.deletePermission(permission!.id)
    expect(ok).toBe(true)
  })

  it('内置权限不可删除', async () => {
    const ok = await rbacPermissionService.deletePermission(1)
    expect(ok).toBe(false)
  })

  it('模块分组与统计', async () => {
    await rbacPermissionService.load({ page: 1, page_size: 100 })
    expect(Object.keys(rbacPermissionService.moduleGroups.value)).toContain('system.user')
    expect(rbacPermissionService.moduleStats.value.length).toBe(16)
  })
})

/* ============================================================
 * 跨资源一致性
 * ============================================================ */

describe('Service层 - 跨资源一致性', () => {
  it('使用中的自定义角色不可删除，解除关联后可删除', async () => {
    const role = await rbacRoleService.createRole({ code: 'temp2', name: '临时2' })
    await rbacUserService.assignRoles(3, [role!.id])

    // 角色仍被使用：删除被拒绝（40306）
    const blocked = await rbacRoleService.deleteRole(role!.id)
    expect(blocked).toBe(false)

    // 解除关联后可删除
    await rbacUserService.assignRoles(3, [])
    const ok = await rbacRoleService.deleteRole(role!.id)
    expect(ok).toBe(true)

    const detail = await rbacUserService.fetchDetail(3)
    expect(detail?.roles).toEqual([])
  })

  it('权限更名后角色详情同步', async () => {
    await rbacPermissionService.updatePermission(1, { name: '首页访问' })
    const role = await rbacRoleService.fetchDetail(1)
    expect(role?.permissions.find((p) => p.id === 1)?.name).toBe('首页访问')
  })
})
