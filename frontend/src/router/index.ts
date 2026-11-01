/**
 * 路由入口 - 创建路由实例、注册守卫
 */

import { createRouter, createWebHistory, createMemoryHistory, type Router, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'
import { usePermissionStore } from '@/store/modules/permission'
import { constantRoutes, asyncRoutes, whiteList, getAllRoutes } from './routes'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// 配置NProgress
NProgress.configure({ showSpinner: false })

/**
 * 创建路由实例
 */
const router: Router = createRouter({
  // 测试环境使用memory history，避免jsdom导航错误
  history: import.meta.env.MODE === 'test' ? createMemoryHistory() : createWebHistory(import.meta.env.VITE_BASE_URL || '/'),
  routes: constantRoutes as RouteRecordRaw[],
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * 动态路由标记
 */
let isDynamicRoutesAdded = false

/**
 * 添加动态路由
 */
function addDynamicRoutes(routes: RouteRecordRaw[]): void {
  routes.forEach((route) => {
    router.addRoute(route)
  })
  isDynamicRoutesAdded = true
}

/**
 * 移除动态路由
 */
function removeDynamicRoutes(): void {
  if (isDynamicRoutesAdded) {
    asyncRoutes.forEach((route) => {
      router.removeRoute(route.name as string)
      // 同时移除子路由
      if (route.children) {
        route.children.forEach((child) => {
          router.removeRoute(child.name as string)
        })
      }
    })
    isDynamicRoutesAdded = false
  }
}

/**
 * 根据权限过滤路由
 * 规则：
 * - 无权限要求的叶子路由对所有登录用户可见
 * - 带权限要求的叶子路由：有任一权限即保留
 * - 父路由：自身有权限，或存在"带权限要求且已通过"的子路由时保留（
 *   仅有无需权限的占位子路由不足以让受限父路由出现在菜单中）
 */
function filterRoutesByPermission(routes: RouteRecordRaw[], permissions: string[]): RouteRecordRaw[] {
  const filteredRoutes: RouteRecordRaw[] = []

  routes.forEach((route) => {
    const routePermissions = route.meta?.permissions as string[] | undefined
    const hasOwnPermissionRequirement = Boolean(routePermissions && routePermissions.length > 0)
    const passesOwnPermission =
      !hasOwnPermissionRequirement || routePermissions!.some((p) => permissions.includes(p))

    let filteredRoute: RouteRecordRaw | null = null

    if (route.children && route.children.length > 0) {
      const children = filterRoutesByPermission(route.children, permissions)
      const hasAuthorizedChild = children.some((child) => {
        const childPermissions = child.meta?.permissions as string[] | undefined
        return Boolean(childPermissions && childPermissions.length > 0)
      })

      if (hasOwnPermissionRequirement) {
        // 受限父路由：自身通过，或至少有一个真正授权的子路由
        if (passesOwnPermission || hasAuthorizedChild) {
          filteredRoute = { ...route, children }
        }
      } else if (children.length > 0) {
        filteredRoute = { ...route, children }
      }
    } else if (passesOwnPermission) {
      filteredRoute = { ...route }
    }

    if (filteredRoute) {
      filteredRoutes.push(filteredRoute)
    }
  })

  return filteredRoutes
}

/**
 * 全局前置守卫
 * 登录校验 → 用户信息/权限加载 → 动态路由注入 → 权限校验（PRD 8.2 / FR-04）
 */
router.beforeEach(async (to, from, next) => {
  NProgress.start()

  const authStore = useAuthStore()
  const permissionStore = usePermissionStore()

  // 设置页面标题
  document.title = `${to.meta.title as string} - ${import.meta.env.VITE_APP_TITLE || '辰光Agent平台'}`

  // 白名单直接放行
  if (whiteList.includes(to.path)) {
    next()
    return
  }

  // 未登录，重定向到登录页
  if (!authStore.isAuthenticated) {
    next(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    NProgress.done()
    return
  }

  // 已登录但访问登录页，重定向到首页
  if (to.path === '/login') {
    next('/')
    NProgress.done()
    return
  }

  // 恢复用户信息（刷新页面后仅有 Token）
  if (!authStore.user) {
    await authStore.fetchUserInfo()
  }

  // 权限加载失败时不放行（PRD Review Focus 5）
  if (!permissionStore.loaded) {
    const ok = await permissionStore.refreshPermissions()
    if (!ok) {
      next('/403?reason=permission')
      NProgress.done()
      return
    }
  }

  // 动态添加路由（只在首次登录时添加）
  if (!isDynamicRoutesAdded) {
    try {
      const accessibleRoutes = filterRoutesByPermission(asyncRoutes, permissionStore.permissionList)
      addDynamicRoutes(accessibleRoutes)
      // 重新导航到目标路由
      next({ ...to, replace: true })
      return
    } catch (error) {
      console.error('动态路由添加失败:', error)
      await authStore.logout()
      next('/login')
      NProgress.done()
      return
    }
  }

  // 权限检查
  const routePermissions = to.meta?.permissions as string[] | undefined
  if (routePermissions && routePermissions.length > 0) {
    if (!permissionStore.hasAny(routePermissions)) {
      next('/403')
      NProgress.done()
      return
    }
  }

  next()
})

/**
 * 全局后置钩子
 */
router.afterEach((to, from) => {
  NProgress.done()
})

/**
 * 路由错误处理
 */
router.onError((error) => {
  NProgress.done()
  console.error('路由错误:', error)
})

/**
 * 重置路由（登出时调用）
 */
export function resetRouter(): void {
  removeDynamicRoutes()
  // 重新添加静态路由
  constantRoutes.forEach((route) => {
    if (!router.hasRoute(route.name as string)) {
      router.addRoute(route)
    }
  })
}

/**
 * 刷新路由（权限变更时调用）
 */
export function refreshRouter(): void {
  const permissionStore = usePermissionStore()
  removeDynamicRoutes()
  const permissions = permissionStore.permissionList
  if (permissions.length > 0 || permissionStore.isSuperuser) {
    const accessibleRoutes = filterRoutesByPermission(asyncRoutes, permissions)
    addDynamicRoutes(accessibleRoutes)
  }
}

export { getAllRoutes, filterRoutesByPermission }
export default router