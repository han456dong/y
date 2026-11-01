/**
 * Service层 - RBAC 用户管理业务逻辑
 */

import { ref } from 'vue'
import { RbacListService } from './base'
import * as rbacApi from '@/apis/modules/rbac'
import type { User, UserWithRoles, UserListItem, Role, UserCreateParams } from '@/apis/modules/rbac'

export class RbacUserService extends RbacListService<UserListItem> {
  /** 当前查看的用户详情（含角色） */
  public readonly detail = ref<UserWithRoles | null>(null)
  /** 用户当前角色 */
  public readonly userRoles = ref<Role[]>([])

  constructor() {
    super((params) => rbacApi.searchUsersApi(params))
  }

  /** 获取列表（offset / limit 版本，用于概览统计） */
  async listAll(limit = 100): Promise<UserListItem[]> {
    this.loading.value = true
    this.error.value = null
    try {
      return await rbacApi.getUsersApi({ offset: 0, limit })
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.loading.value = false
    }
  }

  /** 创建用户 */
  async createUser(data: UserCreateParams): Promise<User | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const user = await rbacApi.createUserApi(data)
      if (this.pagination.value.page === 1) {
        this.items.value = [user, ...this.items.value]
        this.pagination.value.total += 1
      }
      return user
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 用户详情 */
  async fetchDetail(userId: number): Promise<UserWithRoles | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const detail = await rbacApi.getUserApi(userId)
      this.detail.value = detail
      return detail
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 用户角色列表 */
  async fetchUserRoles(userId: number): Promise<Role[]> {
    this.loading.value = true
    this.error.value = null
    try {
      const roles = await rbacApi.getUserRolesApi(userId)
      this.userRoles.value = roles
      return roles
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.loading.value = false
    }
  }

  /** 分配用户角色 */
  async assignRoles(userId: number, roleIds: number[]): Promise<UserWithRoles | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const user = await rbacApi.assignUserRolesApi(userId, { role_ids: roleIds })
      this.detail.value = user
      // 同步列表中的角色列
      const index = this.items.value.findIndex((u) => u.id === userId)
      if (index !== -1) {
        this.items.value = this.items.value.map((u, i) =>
          i === index ? ({ ...u, roles: user.roles } as User) : u
        )
      }
      return user
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  reset(): void {
    super.reset()
    this.detail.value = null
    this.userRoles.value = []
  }
}

export const rbacUserService = new RbacUserService()
export default rbacUserService
