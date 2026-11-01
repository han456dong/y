<template>
  <div class="data-table-container">
    <!-- 工具栏 -->
    <div v-if="$slots.toolbar || showToolbar" class="table-toolbar">
      <div class="toolbar-left">
        <slot name="toolbar-left" />
      </div>
      <div class="toolbar-right">
        <slot name="toolbar" />
        <el-button v-if="showRefresh" :loading="loading" @click="handleRefresh">
          <Refresh /> 刷新
        </el-button>
        <el-button v-if="showExport" @click="handleExport">
          <Download /> 导出
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      :data="data"
      :loading="loading"
      :stripe="stripe"
      :border="border"
      :height="height"
      :max-height="maxHeight"
      :row-key="rowKey"
      :default-sort="defaultSort"
      :show-summary="showSummary"
      :summary-method="summaryMethod"
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
      @row-click="handleRowClick"
      @row-dblclick="handleRowDblClick"
      @current-change="handleCurrentChange"
    >
      <!-- 多选列 -->
      <el-table-column
        v-if="selectable"
        type="selection"
        width="50"
        align="center"
        :selectable="checkSelectable"
      />

      <!-- 序号列 -->
      <el-table-column
        v-if="showIndex"
        type="index"
        :label="indexLabel"
        width="70"
        align="center"
        :index="indexMethod"
      />

      <!-- 自定义列 -->
      <slot />

      <!-- 操作列 -->
      <el-table-column
        v-if="$slots.actions"
        :label="actionLabel"
        :width="actionWidth"
        :fixed="actionFixed"
        align="center"
      >
        <template #default="scope">
          <slot name="actions" :row="scope.row" :index="scope.$index" />
        </template>
      </el-table-column>

      <!-- 空状态 -->
      <template #empty>
        <el-empty :description="emptyText" :image-size="100" />
      </template>
    </el-table>

    <!-- 分页 -->
    <div v-if="showPagination" class="table-pagination">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        :disabled="loading"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElEmpty } from 'element-plus'
import { Refresh, Download } from '@element-plus/icons-vue'

interface Props {
  data: any[]
  loading?: boolean
  stripe?: boolean
  border?: boolean
  height?: string | number
  maxHeight?: string | number
  rowKey?: string
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  showSummary?: boolean
  summaryMethod?: (params: { columns: any[]; data: any[] }) => string[]
  selectable?: boolean
  checkSelectable?: (row: any, index: number) => boolean
  showIndex?: boolean
  indexLabel?: string
  showToolbar?: boolean
  showRefresh?: boolean
  showExport?: boolean
  showPagination?: boolean
  currentPage?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  paginationLayout?: string
  actionLabel?: string
  actionWidth?: string | number
  actionFixed?: string | boolean
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false,
  stripe: true,
  border: false,
  height: undefined,
  maxHeight: undefined,
  rowKey: 'id',
  defaultSort: undefined,
  showSummary: false,
  summaryMethod: undefined,
  selectable: false,
  checkSelectable: undefined,
  showIndex: true,
  indexLabel: '序号',
  showToolbar: false,
  showRefresh: true,
  showExport: false,
  showPagination: true,
  currentPage: 1,
  pageSize: 20,
  total: 0,
  pageSizes: () => [10, 20, 50, 100],
  paginationLayout: 'total, sizes, prev, pager, next, jumper',
  actionLabel: '操作',
  actionWidth: 180,
  actionFixed: 'right',
  emptyText: '暂无数据',
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'export'): void
  (e: 'selection-change', selection: any[]): void
  (e: 'sort-change', sort: { prop: string; order: string }): void
  (e: 'row-click', row: any, column: any, event: Event): void
  (e: 'row-dblclick', row: any, column: any, event: Event): void
  (e: 'current-change', row: any): void
  (e: 'update:currentPage', page: number): void
  (e: 'update:pageSize', size: number): void
}>()

const handleRefresh = () => emit('refresh')
const handleExport = () => emit('export')

const handleSelectionChange = (selection: any[]) => emit('selection-change', selection)
const handleSortChange = (sort: { prop: string | null; order: string | null }) =>
  emit('sort-change', { prop: sort.prop ?? '', order: sort.order ?? '' })
const handleRowClick = (row: any, column: any, event: Event) => emit('row-click', row, column, event)
const handleRowDblClick = (row: any, column: any, event: Event) => emit('row-dblclick', row, column, event)
const handleCurrentChange = (row: any) => emit('current-change', row)

const handlePageChange = (page: number) => {
  emit('update:currentPage', page)
}

const handleSizeChange = (size: number) => {
  emit('update:pageSize', size)
}

const indexMethod = (index: number) => {
  return (props.currentPage - 1) * props.pageSize + index + 1
}
</script>

<style scoped lang="scss">
.data-table-container {
  width: 100%;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

:deep(.el-table) {
  --el-table-header-bg-color: var(--el-fill-color-lighter, #fafafa);
  --el-table-header-text-color: var(--el-text-color-primary, #303133);
  --el-table-row-hover-bg-color: var(--el-fill-color-light, #f5f7fa);

  .el-table__header {
    th {
      font-weight: 600;
      height: 48px;
    }
  }

  .el-table__body {
    td {
      height: 44px;
    }
  }
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.el-icon) {
  font-size: 14px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 0 4px;

  :deep(.el-pagination) {
    --el-pagination-bg-color: transparent;
    --el-pagination-button-disabled-bg-color: transparent;

    .el-pagination__total {
      margin-right: 12px;
    }
  }
}
</style>