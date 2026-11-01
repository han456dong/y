/**
 * API模块 - 认证与验证码
 * 接口契约对齐 docs/openapi.json：/api/v1/auth/login、/api/v1/captcha
 */

import { request } from '../index'
import type { Role, UserWithRoles } from './rbac'

/* ============================================================
 * 数据类型
 * ============================================================ */

export interface LoginParams {
  username: string
  password: string
  /** 验证码 key（后端必填） */
  captcha_key: string
  /** 验证码内容（后端必填） */
  captcha_code: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

/** 登录响应中携带权限码的用户信息 */
export interface LoginUser extends UserWithRoles {
  permissions?: string[]
}

/** 登录响应（后端 TokenResponse + 前端附加的用户信息） */
export interface LoginResponse extends TokenResponse {
  refresh_token?: string
  expires_in?: number
  user: LoginUser
}

export interface CaptchaRead {
  key: string
  image: string
}

export interface CaptchaVerifyParams {
  key: string
  code: string
}

/** 前端用户信息（含角色权限） */
export interface UserInfo extends UserWithRoles {
  roles: Role[]
  permissions: string[]
}

/* ============================================================
 * 认证接口
 * ============================================================ */

/** POST /api/v1/auth/login —— 用户登录 */
export function loginApi(params: LoginParams): Promise<LoginResponse> {
  return request.post('/v1/auth/login', params)
}

/* ============================================================
 * 验证码接口
 * ============================================================ */

/** GET /api/v1/captcha —— 获取验证码 */
export function getCaptchaApi(): Promise<CaptchaRead> {
  return request.get('/v1/captcha')
}

/** POST /api/v1/captcha —— 验证验证码 */
export function verifyCaptchaApi(params: CaptchaVerifyParams): Promise<boolean> {
  return request.post('/v1/captcha', params)
}
