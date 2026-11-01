/**
 * 测试环境配置
 */

import { beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '@/mocks/server'

// 启动Mock Server
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

// 每个测试后重置处理器
afterEach(() => {
  server.resetHandlers()
})

// 关闭Mock Server
afterAll(() => {
  server.close()
})

// Mock localStorage
class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }
}

// 设置全局localStorage
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MockStorage(),
    writable: true,
  })
}

// 强制axios使用fetch适配器（MSW Node拦截fetch，不拦截XHR）
if (typeof globalThis.XMLHttpRequest !== 'undefined') {
  // @ts-ignore
  globalThis.XMLHttpRequest = undefined
}

// Mock matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Mock window.scrollTo（jsdom未实现，路由scrollBehavior会调用）
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}

// Mock window.location 防止测试环境导航报错
if (typeof window !== 'undefined') {
  const originalLocation = window.location
  const mockLocation = {
    ...originalLocation,
    href: '',
    assign: () => {},
    replace: () => {},
    reload: () => {},
  }

  Object.defineProperty(window, 'location', {
    writable: true,
    value: mockLocation,
  })
}

// Mock Element Plus ElMessage（避免测试环境报错）
if (typeof globalThis !== 'undefined') {
  const mockElMessage = {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  }

  Object.defineProperty(globalThis, 'ElMessage', {
    writable: true,
    value: mockElMessage,
  })
}
