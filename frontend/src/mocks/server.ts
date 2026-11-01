/**
 * Mock Server - MSW Node环境（用于测试）
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// 创建测试Mock Server
export const server = setupServer(...handlers)
