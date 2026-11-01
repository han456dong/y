/**
 * 路由守卫工具函数
 */

import type { RouteRecordRaw } from 'vue-router'
import router from './index'

/**
 * 获取当前路由信息
 */
export function getCurrentRoute() {
  return router.currentRoute.value
}

/**
 * 获取面包屑导航
 */
export function getBreadcrumbs(route = router.currentRoute.value): Array<{ title: string; path: string }> {
  const breadcrumbs: Array<{ title: string; path: string }> = []

  route.matched.forEach((matched) => {
    if (matched.meta?.title && !matched.meta?.hideInMenu && matched.path !== '/') {
      breadcrumbs.push({
        title: matched.meta.title as string,
        path: matched.path,
      })
    }
  })

  return breadcrumbs
}

/**
 * 检查路由是否存在
 */
export function hasRoute(name: string): boolean {
  return router.hasRoute(name)
}

/**
 * 获取所有菜单路由（用于侧边栏菜单生成）
 */
export function getMenuRoutes(): RouteRecordRaw[] {
  return router
    .getRoutes()
    .filter((route) => route.meta?.hideInMenu !== true && route.path !== '/')
    .sort((a, b) => (a.meta?.order as number || 0) - (b.meta?.order as number || 0))
}

/**
 * 扁平化路由（用于权限检查、搜索等）
 */
export function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []

  routes.forEach((route) => {
    result.push(route)
    if (route.children) {
      result.push(...flattenRoutes(route.children))
    }
  })

  return result
}

/**
 * 根据路径查找路由
 */
export function findRouteByPath(path: string): RouteRecordRaw | undefined {
  const allRoutes = flattenRoutes(router.getRoutes())
  return allRoutes.find((route) => route.path === path)
}

/**
 * 根据名称查找路由
 */
export function findRouteByName(name: string): RouteRecordRaw | undefined {
  return router.getRoutes().find((route) => route.name === name)
}

/**
 * 生成路由标签页数据
 */
export function generateTab(route = router.currentRoute.value): { title: string; path: string; name?: string; closable: boolean } {
  return {
    title: (route.meta?.title as string) || '未知页面',
    path: route.fullPath,
    name: route.name as string | undefined,
    closable: route.meta?.closable !== false && route.path !== '/dashboard',
  }
}

/**
 * 检查是否为外部链接
 */
export function isExternalLink(path: string): boolean {
  return /^(https?|mailto|tel):/.test(path)
}

/**
 * 安全跳转（防止重复跳转）
 */
let lastNavigationTime = 0
const NAVIGATION_THROTTLE = 300 // ms

export function safePush(path: string): Promise<void> {
  const now = Date.now()
  if (now - lastNavigationTime < NAVIGATION_THROTTLE) {
    return Promise.reject(new Error('导航过于频繁'))
  }
  lastNavigationTime = now
  return router.push(path).then(() => undefined)
}

export function safeReplace(path: string): Promise<void> {
  const now = Date.now()
  if (now - lastNavigationTime < NAVIGATION_THROTTLE) {
    return Promise.reject(new Error('导航过于频繁'))
  }
  lastNavigationTime = now
  return router.replace(path).then(() => undefined)
}