/**
 * API模块 - 认证与验证码
 * 契约：POST /api/v1/auth/login、GET/POST /api/v1/captcha
 */

import { request } from '../index'
import type { User } from './rbac'

export interface LoginParams {
  username: string
  password: string
  captcha_key: string
  captcha_code: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

/** 登录响应：TokenResponse + 前端附加的用户信息（JWT 不携带权限码，PRD D6） */
export interface LoginResponse extends TokenResponse {
  refresh_token?: string
  expires_in?: number
  user: User
}

export interface CaptchaRead {
  key: string
  image: string
}

export interface CaptchaVerifyParams {
  key: string
  code: string
}

/** POST /api/v1/auth/login */
export function loginApi(params: LoginParams): Promise<LoginResponse> {
  return request.post('/v1/auth/login', params)
}

/** GET /api/v1/captcha */
export function getCaptchaApi(): Promise<CaptchaRead> {
  return request.get('/v1/captcha')
}

/** POST /api/v1/captcha */
export function verifyCaptchaApi(params: CaptchaVerifyParams): Promise<boolean> {
  return request.post('/v1/captcha', params)
}
