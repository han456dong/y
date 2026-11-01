<template>
  <div class="page-container" :class="{ 'has-padding': padding }">
    <!-- 页面标题栏 -->
    <div v-if="title || $slots.header || $slots.actions" class="page-header">
      <div class="page-header-left">
        <h2 v-if="title" class="page-title">{{ title }}</h2>
        <span v-if="subtitle" class="page-subtitle">{{ subtitle }}</span>
        <slot name="header" />
      </div>
      <div class="page-header-right">
        <slot name="actions" />
      </div>
    </div>

    <!-- 页面内容 -->
    <div class="page-content" :class="{ 'loading': loading }">
      <!-- 加载状态 -->
      <el-skeleton v-if="loading" :rows="6" animated class="loading-skeleton" />

      <!-- 空状态 -->
      <el-empty v-else-if="empty" :description="emptyText" :image-size="120" />

      <!-- 错误状态 -->
      <el-result v-else-if="error" icon="error" :title="errorTitle" :sub-title="errorMessage">
        <template #extra>
          <el-button type="primary" @click="handleRetry">
            <Refresh /> 重试
          </el-button>
        </template>
      </el-result>

      <!-- 正常内容 -->
      <slot v-else />
    </div>

    <!-- 页脚 -->
    <div v-if="$slots.footer" class="page-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElSkeleton, ElEmpty, ElResult, ElButton } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

interface Props {
  title?: string
  subtitle?: string
  loading?: boolean
  empty?: boolean
  emptyText?: string
  error?: boolean
  errorTitle?: string
  errorMessage?: string
  padding?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  error: false,
  errorTitle: '加载失败',
  errorMessage: '数据加载失败，请重试',
  padding: true,
})

const emit = defineEmits<{
  (e: 'retry'): void
}>()

const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped lang="scss">
.page-container {
  width: 100%;
  min-height: 100%;
  background: var(--el-bg-color-overlay, #ffffff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  overflow: hidden;

  &.has-padding {
    .page-content {
      padding: 24px;
    }
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--el-border-color-light, #e4e7ed);

  .page-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .page-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary, #303133);
    margin: 0;
  }

  .page-subtitle {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
  }

  .page-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}

.page-content {
  position: relative;

  &.loading {
    padding: 24px;
  }
}

.loading-skeleton {
  :deep(.el-skeleton__item) {
    margin-bottom: 16px;
  }
}

.page-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  background: var(--el-fill-color-lighter, #fafafa);
}
</style>