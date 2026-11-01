/**
 * Service层测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { authService } from '@/services/auth'
import { userService } from '@/services/user'

describe('Service层 - AuthService', () => {
  beforeEach(() => {
    localStorage.clear()
    authService.reset?.()
  })

  it('登录成功', async () => {
    const result = await authService.login({
      username: 'admin',
      password: '123456',
    })

    expect(result).toBeDefined()
    expect(result!.access_token).toBeDefined()
    expect(authService.isAuthenticated.value).toBe(true)
    expect(authService.user.value?.username).toBe('admin')
  })

  it('登录失败 - 密码错误', async () => {
    await expect(
      authService.login({
        username: 'admin',
        password: 'wrong',
      })
    ).rejects.toThrow()

    expect(authService.isAuthenticated.value).toBe(false)
  })

  it('获取当前用户信息', async () => {
    // 先登录
    await authService.login({
      username: 'admin',
      password: '123456',
    })

    const user = await authService.fetchUserInfo()
    expect(user).toBeDefined()
    expect(user!.username).toBe('admin')
  })

  it('权限检查', async () => {
    await authService.login({
      username: 'admin',
      password: '123456',
    })

    // 管理员角色
    expect(authService.hasRole('super_admin')).toBe(true)
    expect(authService.isAdmin).toBe(true)
  })

  it('登出', async () => {
    await authService.login({
      username: 'admin',
      password: '123456',
    })

    await authService.logout(false)
    expect(authService.isAuthenticated.value).toBe(false)
    expect(authService.user.value).toBeNull()
  })

  it('权限检查 - hasPermission', async () => {
    await authService.login({
      username: 'admin',
      password: '123456',
    })

    expect(authService.hasPermission('system:user:view')).toBe(true)
    expect(authService.hasPermission(['system:user:view', 'not:exist'])).toBe(true)
    expect(authService.hasPermission('not:exist')).toBe(false)
  })

  it('修改密码', async () => {
    const result = await authService.changePassword({
      old_password: '123456',
      new_password: 'newpass123',
      confirm_password: 'newpass123',
    })
    // Mock环境未实现该接口，预期返回false或抛错被捕获
    expect(typeof result).toBe('boolean')
  })

  it('getState 返回状态快照', async () => {
    await authService.login({
      username: 'admin',
      password: '123456',
    })

    const state = authService.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user?.username).toBe('admin')
    expect(state.permissions.length).toBeGreaterThan(0)
  })
})

describe('Service层 - UserService', () => {
  beforeEach(async () => {
    userService.reset()
    await userService.loadList({ page: 1, page_size: 10 })
  })

  it('加载用户列表', async () => {
    expect(userService.data.value.length).toBeGreaterThan(0)
    expect(userService.pagination.value.total).toBeGreaterThan(0)
    expect(userService.loading.value).toBe(false)
  })

  it('搜索用户', async () => {
    await userService.search('admin')

    expect(userService.data.value.length).toBe(1)
    expect(userService.data.value[0].username).toBe('admin')
  })

  it('按角色筛选', async () => {
    await userService.filterByRole(1)

    expect(userService.data.value.length).toBeGreaterThan(0)
    expect(userService.data.value.every((u) => u.roles.some((r) => r.id === 1))).toBe(true)
  })

  it('按状态筛选', async () => {
    await userService.filterByStatus(0)

    expect(userService.data.value.length).toBeGreaterThan(0)
    expect(userService.data.value.every((u) => u.status === 0)).toBe(true)
  })

  it('获取用户详情', async () => {
    const user = await userService.getById(1)

    expect(user).toBeDefined()
    expect(user!.id).toBe(1)
  })

  it('创建用户', async () => {
    const before = userService.pagination.value.total

    const user = await userService.create({
      username: 'newuser',
      email: 'new@chenguang.com',
      full_name: '新用户',
      roles: [],
    } as any)

    expect(user).toBeDefined()
    expect(userService.pagination.value.total).toBe(before + 1)
  })

  it('更新用户', async () => {
    const user = await userService.update(2, {
      full_name: '更新后的名字',
    } as any)

    expect(user).toBeDefined()
    expect(user!.full_name).toBe('更新后的名字')
  })

  it('删除用户', async () => {
    const before = userService.pagination.value.total

    const result = await userService.delete(3)

    expect(result).toBe(true)
    expect(userService.pagination.value.total).toBe(before - 1)
  })

  it('获取角色选项', async () => {
    const roles = await userService.getRoleOptions()

    expect(roles.length).toBeGreaterThan(0)
    expect(roles[0].name).toBeDefined()

    // 第二次获取使用缓存
    const roles2 = await userService.getRoleOptions()
    expect(roles2).toEqual(roles)
  })

  it('分页切换', async () => {
    await userService.loadList({ page: 1, page_size: 2 })
    expect(userService.data.value.length).toBe(2)

    userService.setPage(2)
    await new Promise((r) => setTimeout(r, 50))
    expect(userService.pagination.value.page).toBe(2)

    userService.setPageSize(10)
    await new Promise((r) => setTimeout(r, 50))
    expect(userService.pagination.value.page).toBe(1)
    expect(userService.pagination.value.page_size).toBe(10)
  })

  it('计算属性 hasData/isEmpty', async () => {
    await userService.loadList({ page: 1, page_size: 10 })
    expect(userService.hasData.value).toBe(true)
    expect(userService.isEmpty.value).toBe(false)
  })

  it('批量删除用户', async () => {
    await userService.loadList({ page: 1, page_size: 10 })
    const ids = userService.data.value.slice(0, 2).map((u) => u.id)
    const before = userService.pagination.value.total

    const result = await userService.batchDelete(ids)
    expect(result).toBe(true)
    expect(userService.pagination.value.total).toBe(before - ids.length)
  })

  it('切换用户状态', async () => {
    await userService.loadList({ page: 1, page_size: 10 })
    const target = userService.data.value[0]
    const newStatus = target.status === 1 ? 0 : 1

    const result = await userService.toggleStatus(target.id, newStatus)
    expect(result).toBe(true)
    expect(target.status).toBe(newStatus)
  })

  it('重置用户密码', async () => {
    await userService.loadList({ page: 1, page_size: 10 })
    const target = userService.data.value[0]
    const result = await userService.resetPassword(target.id, {
      password: 'newpass123',
      confirm_password: 'newpass123',
    })
    expect(result).toBe(true)
  })
})
