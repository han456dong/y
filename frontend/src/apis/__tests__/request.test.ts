/**
 * API层测试 - 请求方法封装
 */

import { describe, it, expect } from 'vitest'
import { request } from '@/apis/index'
import type { Permission, Role } from '@/apis/modules/rbac'

describe('请求方法封装', () => {
  it('GET 请求', async () => {
    const result = await request.get<Permission[]>('/v1/permissions/')
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBeGreaterThan(0)
  })

  it('GET 请求携带查询参数', async () => {
    const result = await request.get<{ items: Permission[]; total: number }>('/v1/permissions/search', {
      page: 1,
      page_size: 3,
    })
    expect(result.items.length).toBe(3)
    expect(result.total).toBe(15)
  })

  it('POST 请求', async () => {
    const result = await request.post<Permission>('/v1/permissions', {
      code: 'test:request',
      name: '请求测试',
    })
    expect(result.code).toBe('test:request')
  })

  it('PUT 请求', async () => {
    const result = await request.put<Role>('/v1/roles/2', { name: '管理员（更新）' })
    expect(result.name).toBe('管理员（更新）')
  })

  it('DELETE 请求', async () => {
    await expect(request.delete('/v1/roles/4')).resolves.toBeNull()
  })
})
