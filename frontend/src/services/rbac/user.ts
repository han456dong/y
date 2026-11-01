/**
 * Service层 - RBAC 用户管理业务逻辑（V2）
 */

import { ref } from 'vue'
import { RbacListService } from './base'
import * as rbacApi from '@/apis/modules/rbac'
import type { User, UserWithRoles, RoleLite, UserCreateParams, UserUpdateParams } from '@/apis/modules/rbac'

export class RbacUserService extends RbacListService<User> {
  public readonly detail = ref<UserWithRoles | null>(null)
  public readonly userRoles = ref<RoleLite[]>([])

  constructor() {
    super((params) => rbacApi.searchUsersApi(params))
  }

  /** 全部用户（概览统计/导出） */
  async listAll(limit = 200): Promise<User[]> {
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

  /** 更新用户（邮箱 / 启停） */
  async updateUser(userId: number, data: UserUpdateParams): Promise<User | null> {
    this.loading.value = true
    this.error.value = null
    try {
      const user = await rbacApi.updateUserApi(userId, data)
      this.items.value = this.items.value.map((u) => (u.id === userId ? { ...u, ...user } : u))
      if (this.detail.value?.id === userId) {
        this.detail.value = { ...this.detail.value, ...user }
      }
      return user
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 启用/禁用用户 */
  async toggleActive(userId: number, isActive: boolean): Promise<User | null> {
    return this.updateUser(userId, { is_active: isActive })
  }

  /** 删除用户 */
  async deleteUser(userId: number): Promise<boolean> {
    this.loading.value = true
    this.error.value = null
    try {
      await rbacApi.deleteUserApi(userId)
      this.items.value = this.items.value.filter((u) => u.id !== userId)
      this.pagination.value.total = Math.max(0, this.pagination.value.total - 1)
      if (this.detail.value?.id === userId) this.detail.value = null
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
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

  /** 用户角色列表（精简） */
  async fetchUserRoles(userId: number): Promise<RoleLite[]> {
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
      this.items.value = this.items.value.map((u) =>
        u.id === userId ? { ...u, roles: user.roles, is_superuser: user.is_superuser } : u
      )
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
