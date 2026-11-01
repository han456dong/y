/**
 * Store层测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/store/modules/auth'
import { useAppStore } from '@/store/modules/app'
import { useSettingsStore } from '@/store/modules/settings'
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
    expect(store.permissions).toEqual([])
  })

  it('登录成功', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.username).toBe('admin')
    expect(store.roles).toContain('super_admin')
  })

  it('登录失败', async () => {
    const store = useAuthStore()
    await expect(store.login(await loginParams('admin', 'wrong'))).rejects.toThrow()
    expect(store.isAuthenticated).toBe(false)
  })

  it('登出', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())
    expect(store.isAuthenticated).toBe(true)

    await store.logout(false)
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('计算属性 - 用户信息与权限', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())

    expect(store.userName).toBe('admin')
    expect(store.userEmail).toBe('admin@chenguang.com')
    expect(store.hasPermission('system:role:view')).toBe(true)
    expect(store.hasRole('super_admin')).toBe(true)
    expect(store.isAdmin).toBe(true)
  })

  it('reset 清空状态', async () => {
    const store = useAuthStore()
    await store.login(await loginParams())
    store.reset()
    expect(store.isAuthenticated).toBe(false)
    expect(store.permissions).toEqual([])
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
    store.setLayout('mix')
    expect(store.layout).toBe('mix')
  })

  it('页面加载状态', () => {
    const store = useAppStore()
    store.startPageLoading()
    expect(store.pageLoading).toBe(true)
    store.finishPageLoading()
    expect(store.pageLoading).toBe(false)
  })

  it('面包屑设置', () => {
    const store = useAppStore()
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

  it('更新通知设置', () => {
    const store = useSettingsStore()
    store.updateNotifications({ email: false })
    expect(store.settings.notifications.email).toBe(false)
  })

  it('更新UI设置', () => {
    const store = useSettingsStore()
    store.updateUI({ compactMode: true })
    expect(store.settings.ui.compactMode).toBe(true)
  })

  it('重置设置', () => {
    const store = useSettingsStore()
    store.updateUI({ compactMode: true })
    store.reset()
    expect(store.settings.ui.compactMode).toBe(false)
  })

  it('导入导出设置', () => {
    const store = useSettingsStore()
    store.importSettings({
      ui: {
        compactMode: true,
        showBreadcrumb: false,
        showTagsView: true,
        showLogo: true,
        showFooter: true,
        fixedHeader: true,
        fixedSidebar: true,
      },
    })
    expect(store.settings.ui.compactMode).toBe(true)

    const exported = store.exportSettings()
    expect(exported.ui.compactMode).toBe(true)
  })

  it('更新编辑器与数据设置', () => {
    const store = useSettingsStore()
    store.updateEditor({ fontSize: 18, tabSize: 4 })
    expect(store.settings.editor.fontSize).toBe(18)
    expect(store.settings.editor.tabSize).toBe(4)

    store.updateData({ defaultPageSize: 50 })
    expect(store.settings.data.defaultPageSize).toBe(50)
  })

  it('存储到本地并重新加载', () => {
    const store = useSettingsStore()
    store.updateUI({ compactMode: true })
    store.loadFromStorage()
    expect(store.settings.ui.compactMode).toBe(true)
  })
})

describe('Store层 - RbacStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('加载角色选项并缓存', async () => {
    const store = useRbacStore()
    const roles = await store.loadRoleOptions()
    expect(roles.length).toBe(4)
    expect(store.roleOptions.length).toBe(4)

    const cached = await store.loadRoleOptions()
    expect(cached).toBe(roles)
  })

  it('强制刷新角色选项', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    const refreshed = await store.loadRoleOptions(true)
    expect(refreshed.length).toBe(4)
  })

  it('加载权限选项并缓存', async () => {
    const store = useRbacStore()
    const permissions = await store.loadPermissionOptions()
    expect(permissions.length).toBe(15)
    expect(store.permissionOptions.length).toBe(15)
  })

  it('roleMap / permissionMap 索引', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    await store.loadPermissionOptions()

    expect(store.roleMap.get(1)?.code).toBe('super_admin')
    expect(store.permissionMap.get(1)?.code).toBe('dashboard:view')
  })

  it('加载概览统计', async () => {
    const store = useRbacStore()
    const stats = await store.loadStats()

    expect(stats.users).toBe(5)
    expect(stats.roles).toBe(4)
    expect(stats.permissions).toBe(15)
    expect(stats.activeUsers).toBe(4)
    expect(store.statsLoading).toBe(false)
  })

  it('invalidate 清空指定缓存', async () => {
    const store = useRbacStore()
    await store.loadRoleOptions()
    await store.loadPermissionOptions()

    store.invalidate('roles')
    expect(store.roleOptions.length).toBe(0)
    expect(store.permissionOptions.length).toBe(15)

    store.invalidate('all')
    expect(store.permissionOptions.length).toBe(0)
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
