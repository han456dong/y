/**
 * Service层基础类
 * 封装通用的业务逻辑处理：加载状态、错误处理、缓存、分页等
 */

import { ref, computed, shallowRef, type Ref } from 'vue'
import type { ApiResponse } from '../apis'

// 通用状态接口
export interface ServiceState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

// 分页参数
export interface PaginationParams {
  page: number
  page_size: number
}

// 分页响应
export interface PaginationResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// 服务基类配置
export interface BaseServiceConfig<T, Q extends PaginationParams = PaginationParams> {
  // API调用函数
  api: {
    list: (params: Q) => Promise<PaginationResponse<T>>
    get: (id: number | string) => Promise<T>
    create: (data: Partial<T>) => Promise<T>
    update: (id: number | string, data: Partial<T>) => Promise<T>
    delete: (id: number | string) => Promise<void>
    batchDelete?: (ids: (number | string)[]) => Promise<void>
  }
  // 缓存键前缀
  cacheKey?: string
  // 是否自动加载
  autoLoad?: boolean
  // 默认分页参数
  defaultPageParams?: Partial<Q>
}

/**
 * 基础服务类
 * 提供通用的CRUD操作、分页、加载状态管理
 */
export class BaseService<T extends { id: number | string }, Q extends PaginationParams = PaginationParams> {
  protected config: BaseServiceConfig<T, Q>
  protected state: ServiceState<PaginationResponse<T> | T | null> = {
    data: null,
    loading: false,
    error: null,
  }

  // 响应式状态
  public readonly data = shallowRef<T[]>([]) as Ref<T[]>
  public readonly loading = ref(false)
  public readonly error = ref<Error | null>(null)
  public readonly pagination = ref({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  })

  constructor(config: BaseServiceConfig<T, Q>) {
    this.config = {
      autoLoad: false,
      defaultPageParams: {},
      ...config,
    }

    if (this.config.autoLoad) {
      this.loadList()
    }
  }

  /**
   * 加载列表数据
   */
  async loadList(params?: Partial<Q>): Promise<PaginationResponse<T> | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const { page = this.pagination.value.page, page_size = this.pagination.value.page_size, ...rest } = (params ?? {}) as Q

      const queryParams = {
        ...this.config.defaultPageParams,
        page,
        page_size,
        ...rest,
      } as Q

      const response = await this.config.api.list(queryParams)

      this.data.value = response.items
      this.pagination.value = {
        page: response.page,
        page_size: response.page_size,
        total: response.total,
        total_pages: response.total_pages,
      }

      this.state.data = response
      return response
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return null
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 获取单条数据
   */
  async getById(id: number | string): Promise<T | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const item = await this.config.api.get(id)
      this.state.data = item
      return item
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return null
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 创建数据
   */
  async create(data: Partial<T>): Promise<T | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const item = await this.config.api.create(data)
      // 如果是第一页，添加到列表开头
      if (this.pagination.value.page === 1) {
        this.data.value.unshift(item)
        this.pagination.value.total += 1
      }
      return item
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return null
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 更新数据
   */
  async update(id: number | string, data: Partial<T>): Promise<T | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const item = await this.config.api.update(id, data)
      // 更新列表中的数据
      const index = this.data.value.findIndex((d) => d.id === id)
      if (index !== -1) {
        this.data.value[index] = item
      }
      // 如果当前查看的就是这条数据，更新state
      if (this.state.data && typeof this.state.data === 'object' && 'id' in this.state.data) {
        if ((this.state.data as T).id === id) {
          this.state.data = item
        }
      }
      return item
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return null
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 删除数据
   */
  async delete(id: number | string): Promise<boolean> {
    this.loading.value = true
    this.error.value = null

    try {
      await this.config.api.delete(id)
      // 从列表中移除
      this.data.value = this.data.value.filter((d) => d.id !== id)
      this.pagination.value.total -= 1
      return true
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return false
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 批量删除
   */
  async batchDelete(ids: (number | string)[]): Promise<boolean> {
    if (!this.config.api.batchDelete) {
      // 如果没有批量删除API，逐个删除
      for (const id of ids) {
        const success = await this.delete(id)
        if (!success) return false
      }
      return true
    }

    this.loading.value = true
    this.error.value = null

    try {
      await this.config.api.batchDelete(ids)
      this.data.value = this.data.value.filter((d) => !ids.includes(d.id))
      this.pagination.value.total -= ids.length
      return true
    } catch (err) {
      this.error.value = err as Error
      this.state.error = err as Error
      return false
    } finally {
      this.loading.value = false
      this.state.loading = false
    }
  }

  /**
   * 刷新当前页
   */
  async refresh(): Promise<void> {
    await this.loadList()
  }

  /**
   * 设置页码
   */
  setPage(page: number): void {
    this.pagination.value.page = page
    this.loadList()
  }

  /**
   * 设置每页大小
   */
  setPageSize(page_size: number): void {
    this.pagination.value.page_size = page_size
    this.pagination.value.page = 1
    this.loadList()
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.data.value = []
    this.loading.value = false
    this.error.value = null
    this.pagination.value = {
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
    }
    this.state = {
      data: null,
      loading: false,
      error: null,
    }
  }

  // 计算属性
  public readonly hasData = computed(() => this.data.value.length > 0)
  public readonly isEmpty = computed(() => !this.loading.value && this.data.value.length === 0)
  public readonly hasMore = computed(() => this.pagination.value.page < this.pagination.value.total_pages)
}