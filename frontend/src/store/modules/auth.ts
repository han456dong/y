/**
 * Pinia Store - 认证模块
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth'
import type { LoginParams } from '@/apis/modules/auth'
import type { UserInfo } from '@/apis/modules/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<UserInfo | null>(null)
  const accessToken = ref<string | null>(null)
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

  const userName = computed(() => user.value?.username || '未知用户')
  const userEmail = computed(() => user.value?.email || '')

  // Actions
  async function login(params: LoginParams) {
    loading.value = true
    error.value = null

    try {
      const response = await authService.login(params)
      if (response) {
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

  // 从Service同步状态
  function syncFromService() {
    const state = authService.getState()
    user.value = state.user
    accessToken.value = state.accessToken
    isAuthenticated.value = state.isAuthenticated
    permissions.value = state.permissions
    roles.value = state.roles
  }

  // 重置状态
  function reset() {
    user.value = null
    accessToken.value = null
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
    isAuthenticated,
    permissions,
    roles,
    loading,
    error,
    // 计算属性
    hasPermission,
    hasRole,
    isAdmin,
    userName,
    userEmail,
    // Actions
    login,
    logout,
    fetchUserInfo,
    syncFromService,
    reset,
    initialize,
  }
})
