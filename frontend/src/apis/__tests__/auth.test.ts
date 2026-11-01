/**
 * API层测试
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { request } from '@/apis/index'
import * as authApi from '@/apis/modules/auth'
import * as userApi from '@/apis/modules/user'
import { server } from '@/mocks/server'
import { handlers } from '@/mocks/handlers'

beforeAll(() => {
  server.use(...handlers)
})

describe('API层 - 认证接口', () => {
  it('登录接口 - 成功', async () => {
    const result = await authApi.loginApi({
      username: 'admin',
      password: '123456',
    })

    expect(result).toBeDefined()
    expect(result.access_token).toBeDefined()
    expect(result.refresh_token).toBeDefined()
    expect(result.user).toBeDefined()
    expect(result.user.username).toBe('admin')
  })

  it('登录接口 - 密码错误', async () => {
    await expect(
      authApi.loginApi({
        username: 'admin',
        password: 'wrong',
      })
    ).rejects.toThrow()
  })

  it('获取当前用户接口', async () => {
    // 设置token
    localStorage.setItem('access_token', 'mock-token')

    const result = await authApi.getCurrentUserApi()

    expect(result).toBeDefined()
    expect(result.username).toBe('admin')
    expect(result.permissions).toBeDefined()
  })

  it('获取验证码接口', async () => {
    const result = await authApi.getCaptchaApi()

    expect(result).toBeDefined()
    expect(result.captcha_id).toBe('mock-captcha-id')
    expect(result.image).toBeDefined()
  })
})

describe('API层 - 用户接口', () => {
  it('获取用户列表', async () => {
    const result = await userApi.getUserListApi({
      page: 1,
      page_size: 10,
    })

    expect(result).toBeDefined()
    expect(result.items).toBeInstanceOf(Array)
    expect(result.total).toBeGreaterThan(0)
    expect(result.page).toBe(1)
    expect(result.page_size).toBe(10)
  })

  it('获取用户详情', async () => {
    const result = await userApi.getUserDetailApi(1)

    expect(result).toBeDefined()
    expect(result.id).toBe(1)
    expect(result.username).toBe('admin')
  })

  it('获取不存在的用户详情', async () => {
    await expect(userApi.getUserDetailApi(999)).rejects.toThrow()
  })

  it('创建用户', async () => {
    const result = await userApi.createUserApi({
      username: 'testuser',
      email: 'test@chenguang.com',
      password: '123456',
      full_name: '测试用户',
      role_ids: [3],
    })

    expect(result).toBeDefined()
    expect(result.username).toBe('testuser')
  })

  it('更新用户', async () => {
    const result = await userApi.updateUserApi(2, {
      full_name: '张三丰',
      email: 'zhangsanfeng@chenguang.com',
    })

    expect(result).toBeDefined()
    expect(result.id).toBe(2)
    expect(result.full_name).toBe('张三丰')
  })

  it('删除用户', async () => {
    await expect(userApi.deleteUserApi(5)).resolves.toBeNull()
  })

  it('获取角色选项', async () => {
    const result = await userApi.getUserRoleOptionsApi()

    expect(result).toBeInstanceOf(Array)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].name).toBeDefined()
  })
})

describe('API层 - 请求方法封装', () => {
  it('GET请求', async () => {
    const result = await request.get('/users/role-options')
    expect(result).toBeInstanceOf(Array)
  })

  it('POST请求', async () => {
    const result = await request.post<{ access_token: string }>('/auth/login', {
      username: 'admin',
      password: '123456',
    })
    expect(result.access_token).toBeDefined()
  })

  it('PUT请求', async () => {
    const result = await request.put<{ full_name: string }>('/users/2', {
      full_name: '更新用户',
    })
    expect(result.full_name).toBe('更新用户')
  })

  it('DELETE请求', async () => {
    await expect(request.delete('/users/4')).resolves.toBeNull()
  })
})
