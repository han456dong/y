/**
 * Pinia Store - 权限状态（PRD 8.1）
 * 全应用共享一份当前用户权限；权限仅存内存，不写入 localStorage（D12）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as rbacApi from '@/apis/modules/rbac'
import type { RoleLite } from '@/apis/modules/rbac'

export const usePermissionStore = defineStore('permission', () => {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const permissions = ref<Set<string>>(new Set())
  const isSuperuser = ref(false)
  const roles = ref<RoleLite[]>([])
  const permissionVersion = ref(0)
  const cachedAt = ref<string | null>(null)
  /** 是否已成功加载过（用于路由守卫判断） */
  const loaded = ref(false)

  const permissionList = computed(() => [...permissions.value].sort())

  /** 是否拥有某个权限（超管直通） */
  function has(code: string): boolean {
    return isSuperuser.value || permissions.value.has(code)
  }

  /** 满足其一 */
  function hasAny(codes: string[]): boolean {
    if (!codes.length) return true
    if (isSuperuser.value) return true
    return codes.some((code) => permissions.value.has(code))
  }

  /** 满足全部 */
  function hasAll(codes: string[]): boolean {
    if (!codes.length) return true
    if (isSuperuser.value) return true
    return codes.every((code) => permissions.value.has(code))
  }

  /** 拉取当前用户权限（PRD 7.2.1） */
  async function refreshPermissions(force = false): Promise<boolean> {
    if (loading.value) return loaded.value
    if (loaded.value && !force) return true

    loading.value = true
    error.value = null
    try {
      const context = await rbacApi.getMyPermissionsApi()
      permissions.value = new Set(context.permissions)
      isSuperuser.value = context.is_superuser
      roles.value = context.roles
      permissionVersion.value = context.permission_version
      cachedAt.value = context.cached_at
      loaded.value = true
      return true
    } catch (err) {
      error.value = err as Error
      // 权限加载失败时清空，绝不放行（PRD Review Focus 5）
      permissions.value = new Set()
      isSuperuser.value = false
      roles.value = []
      loaded.value = false
      return false
    } finally {
      loading.value = false
    }
  }

  /** 清空权限（退出登录 / 401） */
  function clearPermissions(): void {
    permissions.value = new Set()
    isSuperuser.value = false
    roles.value = []
    permissionVersion.value = 0
    cachedAt.value = null
    loaded.value = false
    error.value = null
  }

  return {
    loading,
    error,
    permissions,
    permissionList,
    isSuperuser,
    roles,
    permissionVersion,
    cachedAt,
    loaded,
    has,
    hasAny,
    hasAll,
    refreshPermissions,
    clearPermissions,
  }
})
