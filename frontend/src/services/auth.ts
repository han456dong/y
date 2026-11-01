/**
 * Service层 - 认证业务逻辑
 * 负责登录态、令牌与用户权限的编排（API 契约见 apis/modules/auth.ts）
 */

import { ref } from 'vue'
import router from '@/router'
import * as authApi from '@/apis/modules/auth'
import * as rbacApi from '@/apis/modules/rbac'
import type { LoginParams, LoginResponse, UserInfo } from '@/apis/modules/auth'

// 认证状态接口
export interface AuthState {
  user: UserInfo | null
  accessToken: string | null
  isAuthenticated: boolean
  permissions: string[]
  roles: string[]
}

// Token存储键
const TOKEN_KEY = 'access_token'
const USER_KEY = 'user_info'

/**
 * 从用户信息中推导权限码集合
 * 优先使用 user.permissions，否则聚合角色上的权限
 */
function resolvePermissions(user: UserInfo): string[] {
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return [...user.permissions]
  }
  return (user.roles || []).flatMap((role) => (role.permissions || []).map((p) => p.code))
}

class AuthService {
  private state: AuthState = {
    user: null,
    accessToken: null,
    isAuthenticated: false,
    permissions: [],
    roles: [],
  }

  // 公开的响应式引用
  public readonly user = ref<UserInfo | null>(null)
  public readonly accessToken = ref<string | null>(null)
  public readonly isAuthenticated = ref(false)
  public readonly permissions = ref<string[]>([])
  public readonly roles = ref<string[]>([])
  public readonly loading = ref(false)
  public readonly error = ref<Error | null>(null)

  constructor() {
    this.initFromStorage()
  }

  /** 从本地存储恢复登录态 */
  private initFromStorage(): void {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)

    if (!token) return

    this.state.accessToken = token
    this.accessToken.value = token
    this.state.isAuthenticated = true
    this.isAuthenticated.value = true

    if (userStr) {
      try {
        this.setUser(JSON.parse(userStr) as UserInfo)
      } catch {
        this.clearStorage()
        this.resetState()
      }
    }
  }

  /** 写入用户信息并同步权限/角色 */
  private setUser(user: UserInfo): void {
    const permissions = resolvePermissions(user)
    const roles = (user.roles || []).map((r) => r.code)

    this.state.user = user
    this.user.value = user
    this.state.permissions = permissions
    this.permissions.value = permissions
    this.state.roles = roles
    this.roles.value = roles

    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }

  /** 写入令牌 */
  private setToken(accessToken: string): void {
    this.state.accessToken = accessToken
    this.accessToken.value = accessToken
    this.state.isAuthenticated = true
    this.isAuthenticated.value = true
    localStorage.setItem(TOKEN_KEY, accessToken)
  }

  /** 清理本地存储 */
  private clearStorage(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  /** 重置内存状态 */
  private resetState(): void {
    this.state = {
      user: null,
      accessToken: null,
      isAuthenticated: false,
      permissions: [],
      roles: [],
    }
    this.user.value = null
    this.accessToken.value = null
    this.isAuthenticated.value = false
    this.permissions.value = []
    this.roles.value = []
  }

  /** 用户登录 */
  async login(params: LoginParams): Promise<LoginResponse | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const response = await authApi.loginApi(params)
      this.setToken(response.access_token)
      this.setUser(response.user as UserInfo)
      return response
    } catch (err) {
      this.error.value = err as Error
      throw err
    } finally {
      this.loading.value = false
    }
  }

  /** 用户登出（后端未提供登出接口，清理本地登录态即可） */
  async logout(redirect = true): Promise<void> {
    this.loading.value = true
    try {
      this.clearStorage()
      this.resetState()
    } finally {
      this.loading.value = false
      if (redirect) {
        await router.push('/login')
      }
    }
  }

  /** 获取当前登录用户信息 */
  async fetchUserInfo(): Promise<UserInfo | null> {
    if (!this.state.accessToken) return null

    this.loading.value = true
    this.error.value = null

    try {
      const user = await rbacApi.getCurrentUserApi()
      const normalized: UserInfo = {
        ...user,
        permissions: this.state.permissions.length ? this.state.permissions : [],
      }
      this.setUser(normalized)
      return normalized
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 检查权限（任一命中即通过） */
  hasPermission(permission: string | string[]): boolean {
    if (!this.state.isAuthenticated) return false
    const perms = Array.isArray(permission) ? permission : [permission]
    return perms.some((p) => this.state.permissions.includes(p))
  }

  /** 检查角色（任一命中即通过） */
  hasRole(role: string | string[]): boolean {
    if (!this.state.isAuthenticated) return false
    const roles = Array.isArray(role) ? role : [role]
    return roles.some((r) => this.state.roles.includes(r))
  }

  /** 是否管理员 */
  get isAdmin(): boolean {
    return this.hasRole(['admin', 'super_admin', 'administrator'])
  }

  /** 重置服务状态（用于测试与登出） */
  reset(): void {
    this.clearStorage()
    this.resetState()
  }

  /** 获取完整状态快照 */
  getState(): AuthState {
    return { ...this.state }
  }
}

// 导出单例
export const authService = new AuthService()
export default authService
