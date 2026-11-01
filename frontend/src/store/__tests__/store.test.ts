/**
 * Store层测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/store/modules/auth'
import { useAppStore } from '@/store/modules/app'
import { useSettingsStore } from '@/store/modules/settings'
import { usePermissionStore } from '@/store/modules/permission'
import { useRbacStore } from '@/store/modules/rbac'
import { authService } from '@/services/auth'
import { loginParams } from '@/test/helpers'

describe('Store层 - AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    authService.reset()
  })

  it('初始状态', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('登录成功并自动加载权限', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.username).toBe('admin')
    expect(store.isSuperuser).toBe(true)
    expect(store.roles).toContain('admin')

    const permissionStore = usePermissionStore()
    expect(permissionStore.loaded).toBe(true)
    expect(permissionStore.permissions.size).toBe(63)
    expect(permissionStore.isSuperuser).toBe(true)
  })

  it('登录失败', async () => {
    const store = useAuthStore()
    await expect(store.login(await loginParams('admin', 'wrong'))).rejects.toThrow()
    expect(store.isAuthenticated).toBe(false)
  })

  it('登出清空认证与权限', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())
    await store.logout(false)

    expect(store.isAuthenticated).toBe(false)
    expect(usePermissionStore().permissions.size).toBe(0)
    expect(usePermissionStore().loaded).toBe(false)
  })

  it('计算属性与角色判断', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())

    expect(store.userName).toBe('admin')
    expect(store.userEmail).toBe('admin@chenguang.com')
    expect(store.userRoleNames).toEqual(['超级管理员'])
    expect(store.hasRole('admin')).toBe(true)
    expect(store.hasPermission('system.user:read')).toBe(true)
  })
})

describe('Store层 - PermissionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    authService.reset()
  })

  it('刷新权限上下文', async () => {
    const authStore = useAuthStore()
    await authStore.login(await loginParams())
    const store = usePermissionStore()

    expect(store.loaded).toBe(true)
    expect(store.permissions.size).toBe(63)
    expect(store.roles[0].code).toBe('admin')
    expect(store.permissionVersion).toBeGreaterThan(0)
    expect(store.cachedAt).toBeTruthy()
  })

  it('has / hasAny / hasAll（超管直通）', async () => {
    const authStore = useAuthStore()
    await authStore.login(await loginParams())
    const store = usePermissionStore()

    expect(store.has('agent:read')).toBe(true)
    expect(store.hasAny(['nope', 'agent:read'])).toBe(true)
    expect(store.hasAll(['agent:read', 'model:read'])).toBe(true)
    expect(store.hasAny([])).toBe(true)
    // 超管直通：未登记的权限码也放行（PRD Review Focus 2）
    expect(store.hasAny(['nope'])).toBe(true)
    expect(store.hasAll(['agent:read', 'nope'])).toBe(true)
  })

  it('非超管严格按权限码判断', async () => {
    const authStore = useAuthStore()
    await authStore.login(await loginParams('operator01'))
    const store = usePermissionStore()

    expect(store.has('agent:create')).toBe(true)
    expect(store.has('agent:delete')).toBe(false)
    expect(store.hasAny(['nope'])).toBe(false)
    expect(store.hasAll(['agent:read', 'nope'])).toBe(false)
  })

  it('权限加载失败时清空且不放行', async () => {
    const store = usePermissionStore()
    localStorage.removeItem('access_token')

    const ok = await store.refreshPermissions()
    expect(ok).toBe(false)
    expect(store.loaded).toBe(false)
    expect(store.permissions.size).toBe(0)
    expect(store.error).not.toBeNull()
  })

  it('非超管按角色聚合权限', async () => {
    const authStore = useAuthStore()
    await authStore.login(await loginParams('operator01'))
    const store = usePermissionStore()

    expect(store.isSuperuser).toBe(false)
    expect(store.permissions.size).toBe(27)
    expect(store.has('agent:create')).toBe(true)
    expect(store.has('agent:delete')).toBe(false)
  })

  it('clearPermissions 重置', async () => {
    const authStore = useAuthStore()
    await authStore.login(await loginParams())
    const store = usePermissionStore()
    store.clearPermissions()

    expect(store.permissions.size).toBe(0)
    expect(store.isSuperuser).toBe(false)
    expect(store.loaded).toBe(false)
  })
})

describe('Store层 - AppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态', () => {
    const store = useAppStore()
    expect(store.sidebar.opened).toBe(true)
    expect(store.device).toBe('desktop')
    expect(store.theme).toBe('light')
  })

  it('切换侧边栏', () => {
    const store = useAppStore()
    store.toggleSidebar()
    expect(store.sidebar.opened).toBe(false)
    store.toggleSidebar()
    expect(store.sidebar.opened).toBe(true)
  })

  it('切换主题', () => {
    const store = useAppStore()
    store.setTheme('dark')
    expect(store.theme).toBe('dark')
    store.setTheme('light')
    expect(store.theme).toBe('light')
  })

  it('切换设备类型', () => {
    const store = useAppStore()
    store.toggleDevice('mobile')
    expect(store.device).toBe('mobile')
    expect(store.isMobile).toBe(true)
    expect(store.sidebar.opened).toBe(false)
  })

  it('标签页管理', () => {
    const store = useAppStore()
    store.addVisitedView({ title: '首页', path: '/dashboard', closable: false })
    store.addVisitedView({ title: '用户管理', path: '/system/user', closable: true })
    expect(store.tagsView.visitedViews.length).toBe(2)

    store.removeVisitedView('/system/user')
    expect(store.tagsView.visitedViews.length).toBe(1)
  })

  it('重复添加标签页不会重复', () => {
    const store = useAppStore()
    store.addVisitedView({ title: '首页', path: '/dashboard', closable: false })
    store.addVisitedView({ title: '首页', path: '/dashboard', closable: false })
    expect(store.tagsView.visitedViews.length).toBe(1)
  })

  it('关闭其他/全部标签页', () => {
    const store = useAppStore()
    store.addVisitedView({ title: '首页', path: '/dashboard', closable: false })
    store.addVisitedView({ title: '用户', path: '/system/user', closable: true })
    store.addVisitedView({ title: '角色', path: '/system/role', closable: true })

    store.closeOtherViews('/system/user')
    expect(store.tagsView.visitedViews.length).toBe(2)

    store.closeAllViews()
    expect(store.tagsView.visitedViews.length).toBe(1)
  })

  it('缓存视图管理', () => {
    const store = useAppStore()
    store.addCachedView('UserManagement')
    store.addCachedView('UserManagement')
    expect(store.tagsView.cachedViews.length).toBe(1)
    store.removeCachedView('UserManagement')
    expect(store.tagsView.cachedViews.length).toBe(0)
  })

  it('侧边栏开合控制', () => {
    const store = useAppStore()
    store.closeSidebar()
    expect(store.sidebar.opened).toBe(false)
    store.openSidebar()
    expect(store.sidebar.opened).toBe(true)
  })

  it('布局与语言设置', () => {
    const store = useAppStore()
    store.setLanguage('en-US')
    expect(store.language).toBe('en-US')
    store.setLayout('top')
    expect(store.layout).toBe('top')
  })

  it('页面加载状态与面包屑', () => {
    const store = useAppStore()
    store.startPageLoading()
    expect(store.pageLoading).toBe(true)
    store.finishPageLoading()
    expect(store.pageLoading).toBe(false)

    store.setBreadcrumbs([{ title: '系统管理', path: '/system' }])
    expect(store.breadcrumbs.length).toBe(1)
  })
})

describe('Store层 - SettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('初始设置', () => {
    const store = useSettingsStore()
    expect(store.settings.notifications.email).toBe(true)
    expect(store.settings.ui.compactMode).toBe(false)
    expect(store.settings.editor.fontSize).toBe(14)
  })

  it('更新、重置与导入导出', () => {
    const store = useSettingsStore()
    store.updateNotifications({ email: false })
    expect(store.settings.notifications.email).toBe(false)

    store.updateUI({ compactMode: true })
    store.updateEditor({ fontSize: 18 })
    store.updateData({ defaultPageSize: 50 })
    expect(store.settings.editor.fontSize).toBe(18)
    expect(store.settings.data.defaultPageSize).toBe(50)

    const exported = store.exportSettings()
    expect(exported.ui.compactMode).toBe(true)

    store.reset()
    expect(store.settings.ui.compactMode).toBe(false)
  })
})

describe('Store层 - RbacStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    authService.reset()
    const authStore = useAuthStore()
    await authStore.login(await loginParams())
  })

  it('加载角色选项并缓存', async () => {
    const store = useRbacStore()
    const roles = await store.loadRoleOptions()
    expect(roles.length).toBe(4)
    expect(store.roleOptions.length).toBe(4)

    const cached = await store.loadRoleOptions()
    expect(cached).toBe(roles)
  })

  it('加载权限选项与权限树', async () => {
    const store = useRbacStore()
    const permissions = await store.loadPermissionOptions()
    expect(permissions.length).toBe(63)

    const tree = await store.loadPermissionTree()
    expect(tree.length).toBe(16)
    expect(store.permissionTree.length).toBe(16)
  })

  it('roleMap / permissionMap 索引', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    await store.loadPermissionOptions()

    expect(store.roleMap.get(1)?.code).toBe('admin')
    expect(store.permissionMap.get(1)?.code).toBe('dashboard:read')
  })

  it('加载概览统计', async () => {
    const store = useRbacStore()
    const stats = await store.loadStats()

    expect(stats.users).toBe(5)
    expect(stats.roles).toBe(4)
    expect(stats.permissions).toBe(63)
    expect(stats.activeUsers).toBe(4)
  })

  it('invalidate 清空指定缓存', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    await store.loadPermissionOptions()
    await store.loadPermissionTree()

    store.invalidate('roles')
    expect(store.roleOptions.length).toBe(0)
    expect(store.permissionOptions.length).toBe(63)

    store.invalidate('all')
    expect(store.permissionOptions.length).toBe(0)
    expect(store.permissionTree.length).toBe(0)
  })

  it('reset 重置全部状态', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    await store.loadStats()
    store.reset()

    expect(store.roleOptions).toEqual([])
    expect(store.stats.users).toBe(0)
  })
})
