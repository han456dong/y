/**
 * API层 - 错误处理与拦截器测试
 */

import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { request } from '@/apis/index'

describe('API层 - 错误处理', () => {
  it('业务错误码被正确抛出', async () => {
    server.use(
      http.get('http://localhost/api/biz-error', () =>
        HttpResponse.json({ code: 1001, message: '业务错误', data: null, timestamp: Date.now() })
      )
    )

    await expect(request.get('/biz-error')).rejects.toMatchObject({
      code: 1001,
      message: '业务错误',
    })
  })

  it('404 错误被拦截', async () => {
    server.use(
      http.get('http://localhost/api/not-found', () =>
        HttpResponse.json({ code: 404, message: '资源不存在', data: null }, { status: 404 })
      )
    )

    await expect(request.get('/not-found')).rejects.toMatchObject({ code: 404 })
  })

  it('500 错误被拦截', async () => {
    server.use(
      http.get('http://localhost/api/server-error', () =>
        HttpResponse.json({ code: 500, message: '服务器错误', data: null }, { status: 500 })
      )
    )

    await expect(request.get('/server-error')).rejects.toMatchObject({ code: 500 })
  })

  it('403 错误被拦截', async () => {
    server.use(
      http.get('http://localhost/api/forbidden', () =>
        HttpResponse.json({ code: 403, message: '禁止访问', data: null }, { status: 403 })
      )
    )

    await expect(request.get('/forbidden')).rejects.toMatchObject({ code: 403 })
  })

  it('请求自动携带 Authorization 头', async () => {
    localStorage.setItem('access_token', 'my-test-token')

    let receivedAuth = ''
    server.use(
      http.get('http://localhost/api/echo-auth', ({ request: req }) => {
        receivedAuth = req.headers.get('Authorization') || ''
        return HttpResponse.json({ code: 200, message: 'ok', data: true, timestamp: Date.now() })
      })
    )

    await request.get('/echo-auth')
    expect(receivedAuth).toBe('Bearer my-test-token')

    localStorage.removeItem('access_token')
  })

  it('请求自动携带 X-Request-Time 头', async () => {
    let receivedTime = ''
    server.use(
      http.get('http://localhost/api/echo-time', ({ request: req }) => {
        receivedTime = req.headers.get('X-Request-Time') || ''
        return HttpResponse.json({ code: 200, message: 'ok', data: true, timestamp: Date.now() })
      })
    )

    await request.get('/echo-time')
    expect(receivedTime).toBeTruthy()
    expect(Number(receivedTime)).toBeGreaterThan(0)
  })

  it('code 为 0 也视为成功', async () => {
    server.use(
      http.get('http://localhost/api/zero-code', () =>
        HttpResponse.json({ code: 0, message: 'success', data: { ok: true }, timestamp: Date.now() })
      )
    )

    const result = await request.get<{ ok: boolean }>('/zero-code')
    expect(result.ok).toBe(true)
  })
})
