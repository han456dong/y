/**
 * Pinia Store - 认证模块
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth'
import type { UserInfo, LoginParams } from '@/apis/modules/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<UserInfo | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const permissions = ref<string[]>([])
  const roles = ref<string[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // 计算属性
  const hasPermission = computed(() => (permission: string | string[]) => {
    if (!isAuthenticated.value) return false
    const perms = Array.isArray(permission) ? permission : [permission]
    return perms.some((p) => permissions.value.includes(p))
  })

  const hasRole = computed(() => (role: string | string[]) => {
    if (!isAuthenticated.value) return false
    const rolesArr = Array.isArray(role) ? role : [role]
    return rolesArr.some((r) => roles.value.includes(r))
  })

  const isAdmin = computed(() => hasRole.value(['admin', 'super_admin', 'administrator']))

  const userAvatar = computed(() => user.value?.avatar || '/default-avatar.png')
  const userName = computed(() => user.value?.full_name || user.value?.username || '未知用户')

  // Actions
  async function login(params: LoginParams) {
    loading.value = true
    error.value = null

    try {
      const response = await authService.login(params)
      if (response) {
        // 同步状态
        syncFromService()
      }
      return response
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout(redirect = true) {
    loading.value = true

    try {
      await authService.logout(redirect)
      // 同步状态（会重置为初始值）
      syncFromService()
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }

  async function fetchUserInfo() {
    if (!accessToken.value) return null

    loading.value = true
    error.value = null

    try {
      const userInfo = await authService.fetchUserInfo()
      if (userInfo) {
        syncFromService()
      }
      return userInfo
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  async function changePassword(data: { old_password: string; new_password: string; confirm_password: string }) {
    loading.value = true
    error.value = null

    try {
      const result = await authService.changePassword(data)
      return result
    } catch (err) {
      error.value = err as Error
      return false
    } finally {
      loading.value = false
    }
  }

  async function refreshAccessToken() {
    const result = await authService.refreshAccessToken()
    if (result) {
      syncFromService()
    }
    return result
  }

  // 从Service同步状态
  function syncFromService() {
    const state = authService.getState()
    user.value = state.user
    accessToken.value = state.accessToken
    refreshToken.value = state.refreshToken
    isAuthenticated.value = state.isAuthenticated
    permissions.value = state.permissions
    roles.value = state.roles
  }

  // 重置状态
  function reset() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    isAuthenticated.value = false
    permissions.value = []
    roles.value = []
    loading.value = false
    error.value = null
  }

  // 初始化（应用启动时调用）
  function initialize() {
    syncFromService()
  }

  return {
    // 状态
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    permissions,
    roles,
    loading,
    error,
    // 计算属性
    hasPermission,
    hasRole,
    isAdmin,
    userAvatar,
    userName,
    // Actions
    login,
    logout,
    fetchUserInfo,
    changePassword,
    refreshAccessToken,
    syncFromService,
    reset,
    initialize,
  }
})