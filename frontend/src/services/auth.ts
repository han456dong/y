/**
 * Service层 - 认证业务逻辑
 */

import { ref, computed } from 'vue'
import router from '@/router'
import * as authApi from '@/apis/modules/auth'
import type { UserInfo, LoginParams, LoginResponse, RefreshTokenResponse } from '@/apis/modules/auth'
import type { ServiceState } from './base'

// 认证状态接口
export interface AuthState {
  user: UserInfo | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  permissions: string[]
  roles: string[]
}

// Token存储键
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user_info'

class AuthService {
  // 响应式状态
  private state: AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    permissions: [],
    roles: [],
  }

  // 公开的响应式引用
  public readonly user = ref<UserInfo | null>(null)
  public readonly accessToken = ref<string | null>(null)
  public readonly refreshToken = ref<string | null>(null)
  public readonly isAuthenticated = ref(false)
  public readonly permissions = ref<string[]>([])
  public readonly roles = ref<string[]>([])

  // 加载状态
  public readonly loading = ref(false)
  public readonly error = ref<Error | null>(null)

  constructor() {
    this.initFromStorage()
  }

  /**
   * 从本地存储初始化状态
   */
  private initFromStorage(): void {
    const token = localStorage.getItem(TOKEN_KEY)
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (token && refreshToken) {
      this.state.accessToken = token
      this.state.refreshToken = refreshToken
      this.accessToken.value = token
      this.refreshToken.value = refreshToken

      if (userStr) {
        try {
          const user = JSON.parse(userStr) as UserInfo
          this.setUser(user)
        } catch {
          // 解析失败，清理存储
          this.clearStorage()
        }
      }

      this.state.isAuthenticated = true
      this.isAuthenticated.value = true
    }
  }

  /**
   * 设置用户信息
   */
  private setUser(user: UserInfo): void {
    this.state.user = user
    this.user.value = user
    this.state.permissions = user.permissions || []
    this.permissions.value = user.permissions || []
    this.state.roles = user.roles?.map((r) => r.code) || []
    this.roles.value = user.roles?.map((r) => r.code) || []

    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  /**
   * 设置Token
   */
  private setTokens(accessToken: string, refreshToken: string): void {
    this.state.accessToken = accessToken
    this.state.refreshToken = refreshToken
    this.accessToken.value = accessToken
    this.refreshToken.value = refreshToken
    this.state.isAuthenticated = true
    this.isAuthenticated.value = true

    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  /**
   * 清理存储
   */
  private clearStorage(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  /**
   * 重置状态
   */
  private resetState(): void {
    this.state = {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      permissions: [],
      roles: [],
    }
    this.user.value = null
    this.accessToken.value = null
    this.refreshToken.value = null
    this.isAuthenticated.value = false
    this.permissions.value = []
    this.roles.value = []
  }

  /**
   * 用户登录
   */
  async login(params: LoginParams): Promise<LoginResponse | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const response = await authApi.loginApi(params)
      this.setTokens(response.access_token, response.refresh_token)
      this.setUser(response.user)
      return response
    } catch (err) {
      this.error.value = err as Error
      throw err
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 用户登出
   */
  async logout(redirect = true): Promise<void> {
    this.loading.value = true

    try {
      // 调用后端登出接口
      if (this.state.accessToken) {
        await authApi.logoutApi()
      }
    } catch {
      // 忽略登出接口错误
    } finally {
      this.clearStorage()
      this.resetState()
      this.loading.value = false

      if (redirect) {
        await router.push('/login')
      }
    }
  }

  /**
   * 刷新Token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.state.refreshToken) {
      return false
    }

    try {
      const response = await authApi.refreshTokenApi(this.state.refreshToken)
      this.setTokens(response.access_token, this.state.refreshToken)
      return true
    } catch {
      // 刷新失败，登出
      await this.logout()
      return false
    }
  }

  /**
   * 获取当前用户信息
   */
  async fetchUserInfo(): Promise<UserInfo | null> {
    if (!this.state.accessToken) {
      return null
    }

    this.loading.value = true
    this.error.value = null

    try {
      const user = await authApi.getCurrentUserApi()
      this.setUser(user)
      return user
    } catch (err) {
      this.error.value = err as Error
      // 如果是401，尝试刷新Token
      if ((err as { code?: number }).code === 401) {
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          return this.fetchUserInfo()
        }
      }
      return null
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 修改密码
   */
  async changePassword(data: {
    old_password: string
    new_password: string
    confirm_password: string
  }): Promise<boolean> {
    this.loading.value = true
    this.error.value = null

    try {
      await authApi.changePasswordApi(data)
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 检查权限
   */
  hasPermission(permission: string | string[]): boolean {
    if (!this.state.isAuthenticated) return false
    const perms = Array.isArray(permission) ? permission : [permission]
    return perms.some((p) => this.state.permissions.includes(p))
  }

  /**
   * 检查角色
   */
  hasRole(role: string | string[]): boolean {
    if (!this.state.isAuthenticated) return false
    const roles = Array.isArray(role) ? role : [role]
    return roles.some((r) => this.state.roles.includes(r))
  }

  /**
   * 检查是否为管理员
   */
  get isAdmin(): boolean {
    return this.hasRole(['admin', 'super_admin', 'administrator'])
  }

  /**
   * 重置服务状态（用于测试）
   */
  reset(): void {
    this.clearStorage()
    this.resetState()
  }

  /**
   * 获取完整状态快照
   */
  getState(): AuthState {
    return { ...this.state }
  }

  /**
   * 获取服务状态（用于调试）
   */
  getServiceState(): ServiceState<AuthState> {
    return {
      data: this.state,
      loading: this.loading.value,
      error: this.error.value,
    }
  }
}

// 导出单例
export const authService = new AuthService()
export default authService