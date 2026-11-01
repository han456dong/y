/**
 * Pinia Store - 认证模块
 * 权限判断委托给 permissionStore（PRD 8.1 分离）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '@/services/auth'
import { usePermissionStore } from './permission'
import type { LoginParams } from '@/apis/modules/auth'
import type { User } from '@/apis/modules/rbac'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const roles = ref<string[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const isSuperuser = computed(() => Boolean(user.value?.is_superuser))
  const userName = computed(() => user.value?.username || '未知用户')
  const userEmail = computed(() => user.value?.email || '')
  const userRoleNames = computed(() => (user.value?.roles || []).map((r) => r.name))

  /** 权限检查委托给权限 Store（超管直通） */
  function hasPermission(permission: string | string[]): boolean {
    const permissionStore = usePermissionStore()
    const codes = Array.isArray(permission) ? permission : [permission]
    return permissionStore.hasAny(codes)
  }

  function hasRole(role: string | string[]): boolean {
    if (!isAuthenticated.value) return false
    const rolesArr = Array.isArray(role) ? role : [role]
    return rolesArr.some((r) => roles.value.includes(r))
  }

  async function login(params: LoginParams) {
    loading.value = true
    error.value = null
    try {
      const response = await authService.login(params)
      syncFromService()
      if (response) {
        await usePermissionStore().refreshPermissions(true)
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
      usePermissionStore().clearPermissions()
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
      if (userInfo) syncFromService()
      return userInfo
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  function syncFromService() {
    const state = authService.getState()
    user.value = state.user
    accessToken.value = state.accessToken
    isAuthenticated.value = state.isAuthenticated
    roles.value = state.roles
  }

  function reset() {
    user.value = null
    accessToken.value = null
    isAuthenticated.value = false
    roles.value = []
    loading.value = false
    error.value = null
    usePermissionStore().clearPermissions()
  }

  function initialize() {
    syncFromService()
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    roles,
    loading,
    error,
    isSuperuser,
    userName,
    userEmail,
    userRoleNames,
    hasPermission,
    hasRole,
    login,
    logout,
    fetchUserInfo,
    syncFromService,
    reset,
    initialize,
  }
})
