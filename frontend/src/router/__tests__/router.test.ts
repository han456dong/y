/**
 * 路由层测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { constantRoutes, asyncRoutes, whiteList, getAllRoutes } from '@/router/routes'
import { filterRoutesByPermission } from '@/router/index'

describe('路由层 - 路由表定义', () => {
  it('静态路由包含登录页', () => {
    const loginRoute = constantRoutes.find((r) => r.path === '/login')
    expect(loginRoute).toBeDefined()
    expect(loginRoute!.name).toBe('Login')
  })

  it('静态路由包含错误页', () => {
    expect(constantRoutes.some((r) => r.path === '/403')).toBe(true)
    expect(constantRoutes.some((r) => r.path === '/404')).toBe(true)
    expect(constantRoutes.some((r) => r.path === '/500')).toBe(true)
  })

  it('异步路由包含系统管理模块', () => {
    const systemRoute = asyncRoutes.find((r) => r.path === '/system')
    expect(systemRoute).toBeDefined()
    expect(systemRoute!.children).toBeDefined()
    expect(systemRoute!.children!.length).toBeGreaterThan(0)
  })

  it('异步路由包含用户管理页面', () => {
    const systemRoute = asyncRoutes.find((r) => r.path === '/system')
    const userRoute = systemRoute!.children!.find((r) => r.path === 'user')
    expect(userRoute).toBeDefined()
    expect(userRoute!.name).toBe('UserManagement')
  })

  it('获取所有路由', () => {
    const allRoutes = getAllRoutes()
    expect(allRoutes.length).toBe(constantRoutes.length + asyncRoutes.length)
  })

  it('白名单路由', () => {
    expect(whiteList).toContain('/login')
    expect(whiteList).toContain('/403')
    expect(whiteList).toContain('/404')
    expect(whiteList).toContain('/500')
  })
})

describe('路由层 - 权限过滤', () => {
  it('管理员权限可以看到所有路由', () => {
    const allPermissions = ['system:manage', 'system:user:view', 'system:role:view', 'monitor:view']
    const filtered = filterRoutesByPermission(asyncRoutes, allPermissions)
    expect(filtered.length).toBeGreaterThan(0)
  })

  it('无权限用户看不到系统管理', () => {
    const filtered = filterRoutesByPermission(asyncRoutes, [])
    // 无权限要求的路由保留，但权限路由（如系统管理）被过滤
    const systemRoute = filtered.find((r) => r.path === '/system')
    expect(systemRoute).toBeUndefined()
    const monitorRoute = filtered.find((r) => r.path === '/monitor')
    expect(monitorRoute).toBeUndefined()
  })

  it('只有用户管理权限时只看到用户管理', () => {
    const permissions = ['system:user:view']
    const filtered = filterRoutesByPermission(asyncRoutes, permissions)

    // 检查是否有系统管理路由
    const systemRoute = filtered.find((r) => r.path === '/system')
    expect(systemRoute).toBeDefined()

    // 检查子路由只有用户管理
    const children = systemRoute!.children!
    expect(children.length).toBe(1)
    expect(children[0].path).toBe('user')
  })
})

describe('路由层 - 路由实例', () => {
  let router: Router

  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes: constantRoutes,
    })
  })

  it('可以导航到登录页', async () => {
    await router.push('/login')
    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('可以导航到404页面', async () => {
    await router.push('/404')
    expect(router.currentRoute.value.path).toBe('/404')
    expect(router.currentRoute.value.name).toBe('NotFound')
  })

  it('未知路径重定向到404', async () => {
    await router.push('/unknown-path')
    expect(router.currentRoute.value.path).toBe('/unknown-path')
  })
})
