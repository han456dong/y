/**
 * Store层测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/store/modules/auth'
import { useAppStore } from '@/store/modules/app'
import { useSettingsStore } from '@/store/modules/settings'

describe('Store层 - AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('初始状态', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
    expect(store.permissions).toEqual([])
  })

  it('登录成功', async () => {
    const store = useAuthStore()
    await store.login({
      username: 'admin',
      password: '123456',
    })

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toBeDefined()
    expect(store.user?.username).toBe('admin')
  })

  it('登录失败', async () => {
    const store = useAuthStore()
    await expect(
      store.login({
        username: 'admin',
        password: 'wrong',
      })
    ).rejects.toThrow()

    expect(store.isAuthenticated).toBe(false)
  })

  it('登出', async () => {
    const store = useAuthStore()
    await store.login({
      username: 'admin',
      password: '123456',
    })
    expect(store.isAuthenticated).toBe(true)

    await store.logout(false)
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('计算属性 - 用户名', async () => {
    const store = useAuthStore()
    await store.login({
      username: 'admin',
      password: '123456',
    })

    expect(store.userName).toBe('系统管理员')
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
    expect(store.tagsView.visitedViews.length).toBe(2) // 首页 + 用户

    store.closeAllViews()
    expect(store.tagsView.visitedViews.length).toBe(1) // 仅保留不可关闭的首页
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
