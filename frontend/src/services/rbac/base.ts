/**
 * Service层 - RBAC 分页列表基类
 * 统一分页、加载态、错误态与关键词搜索，避免各资源重复实现
 */

import { ref, shallowRef, computed, type Ref } from 'vue'
import type { PageQuery, PageResult } from '@/apis/modules/rbac'

export interface PaginationState {
  page: number
  page_size: number
  total: number
}

/**
 * 通用分页服务
 */
export class RbacListService<T extends { id: number }, Q extends PageQuery = PageQuery> {
  public readonly items = shallowRef<T[]>([]) as Ref<T[]>
  public readonly loading = ref(false)
  public readonly error = ref<Error | null>(null)
  public readonly pagination = ref<PaginationState>({ page: 1, page_size: 10, total: 0 })

  private readonly searchFn: (params: Q) => Promise<PageResult<T>>
  private readonly defaultQuery: Partial<Q>

  constructor(searchFn: (params: Q) => Promise<PageResult<T>>, defaultQuery: Partial<Q> = {}) {
    this.searchFn = searchFn
    this.defaultQuery = defaultQuery
  }

  /** 加载分页数据 */
  async load(params?: Partial<Q>): Promise<PageResult<T> | null> {
    this.loading.value = true
    this.error.value = null

    try {
      const query = {
        page: this.pagination.value.page,
        page_size: this.pagination.value.page_size,
        ...this.defaultQuery,
        ...params,
      } as Q

      // 显式传入的页码需要回写到分页状态
      if (params?.page !== undefined) this.pagination.value.page = params.page
      if (params?.page_size !== undefined) this.pagination.value.page_size = params.page_size

      const result = await this.searchFn(query)
      this.items.value = result.items
      this.pagination.value = {
        page: result.page,
        page_size: result.page_size,
        total: result.total,
      }
      return result
    } catch (err) {
      this.error.value = err as Error
      return null
    } finally {
      this.loading.value = false
    }
  }

  /** 关键词搜索（重置到第一页） */
  async search(keyword: string): Promise<PageResult<T> | null> {
    return this.load({ keyword: keyword || undefined, page: 1 } as Partial<Q>)
  }

  setPage(page: number): Promise<PageResult<T> | null> {
    return this.load({ page } as Partial<Q>)
  }

  setPageSize(pageSize: number): Promise<PageResult<T> | null> {
    return this.load({ page: 1, page_size: pageSize } as Partial<Q>)
  }

  refresh(): Promise<PageResult<T> | null> {
    return this.load()
  }

  reset(): void {
    this.items.value = []
    this.loading.value = false
    this.error.value = null
    this.pagination.value = { page: 1, page_size: 10, total: 0 }
  }

  readonly hasData = computed(() => this.items.value.length > 0)
  readonly isEmpty = computed(() => !this.loading.value && this.items.value.length === 0)
}
