/**
 * 测试辅助工具
 */

import * as authApi from '@/apis/modules/auth'
import { getMockCaptchaCode } from '@/mocks/data'

/** 获取验证码 key 与明文 code */
export async function fetchCaptcha() {
  const captcha = await authApi.getCaptchaApi()
  const code = getMockCaptchaCode(captcha.key)
  if (!code) throw new Error('mock captcha code not found')
  return { key: captcha.key, code }
}

/** 登录参数（自动附带当前验证码） */
export async function loginParams(username = 'admin', password = '123456') {
  const { key, code } = await fetchCaptcha()
  return { username, password, captcha_key: key, captcha_code: code }
}

/** 直接调用登录 API */
export async function apiLogin(username = 'admin', password = '123456') {
  return authApi.loginApi(await loginParams(username, password))
}
