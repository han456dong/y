/**
 * API模块 - 认证相关接口
 */

import { request } from '../index'

// 登录请求参数
export interface LoginParams {
  username: string
  password: string
  captcha?: string
  captcha_id?: string
  remember_me?: boolean
}

// 登录响应数据
export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: UserInfo
}

// 用户信息
export interface UserInfo {
  id: number
  username: string
  email: string
  full_name: string
  avatar?: string
  roles: RoleInfo[]
  permissions: string[]
  is_active: boolean
  last_login_at?: string
  created_at: string
}

// 角色信息
export interface RoleInfo {
  id: number
  name: string
  code: string
  description?: string
}

// 刷新Token响应
export interface RefreshTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * 用户登录
 */
export function loginApi(params: LoginParams): Promise<LoginResponse> {
  return request.post('/auth/login', params)
}

/**
 * 用户登出
 */
export function logoutApi(): Promise<void> {
  return request.post('/auth/logout')
}

/**
 * 刷新Access Token
 */
export function refreshTokenApi(refreshToken: string): Promise<RefreshTokenResponse> {
  return request.post('/auth/refresh', { refresh_token: refreshToken })
}

/**
 * 获取当前用户信息
 */
export function getCurrentUserApi(): Promise<UserInfo> {
  return request.get('/auth/me')
}

/**
 * 修改密码
 */
export function changePasswordApi(data: {
  old_password: string
  new_password: string
  confirm_password: string
}): Promise<void> {
  return request.post('/auth/password/change', data)
}

/**
 * 获取验证码
 */
export function getCaptchaApi(): Promise<{ captcha_id: string; image: string }> {
  return request.get('/auth/captcha')
}

/**
 * 发送邮箱验证码
 */
export function sendEmailCodeApi(email: string, type: 'register' | 'reset_password' | 'bind_email'): Promise<void> {
  return request.post('/auth/email/code', { email, type })
}