/**
 * Pinia Store - 应用全局状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

// 侧边栏状态
interface SidebarState {
  opened: boolean
  withoutAnimation: boolean
  isMobile: boolean
}

// 标签页状态
interface TagItem {
  title: string
  path: string
  name?: string
  closable: boolean
  icon?: string
}

interface TagsViewState {
  visitedViews: TagItem[]
  cachedViews: string[]
}

// 面包屑状态
interface BreadcrumbItem {
  title: string
  path: string
}

export const useAppStore = defineStore('app', () => {
  // 侧边栏状态
  const sidebar = ref<SidebarState>({
    opened: true,
    withoutAnimation: false,
    isMobile: false,
  })

  // 标签页状态
  const tagsView = ref<TagsViewState>({
    visitedViews: [],
    cachedViews: [],
  })

  // 面包屑
  const breadcrumbs = ref<BreadcrumbItem[]>([])

  // 设备类型
  const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop')

  // 语言
  const language = ref<string>('zh-CN')

  // 主题
  const theme = ref<'light' | 'dark' | 'auto'>('light')

  // 布局模式
  const layout = ref<'side' | 'top' | 'mix'>('side')

  // 页面加载状态
  const pageLoading = ref(false)

  // 全屏状态
  const fullscreen = ref(false)

  // 计算属性
  const isSidebarOpened = computed(() => sidebar.value.opened)
  const isMobile = computed(() => device.value === 'mobile')

  // Actions
  function toggleSidebar(withoutAnimation = false) {
    sidebar.value.opened = !sidebar.value.opened
    sidebar.value.withoutAnimation = withoutAnimation
  }

  function closeSidebar(withoutAnimation = false) {
    sidebar.value.opened = false
    sidebar.value.withoutAnimation = withoutAnimation
  }

  function openSidebar(withoutAnimation = false) {
    sidebar.value.opened = true
    sidebar.value.withoutAnimation = withoutAnimation
  }

  function toggleDevice(deviceType: 'desktop' | 'tablet' | 'mobile') {
    device.value = deviceType
    sidebar.value.isMobile = deviceType === 'mobile'
    if (deviceType === 'mobile') {
      closeSidebar()
    }
  }

  function setLanguage(lang: string) {
    language.value = lang
    localStorage.setItem('language', lang)
  }

  function setTheme(newTheme: 'light' | 'dark' | 'auto') {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  function setLayout(newLayout: 'side' | 'top' | 'mix') {
    layout.value = newLayout
    localStorage.setItem('layout', newLayout)
  }

  function applyTheme(newTheme: 'light' | 'dark' | 'auto') {
    const html = document.documentElement
    if (newTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      html.classList.toggle('dark', prefersDark)
    } else {
      html.classList.toggle('dark', newTheme === 'dark')
    }
  }

  function toggleFullscreen() {
    fullscreen.value = !fullscreen.value
    if (fullscreen.value) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  // 标签页操作
  function addVisitedView(view: TagItem) {
    // 避免重复添加
    if (tagsView.value.visitedViews.some((v) => v.path === view.path)) return
    tagsView.value.visitedViews.push(view)
  }

  function removeVisitedView(path: string) {
    const index = tagsView.value.visitedViews.findIndex((v) => v.path === path)
    if (index !== -1) {
      tagsView.value.visitedViews.splice(index, 1)
    }
  }

  function closeOtherViews(currentPath: string) {
    tagsView.value.visitedViews = tagsView.value.visitedViews.filter(
      (v) => v.path === currentPath || !v.closable
    )
  }

  function closeAllViews() {
    tagsView.value.visitedViews = tagsView.value.visitedViews.filter((v) => !v.closable)
  }

  function setVisitedViews(views: TagItem[]) {
    tagsView.value.visitedViews = views
  }

  // 缓存视图操作
  function addCachedView(name: string) {
    if (!tagsView.value.cachedViews.includes(name)) {
      tagsView.value.cachedViews.push(name)
    }
  }

  function removeCachedView(name: string) {
    const index = tagsView.value.cachedViews.indexOf(name)
    if (index !== -1) {
      tagsView.value.cachedViews.splice(index, 1)
    }
  }

  // 面包屑操作
  function setBreadcrumbs(crumbs: BreadcrumbItem[]) {
    breadcrumbs.value = crumbs
  }

  // 页面加载状态
  function startPageLoading() {
    pageLoading.value = true
  }

  function finishPageLoading() {
    pageLoading.value = false
  }

  // 初始化（应用启动时调用）
  function initialize() {
    // 恢复本地存储的设置
    const savedLanguage = localStorage.getItem('language')
    if (savedLanguage) {
      language.value = savedLanguage
    }

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto' | null
    if (savedTheme) {
      theme.value = savedTheme
      applyTheme(savedTheme)
    }

    const savedLayout = localStorage.getItem('layout') as 'side' | 'top' | 'mix' | null
    if (savedLayout) {
      layout.value = savedLayout
    }

    // 检测设备类型
    const updateDevice = () => {
      const width = window.innerWidth
      if (width < 768) {
        device.value = 'mobile'
      } else if (width < 1024) {
        device.value = 'tablet'
      } else {
        device.value = 'desktop'
      }
      sidebar.value.isMobile = device.value === 'mobile'
    }

    updateDevice()
    window.addEventListener('resize', updateDevice)

    // 监听全屏变化
    document.addEventListener('fullscreenchange', () => {
      fullscreen.value = !!document.fullscreenElement
    })
  }

  return {
    // 状态
    sidebar,
    tagsView,
    breadcrumbs,
    device,
    language,
    theme,
    layout,
    pageLoading,
    fullscreen,
    // 计算属性
    isSidebarOpened,
    isMobile,
    // Actions
    toggleSidebar,
    closeSidebar,
    openSidebar,
    toggleDevice,
    setLanguage,
    setTheme,
    setLayout,
    applyTheme,
    toggleFullscreen,
    addVisitedView,
    removeVisitedView,
    closeOtherViews,
    closeAllViews,
    setVisitedViews,
    addCachedView,
    removeCachedView,
    setBreadcrumbs,
    startPageLoading,
    finishPageLoading,
    initialize,
  }
})