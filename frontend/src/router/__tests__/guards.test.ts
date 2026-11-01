/**
 * 路由守卫工具测试
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import {
  getCurrentRoute,
  getBreadcrumbs,
  hasRoute,
  getMenuRoutes,
  flattenRoutes,
  findRouteByPath,
  findRouteByName,
  generateTab,
  isExternalLink,
  safePush,
  safeReplace,
} from '@/router/guards'

describe('路由守卫工具', () => {
  beforeAll(() => {
    setActivePinia(createPinia())
  })

  it('getCurrentRoute 返回当前路由', () => {
    const current = getCurrentRoute()
    expect(current).toBeDefined()
    expect(current.path).toBeDefined()
  })

  it('getBreadcrumbs 返回数组', () => {
    const crumbs = getBreadcrumbs()
    expect(crumbs).toBeInstanceOf(Array)
  })

  it('hasRoute 判断路由是否存在', () => {
    expect(hasRoute('Login')).toBe(true)
    expect(hasRoute('NotExistRouteName')).toBe(false)
  })

  it('getMenuRoutes 过滤隐藏菜单', () => {
    const menus = getMenuRoutes()
    expect(menus).toBeInstanceOf(Array)
    menus.forEach((m) => {
      expect(m.meta?.hideInMenu).not.toBe(true)
    })
  })

  it('flattenRoutes 扁平化嵌套路由', () => {
    const nested = [
      {
        path: '/a',
        name: 'A',
        children: [{ path: '/a/b', name: 'B', children: [] }],
      },
    ] as any
    const flat = flattenRoutes(nested)
    expect(flat.length).toBe(2)
  })

  it('findRouteByPath 按路径查找', () => {
    const found = findRouteByPath('/login')
    expect(found).toBeDefined()
    expect(found!.path).toBe('/login')
  })

  it('findRouteByName 按名称查找', () => {
    const found = findRouteByName('Login')
    expect(found).toBeDefined()
  })

  it('generateTab 生成标签页数据', () => {
    const tab = generateTab()
    expect(tab).toHaveProperty('title')
    expect(tab).toHaveProperty('path')
    expect(typeof tab.closable).toBe('boolean')
  })

  it('isExternalLink 判断外部链接', () => {
    expect(isExternalLink('https://example.com')).toBe(true)
    expect(isExternalLink('http://example.com')).toBe(true)
    expect(isExternalLink('mailto:a@b.com')).toBe(true)
    expect(isExternalLink('/internal')).toBe(false)
  })

  it('safePush 导航到已存在路由', async () => {
    await new Promise((r) => setTimeout(r, 350))
    await safePush('/404')
    expect(router.currentRoute.value.path).toBe('/404')
  })

  it('safeReplace 替换导航', async () => {
    await new Promise((r) => setTimeout(r, 350))
    await safeReplace('/403')
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('safePush 节流：连续导航被拒绝', async () => {
    await new Promise((r) => setTimeout(r, 350))
    // 第一次导航成功
    await safePush('/404')
    // 立即第二次导航会被节流拒绝
    await expect(safePush('/403')).rejects.toThrow('导航过于频繁')
  })
})
