/**
 * Service层 - RBAC 权限管理业务逻辑
 */

import { ref, computed } from 'vue'
import { RbacListService } from './base'
import * as rbacApi from '@/apis/modules/rbac'
import type {
  Permission,
  PermissionCreateParams,
  PermissionUpdateParams,
  PermissionTreeGroup,
  PageQuery,
} from '@/apis/modules/rbac'

/** 权限查询参数（支持模块筛选） */
export interface PermissionQuery extends PageQuery {
  module?: string
}

export class RbacPermissionService extends RbacListService<Permission, PermissionQuery> {
  /** 当前查看的权限详情 */
  public readonly detail = ref<Permission | null>(null)
  /** 权限树（按模块分组） */
  public readonly tree = ref<PermissionTreeGroup[]>([])
  public readonly treeLoading = ref(false)

  constructor() {
    super((params) => rbacApi.searchPermissionsApi(params))
  }

  /** 权限树（PRD 7.2.2） */
  async fetchTree(): Promise<PermissionTreeGroup[]> {
    this.treeLoading.value = true
    this.error.value = null
    try {
      this.tree.value = await rbacApi.getPermissionTreeApi()
      return this.tree.value
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.treeLoading.value = false
    }
  }

  /** 全部权限（用于角色授权） */
  async listAll(): Promise<Permission[]> {
    this.loading.value = true
    this.error.value = null
    try {
      return await rbacApi.getPermissionsApi()
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.loading.value = false
    }
  }

  /** 创建权限 */
  async createPermission(data: PermissionCreateParams): Promise<Permission | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const permission = await rbacApi.createPermissionApi(data)
      if (this.pagination.value.page === 1) {
        this.items.value = [permission, ...this.items.value]
        this.pagination.value.total += 1
      }
      return permission
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 权限详情 */
  async fetchDetail(permissionId: number): Promise<Permission | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const permission = await rbacApi.getPermissionApi(permissionId)
      this.detail.value = permission
      return permission
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 更新权限 */
  async updatePermission(permissionId: number, data: PermissionUpdateParams): Promise<Permission | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const permission = await rbacApi.updatePermissionApi(permissionId, data)
      this.items.value = this.items.value.map((p) => (p.id === permissionId ? permission : p))
      if (this.detail.value?.id === permissionId) this.detail.value = permission
      return permission
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 删除权限 */
  async deletePermission(permissionId: number): Promise<boolean> {
    this.loading.value = true
    this.error.value = null
    try {
      await rbacApi.deletePermissionApi(permissionId)
      this.items.value = this.items.value.filter((p) => p.id !== permissionId)
      this.pagination.value.total = Math.max(0, this.pagination.value.total - 1)
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
    } finally {
      this.loading.value = false
    }
  }

  /** 当前页权限按模块分组 */
  readonly moduleGroups = computed(() => {
    return this.items.value.reduce<Record<string, Permission[]>>((groups, permission) => {
      const module = permission.module || rbacApi.getPermissionModule(permission.code)
      if (!groups[module]) groups[module] = []
      groups[module].push(permission)
      return groups
    }, {})
  })

  /** 当前页模块统计 */
  readonly moduleStats = computed(() =>
    Object.entries(this.moduleGroups.value).map(([module, permissions]) => ({
      module,
      module_name: permissions[0]?.module || module,
      count: permissions.length,
    }))
  )
}

export const rbacPermissionService = new RbacPermissionService()
export default rbacPermissionService
