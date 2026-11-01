<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <aside
      :class="[
        'sidebar-container',
        { 'is-collapsed': isCollapsed, 'is-mobile': isMobile }
      ]"
      @mouseenter="handleSidebarMouseEnter"
      @mouseleave="handleSidebarMouseLeave"
    >
      <!-- Logo区域 -->
      <div class="sidebar-header">
        <div class="logo" @click="handleLogoClick">
          <Monitor class="logo-icon" />
          <span v-if="!isCollapsed" class="logo-text">{{ appTitle }}</span>
        </div>
        <div v-if="!isCollapsed" class="sidebar-toggle" @click="toggleSidebar">
          <Fold v-if="!isCollapsed" />
          <Expand v-else />
        </div>
      </div>

      <!-- 菜单导航 -->
      <el-scrollbar class="sidebar-menu" wrap-class="scrollbar-wrapper">
        <el-menu
          :default-active="activeMenu"
          :unique-opened="true"
          :collapse="isCollapsed"
          :collapse-transition="false"
          router
          mode="vertical"
          :default-openeds="defaultOpenedMenus"
        >
          <sidebar-menu-item
            v-for="route in menuRoutes"
            :key="route.path"
            :route="route"
            :is-collapsed="isCollapsed"
            @click="handleMenuClick"
          />
        </el-menu>
      </el-scrollbar>

      <!-- 侧边栏底部 -->
      <div v-if="!isCollapsed" class="sidebar-footer">
        <div class="version-info">
          <span>{{ appTitle }}</span>
          <span class="version">v{{ appVersion }}</span>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-container" :class="{ 'sidebar-collapsed': isCollapsed }">
      <!-- 顶部导航栏 -->
      <header class="header">
        <!-- 移动端菜单按钮 -->
        <button
          v-if="isMobile"
          class="mobile-menu-btn"
          @click="toggleSidebar"
          aria-label="切换菜单"
        >
          <Menu />
        </button>

        <!-- 面包屑 -->
        <div class="breadcrumb-container">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">
              <HomeFilled /> 首页
            </el-breadcrumb-item>
            <el-breadcrumb-item v-for="(item, index) in breadcrumbs" :key="index">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- 右侧工具栏 -->
        <div class="header-tools">
          <!-- 主题切换 -->
          <el-tooltip :content="appStore.theme === 'light' ? '切换到深色模式' : '切换到浅色模式'" placement="bottom">
            <button class="tool-btn" @click="toggleTheme" aria-label="切换主题">
              <Moon v-if="appStore.theme === 'light'" />
              <Sunny v-else />
            </button>
          </el-tooltip>

          <!-- 全屏切换 -->
          <el-tooltip :content="appStore.fullscreen ? '退出全屏' : '进入全屏'" placement="bottom">
            <button class="tool-btn" @click="toggleFullscreen" aria-label="全屏切换">
              <FullScreen />
            </button>
          </el-tooltip>

          <!-- 锁屏 -->
          <el-tooltip content="锁定屏幕" placement="bottom">
            <button class="tool-btn" @click="lockScreen" aria-label="锁定屏幕">
              <Lock />
            </button>
          </el-tooltip>

          <!-- 通知 -->
          <el-tooltip content="消息通知" placement="bottom">
            <button class="tool-btn" aria-label="消息通知">
              <Bell />
              <span class="notification-badge">3</span>
            </button>
          </el-tooltip>

          <!-- 用户下拉菜单 -->
          <el-dropdown trigger="click">
            <div class="user-dropdown-trigger">
              <el-avatar :size="32" :src="authStore.userAvatar" class="user-avatar" />
              <span v-if="!isCollapsed" class="username">{{ authStore.userName }}</span>
              <ArrowDown v-if="!isCollapsed" class="dropdown-arrow" />
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openProfile" disabled>
                  <UserFilled /> 个人中心
                </el-dropdown-item>
                <el-dropdown-item @click="openSettings" disabled>
                  <Setting /> 设置
                </el-dropdown-item>
                <el-dropdown-item divided @click="lockScreen">
                  <Lock /> 锁定屏幕
                </el-dropdown-item>
                <el-dropdown-item @click="handleLogout">
                  <SwitchButton /> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 标签页栏 -->
      <tags-view v-if="settingsStore.settings.ui.showTagsView" />

      <!-- 页面内容 -->
      <main class="content" ref="contentRef">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 页脚 -->
      <footer v-if="settingsStore.settings.ui.showFooter" class="footer">
        <div class="footer-content">
          <span>{{ appTitle }} © 2024</span>
          <span>版本 {{ appVersion }}</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElBreadcrumb, ElBreadcrumbItem, ElAvatar, ElTooltip, ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import {
  Menu, HomeFilled, Moon, Sunny, FullScreen, Lock, Bell,
  UserFilled, Setting, SwitchButton, ArrowDown, Monitor, Fold, Expand
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/modules/auth'
import { useAppStore } from '@/store/modules/app'
import { useSettingsStore } from '@/store/modules/settings'
import SidebarMenuItem from './SidebarMenuItem.vue'
import TagsView from './TagsView.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const contentRef = ref<HTMLElement>()

// 应用配置
const appTitle = import.meta.env.VITE_APP_TITLE || '辰光Agent平台'
const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'

// 计算属性
const isCollapsed = computed(() => !appStore.sidebar.opened)
const isMobile = computed(() => appStore.device === 'mobile')

// 切换侧边栏
const toggleSidebar = () => {
  appStore.toggleSidebar()
}

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 默认展开的菜单
const defaultOpenedMenus = computed(() => {
  return route.matched
    .map((m) => m.path)
    .filter((p) => p !== '/' && p !== '/login')
})

// 面包屑
const breadcrumbs = computed(() => {
  const crumbs: Array<{ title: string; path: string }> = []
  route.matched.forEach((m) => {
    if (m.meta?.title && !m.meta?.hideInMenu && m.path !== '/') {
      crumbs.push({
        title: m.meta.title as string,
        path: m.path,
      })
    }
  })
  return crumbs
})

// 菜单路由
const menuRoutes = computed(() => {
  return router
    .getRoutes()
    .filter((r) => r.meta?.hideInMenu !== true && r.path !== '/' && r.path !== '/login')
    .sort((a, b) => (a.meta?.order as number || 0) - (b.meta?.order as number || 0))
})

// 侧边栏鼠标进入/离开
const handleSidebarMouseEnter = () => {
  if (isCollapsed.value && !isMobile.value) {
    appStore.openSidebar(true)
  }
}

const handleSidebarMouseLeave = () => {
  if (isCollapsed.value && !isMobile.value) {
    appStore.closeSidebar(true)
  }
}

// Logo点击
const handleLogoClick = () => {
  router.push('/dashboard')
}

// 菜单点击
const handleMenuClick = (path: string) => {
  router.push(path)
  if (isMobile.value) {
    appStore.closeSidebar()
  }
}

// 退出登录
const handleLogout = () => {
  authStore.logout()
}

// 切换全屏
const toggleFullscreen = () => {
  appStore.toggleFullscreen()
}

// 锁定屏幕
const lockScreen = () => {
  // TODO: 实现锁屏功能
  console.log('锁定屏幕')
}

// 打开个人中心
const openProfile = () => {
  router.push('/profile')
}

// 打开设置
const openSettings = () => {
  // TODO: 实现设置页面
  console.log('打开设置')
}

// 切换主题
const toggleTheme = () => {
  const newTheme = appStore.theme === 'light' ? 'dark' : 'light'
  appStore.setTheme(newTheme)
}

// 监听路由变化，更新面包屑
watch(
  () => route.path,
  () => {
    appStore.setBreadcrumbs(breadcrumbs.value)
  },
  { immediate: true }
)

onMounted(() => {
  // 初始化面包屑
  appStore.setBreadcrumbs(breadcrumbs.value)
})

onUnmounted(() => {
  // 清理工作
})
</script>

<style scoped lang="scss">
.layout-container {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: var(--el-bg-color, #f0f2f5);
}

// 侧边栏
.sidebar-container {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  background: var(--el-bg-color-overlay, #ffffff);
  border-right: 1px solid var(--el-border-color-light, #e4e7ed);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: width 0.3s ease, transform 0.3s ease;

  &.is-collapsed {
    width: 64px;
  }

  &.is-mobile {
    transform: translateX(-100%);
    &.is-collapsed {
      transform: translateX(0);
    }
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 20px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: var(--el-text-color-primary, #303133);

  .logo-icon {
    font-size: 24px;
    color: var(--el-color-primary, #409eff);
  }

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
  }
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--el-text-color-secondary, #909399);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-text-color-primary, #303133);
  }
}

.sidebar-menu {
  flex: 1;
  overflow: hidden;
  padding: 10px 0;

  .scrollbar-wrapper {
    height: 100%;
  }

  :deep(.el-menu) {
    border-right: none;
  }

  :deep(.el-menu-item) {
    padding: 0 20px;
    height: 44px;
    line-height: 44px;
    border-left: 3px solid transparent;
    margin: 4px 12px;
    border-radius: 6px;
    transition: all 0.3s ease;

    &:hover {
      background: var(--el-fill-color-light, #f5f7fa);
      border-left-color: var(--el-color-primary-light, #79bbff);
    }

    &.is-active {
      background: var(--el-color-primary-light-9, #ecf5ff);
      border-left-color: var(--el-color-primary, #409eff);
      color: var(--el-color-primary, #409eff);

      :deep(.el-icon) {
        color: var(--el-color-primary, #409eff);
      }
    }
  }

  :deep(.el-sub-menu__title) {
    padding: 0 20px;
    height: 44px;
    line-height: 44px;
    margin: 4px 12px;
    border-radius: 6px;
    transition: all 0.3s ease;

    &:hover {
      background: var(--el-fill-color-light, #f5f7fa);
    }
  }

  :deep(.el-menu--collapse) {
    :deep(.el-sub-menu__title) {
      padding: 0;
      margin: 4px;
      justify-content: center;
    }
  }
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);

  .version-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-placeholder, #c0c4cc);

    .version {
      background: var(--el-fill-color-light, #f5f7fa);
      padding: 2px 8px;
      border-radius: 4px;
    }
  }
}

// 主内容区
.main-container {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left 0.3s ease;

  &.sidebar-collapsed {
    margin-left: 64px;
  }
}

// 顶部导航栏
.header {
  height: 56px;
  background: var(--el-bg-color-overlay, #ffffff);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 24px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--el-text-color-primary, #303133);
  cursor: pointer;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
  }
}

.breadcrumb-container {
  flex: 1;
  overflow: hidden;

  :deep(.el-breadcrumb) {
    font-size: 14px;
  }

  :deep(.el-breadcrumb__inner) {
    color: var(--el-text-color-secondary, #909399);

    &:hover {
      color: var(--el-color-primary, #409eff);
    }
  }

  :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
    color: var(--el-text-color-primary, #303133);
    font-weight: 500;
  }
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--el-text-color-secondary, #909399);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-text-color-primary, #303133);
  }
}

.notification-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--el-color-danger, #f56c6c);
  color: white;
  font-size: 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
  }

  .user-avatar {
    cursor: pointer;
  }

  .username {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary, #303133);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .dropdown-arrow {
    font-size: 12px;
    color: var(--el-text-color-placeholder, #c0c4cc);
  }
}

:deep(.el-dropdown-menu) {
  min-width: 180px;
  padding: 8px 0;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
}

:deep(.el-dropdown-item) {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--el-text-color-primary, #303133);

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-color-primary, #409eff);
  }

  &.is-disabled {
    color: var(--el-text-color-placeholder, #c0c4cc);
    cursor: not-allowed;
  }
}

// 标签页栏
:deep(.tags-view) {
  height: 40px;
  background: var(--el-bg-color-overlay, #ffffff);
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);
}

// 内容区
.content {
  flex: 1;
  padding: 24px;
  overflow: auto;
  background: var(--el-bg-color, #f0f2f5);
}

// 页脚
.footer {
  height: 48px;
  background: var(--el-bg-color-overlay, #ffffff);
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder, #c0c4cc);

  .footer-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

// 页面过渡动画
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

// 响应式
@media (max-width: 768px) {
  .sidebar-container {
    &.is-collapsed {
      transform: translateX(-100%);
    }
  }

  .main-container {
    margin-left: 0 !important;

    &.sidebar-collapsed {
      margin-left: 0 !important;
    }
  }

  .mobile-menu-btn {
    display: flex !important;
  }

  .breadcrumb-container {
    display: none;
  }

  .content {
    padding: 16px;
  }
}

@media (max-width: 1024px) and (min-width: 769px) {
  .sidebar-container {
    width: 220px;
  }

  .main-container {
    margin-left: 220px;
  }

  .main-container.sidebar-collapsed {
    margin-left: 64px;
  }
}
</style>