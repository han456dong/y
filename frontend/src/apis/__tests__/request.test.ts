/**
 * API层测试 - 请求方法封装
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { request } from '@/apis/index'
import { authenticate } from '@/test/helpers'
import type { Permission, Role } from '@/apis/modules/rbac'

beforeEach(async () => {
  localStorage.clear()
  await authenticate('admin')
})

describe('请求方法封装', () => {
  it('GET 请求', async () => {
    const result = await request.get<Permission[]>('/v1/permissions/')
    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBe(63)
  })

  it('GET 请求携带查询参数', async () => {
    const result = await request.get<{ items: Permission[]; total: number }>('/v1/permissions/search', {
      page: 1,
      page_size: 3,
    })
    expect(result.items.length).toBe(3)
    expect(result.total).toBe(63)
  })

  it('POST 请求', async () => {
    const result = await request.post<Permission>('/v1/permissions', {
      code: 'test:request',
      name: '请求测试',
    })
    expect(result.code).toBe('test:request')
    expect(result.is_system).toBe(false)
  })

  it('PUT 请求', async () => {
    const result = await request.put<Role>('/v1/roles/2', { name: '运营团队' })
    expect(result.name).toBe('运营团队')
  })

  it('DELETE 请求', async () => {
    const temp = await request.post<Role>('/v1/roles', { code: 'tempapi', name: '临时角色' })
    await expect(request.delete(`/v1/roles/${temp.id}`)).resolves.toBeNull()
  })
})
