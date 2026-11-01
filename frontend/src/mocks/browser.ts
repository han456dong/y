/**
 * Mock Server - MSW浏览器环境
 */

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// 创建Mock Worker
export const worker = setupWorker(...handlers)

// 启动Mock Worker
export async function startMockServer() {
  if (import.meta.env.DEV) {
    await worker.start({
      onUnhandledFrame: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    })
  }
}
