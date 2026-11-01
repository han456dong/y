/**
 * Service层 - 用户管理业务逻辑
 */

import { BaseService } from './base'
import * as userApi from '@/apis/modules/user'
import type { UserInfo, UserQueryParams, UserListResponse, CreateUserParams, UpdateUserParams, ResetPasswordParams, RoleInfo } from '@/apis/modules/user'

// 用户服务配置
const userServiceConfig = {
  api: {
    list: (params: UserQueryParams) => userApi.getUserListApi(params),
    get: (id: number | string) => userApi.getUserDetailApi(Number(id)),
    create: (data: Partial<UserInfo>) => userApi.createUserApi(data as CreateUserParams),
    update: (id: number | string, data: Partial<UserInfo>) => userApi.updateUserApi(Number(id), data as UpdateUserParams),
    delete: (id: number | string) => userApi.deleteUserApi(Number(id)),
    batchDelete: (ids: (number | string)[]) => userApi.batchDeleteUsersApi(ids.map(Number)),
  },
  cacheKey: 'users',
  autoLoad: false,
  defaultPageParams: {
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    sort_order: 'desc' as const,
  },
} as const

/**
 * 用户服务类
 * 继承BaseService，扩展用户特有的业务逻辑
 */
export class UserService extends BaseService<UserInfo, UserQueryParams> {
  // 角色选项缓存
  private roleOptionsCache: RoleInfo[] | null = null
  private roleOptionsLoading = false

  constructor() {
    super(userServiceConfig)
  }

  /**
   * 重置用户密码
   */
  async resetPassword(id: number, data: ResetPasswordParams): Promise<boolean> {
    this.loading.value = true
    this.error.value = null

    try {
      await userApi.resetUserPasswordApi(id, data)
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 切换用户状态（启用/禁用）
   */
  async toggleStatus(id: number, status: number): Promise<boolean> {
    this.loading.value = true
    this.error.value = null

    try {
      await userApi.toggleUserStatusApi(id, status)
      // 更新本地数据
      const user = this.data.value.find((u) => u.id === id)
      if (user) {
        user.status = status
        user.status_label = status === 1 ? '启用' : '禁用'
      }
      return true
    } catch (err) {
      this.error.value = err as Error
      return false
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 获取角色选项（带缓存）
   */
  async getRoleOptions(): Promise<RoleInfo[]> {
    if (this.roleOptionsCache) {
      return this.roleOptionsCache
    }

    if (this.roleOptionsLoading) {
      // 等待现有请求完成
      while (this.roleOptionsLoading) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return this.roleOptionsCache || []
    }

    this.roleOptionsLoading = true

    try {
      const roles = await userApi.getUserRoleOptionsApi()
      this.roleOptionsCache = roles
      return roles
    } catch (err) {
      this.error.value = err as Error
      return []
    } finally {
      this.roleOptionsLoading = false
    }
  }

  /**
   * 导出用户数据
   */
  async exportUsers(params?: Partial<UserQueryParams>): Promise<Blob | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const queryParams = {
        ...this.config.defaultPageParams,
        page: this.pagination.value.page,
        page_size: this.pagination.value.page_size,
        ...params,
      } as UserQueryParams

      return await userApi.exportUsersApi(queryParams)
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 导入用户数据
   */
  async importUsers(file: File): Promise<{ success: number; failed: number; errors: string[] } | null> {
    this.loading.value = true
    this.error.value = null

    try {
      return await userApi.importUsersApi(file)
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /**
   * 搜索用户（防抖搜索）
   */
  async search(keyword: string): Promise<void> {
    await this.loadList({ keyword, page: 1 })
  }

  /**
   * 按角色筛选
   */
  async filterByRole(roleId: number): Promise<void> {
    await this.loadList({ role_id: roleId, page: 1 })
  }

  /**
   * 按状态筛选
   */
  async filterByStatus(status: number): Promise<void> {
    await this.loadList({ status, page: 1 })
  }

  /**
   * 清除角色缓存
   */
  clearRoleCache(): void {
    this.roleOptionsCache = null
  }
}

// 导出单例
export const userService = new UserService()
export default userService