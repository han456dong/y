/**
 * Pinia Store - RBAC 共享状态
 * 缓存角色/权限选项与概览统计，避免多页面重复请求
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { rbacRoleService, rbacPermissionService } from '@/services/rbac'
import * as rbacApi from '@/apis/modules/rbac'
import type { Role, Permission } from '@/apis/modules/rbac'

export interface RbacStats {
  users: number
  roles: number
  permissions: number
  activeUsers: number
}

export const useRbacStore = defineStore('rbac', () => {
  // 选项缓存
  const roleOptions = ref<Role[]>([])
  const permissionOptions = ref<Permission[]>([])
  const roleOptionsLoading = ref(false)
  const permissionOptionsLoading = ref(false)

  // 概览统计
  const stats = ref<RbacStats>({ users: 0, roles: 0, permissions: 0, activeUsers: 0 })
  const statsLoading = ref(false)

  // 计算属性
  const roleMap = computed(() => {
    const map = new Map<number, Role>()
    roleOptions.value.forEach((role) => map.set(role.id, role))
    return map
  })

  const permissionMap = computed(() => {
    const map = new Map<number, Permission>()
    permissionOptions.value.forEach((permission) => map.set(permission.id, permission))
    return map
  })

  /** 加载角色选项（带缓存） */
  async function loadRoleOptions(force = false): Promise<Role[]> {
    if (!force && roleOptions.value.length > 0) return roleOptions.value
    if (roleOptionsLoading.value) return roleOptions.value

    roleOptionsLoading.value = true
    try {
      roleOptions.value = await rbacRoleService.listAll()
      return roleOptions.value
    } finally {
      roleOptionsLoading.value = false
    }
  }

  /** 加载权限选项（带缓存） */
  async function loadPermissionOptions(force = false): Promise<Permission[]> {
    if (!force && permissionOptions.value.length > 0) return permissionOptions.value
    if (permissionOptionsLoading.value) return permissionOptions.value

    permissionOptionsLoading.value = true
    try {
      permissionOptions.value = await rbacPermissionService.listAll()
      return permissionOptions.value
    } finally {
      permissionOptionsLoading.value = false
    }
  }

  /** 加载概览统计（直接调用 API，避免污染列表服务状态） */
  async function loadStats(): Promise<RbacStats> {
    statsLoading.value = true
    try {
      const [usersResult, rolesResult, permissionsResult, allUsers] = await Promise.all([
        rbacApi.searchUsersApi({ page: 1, page_size: 1 }),
        rbacApi.searchRolesApi({ page: 1, page_size: 1 }),
        rbacApi.searchPermissionsApi({ page: 1, page_size: 1 }),
        rbacApi.getUsersApi({ offset: 0, limit: 200 }),
      ])

      stats.value = {
        users: usersResult.total,
        roles: rolesResult.total,
        permissions: permissionsResult.total,
        activeUsers: allUsers.filter((u) => u.is_active).length,
      }
      return stats.value
    } finally {
      statsLoading.value = false
    }
  }

  /** 清空缓存（权限变更后调用） */
  function invalidate(scope: 'roles' | 'permissions' | 'all' = 'all'): void {
    if (scope === 'roles' || scope === 'all') roleOptions.value = []
    if (scope === 'permissions' || scope === 'all') permissionOptions.value = []
  }

  /** 重置 */
  function reset(): void {
    roleOptions.value = []
    permissionOptions.value = []
    stats.value = { users: 0, roles: 0, permissions: 0, activeUsers: 0 }
    roleOptionsLoading.value = false
    permissionOptionsLoading.value = false
    statsLoading.value = false
  }

  return {
    roleOptions,
    permissionOptions,
    roleOptionsLoading,
    permissionOptionsLoading,
    stats,
    statsLoading,
    roleMap,
    permissionMap,
    loadRoleOptions,
    loadPermissionOptions,
    loadStats,
    invalidate,
    reset,
  }
})
