/**
 * Service层 - RBAC 角色管理业务逻辑
 */

import { ref } from 'vue'
import { RbacListService } from './base'
import * as rbacApi from '@/apis/modules/rbac'
import type { Role, RoleCreateParams, RoleUpdateParams, Permission } from '@/apis/modules/rbac'

export class RbacRoleService extends RbacListService<Role> {
  /** 当前查看的角色详情 */
  public readonly detail = ref<Role | null>(null)

  constructor() {
    super((params) => rbacApi.searchRolesApi(params))
  }

  /** 全部角色（用于下拉选择） */
  async listAll(): Promise<Role[]> {
    this.loading.value = true
    this.error.value = null
    try {
      return await rbacApi.getRolesApi()
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.loading.value = false
    }
  }

  /** 创建角色 */
  async createRole(data: RoleCreateParams): Promise<Role | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const role = await rbacApi.createRoleApi(data)
      if (this.pagination.value.page === 1) {
        this.items.value = [role, ...this.items.value]
        this.pagination.value.total += 1
      }
      return role
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 角色详情 */
  async fetchDetail(roleId: number): Promise<Role | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const role = await rbacApi.getRoleApi(roleId)
      this.detail.value = role
      return role
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 更新角色 */
  async updateRole(roleId: number, data: RoleUpdateParams): Promise<Role | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const role = await rbacApi.updateRoleApi(roleId, data)
      this.items.value = this.items.value.map((r) => (r.id === roleId ? role : r))
      if (this.detail.value?.id === roleId) this.detail.value = role
      return role
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 删除角色 */
  async deleteRole(roleId: number): Promise<boolean> {
    this.loading.value = true
    this.error.value = null
    try {
      await rbacApi.deleteRoleApi(roleId)
      this.items.value = this.items.value.filter((r) => r.id !== roleId)
      this.pagination.value.total = Math.max(0, this.pagination.value.total - 1)
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
    } finally {
      this.loading.value = false
    }
  }

  /** 分配角色权限 */
  async assignPermissions(roleId: number, permissionIds: number[]): Promise<Role | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const role = await rbacApi.assignRolePermissionsApi(roleId, { permission_ids: permissionIds })
      this.items.value = this.items.value.map((r) => (r.id === roleId ? role : r))
      if (this.detail.value?.id === roleId) this.detail.value = role
      return role
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 按模块分组角色权限（用于权限分配弹窗） */
  static groupPermissionsByModule(permissions: Permission[]): Record<string, Permission[]> {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      const module = permission.module || rbacApi.getPermissionModule(permission.code)
      if (!groups[module]) groups[module] = []
      groups[module].push(permission)
      return groups
    }, {})
  }
}

export const rbacRoleService = new RbacRoleService()
export default rbacRoleService
