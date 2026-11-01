/**
 * Service层 - 认证业务逻辑
 * 仅负责登录态与用户信息；权限由 permissionStore 通过 /users/me/permissions 独立维护（PRD D6/D12）
 */

import { ref } from 'vue'
import router from '@/router'
import * as authApi from '@/apis/modules/auth'
import * as rbacApi from '@/apis/modules/rbac'
import type { LoginParams, LoginResponse } from '@/apis/modules/auth'
import type { User } from '@/apis/modules/rbac'

const TOKEN_KEY = 'access_token'

export interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  roles: string[]
}

class AuthService {
  private state: AuthState = {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    roles: [],
  }

  public readonly user = ref<User | null>(null)
  public readonly accessToken = ref<string | null>(null)
  public readonly isAuthenticated = ref(false)
  public readonly roles = ref<string[]>([])
  public readonly loading = ref(false)
  public readonly error = ref<Error | null>(null)

  constructor() {
    this.restoreToken()
  }

  /** 仅恢复 Token，用户信息与权限启动后重新拉取 */
  private restoreToken(): void {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    this.state.accessToken = token
    this.accessToken.value = token
    this.state.isAuthenticated = true
    this.isAuthenticated.value = true
  }

  private setToken(token: string): void {
    this.state.accessToken = token
    this.accessToken.value = token
    this.state.isAuthenticated = true
    this.isAuthenticated.value = true
    localStorage.setItem(TOKEN_KEY, token)
  }

  private setUser(user: User | null): void {
    this.state.user = user
    this.user.value = user
    this.state.roles = (user?.roles || []).map((r) => r.code)
    this.roles.value = this.state.roles
  }

  private resetState(): void {
    this.state = { user: null, accessToken: null, isAuthenticated: false, roles: [] }
    this.user.value = null
    this.accessToken.value = null
    this.isAuthenticated.value = false
    this.roles.value = []
  }

  /** 登录 */
  async login(params: LoginParams): Promise<LoginResponse | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const response = await authApi.loginApi(params)
      this.setToken(response.access_token)
      this.setUser(response.user)
      return response
    } catch (err) {
      this.error.value = err as Error
      throw err
    } finally {
      this.loading.value = false
    }
  }

  /** 登出（前端清 Token，PRD 7.2.4：服务端黑名单非本期） */
  async logout(redirect = true): Promise<void> {
    this.loading.value = true
    try {
      localStorage.removeItem(TOKEN_KEY)
      this.resetState()
    } finally {
      this.loading.value = false
      if (redirect) {
        await router.push('/login')
      }
    }
  }

  /** 拉取当前用户信息（不包含权限码） */
  async fetchUserInfo(): Promise<User | null> {
    if (!this.state.accessToken) return null
    this.loading.value = true
    this.error.value = null
    try {
      const user = await rbacApi.getCurrentUserApi()
      this.setUser(user)
      return user
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 是否拥有角色 */
  hasRole(role: string | string[]): boolean {
    if (!this.state.isAuthenticated) return false
    const roles = Array.isArray(role) ? role : [role]
    return roles.some((r) => this.state.roles.includes(r))
  }

  /** 是否超级管理员 */
  get isSuperuser(): boolean {
    return Boolean(this.state.user?.is_superuser)
  }

  /** 重置（测试/登出） */
  reset(): void {
    localStorage.removeItem(TOKEN_KEY)
    this.resetState()
  }

  getState(): AuthState {
    return { ...this.state }
  }
}

export const authService = new AuthService()
export default authService
