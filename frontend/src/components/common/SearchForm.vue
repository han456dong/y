<template>
  <div class="search-form">
    <el-form :model="formData" :label-width="labelWidth" @submit.prevent="handleSubmit">
      <div class="search-form-content">
        <!-- 自定义表单字段 -->
        <slot name="fields" :form="formData" :setField="setField" />
      </div>

      <div class="search-form-actions">
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          <Search /> 查询
        </el-button>
        <el-button @click="handleReset">
          <RefreshLeft /> 重置
        </el-button>
        <slot name="actions" />
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElForm, ElButton } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'

interface Props {
  modelValue?: Record<string, any>
  labelWidth?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({}),
  labelWidth: '90px',
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
  (e: 'search', value: Record<string, any>): void
  (e: 'reset'): void
}>()

const formData = reactive<Record<string, any>>({ ...props.modelValue })

// 同步外部modelValue
watch(
  () => props.modelValue,
  (newVal) => {
    Object.keys(newVal).forEach((key) => {
      formData[key] = newVal[key]
    })
  },
  { deep: true }
)

const setField = (key: string, value: any) => {
  formData[key] = value
  emit('update:modelValue', { ...formData })
}

const handleSubmit = () => {
  emit('update:modelValue', { ...formData })
  emit('search', { ...formData })
}

const handleReset = () => {
  Object.keys(formData).forEach((key) => {
    formData[key] = undefined
  })
  emit('update:modelValue', { ...formData })
  emit('reset')
}
</script>

<style scoped lang="scss">
.search-form {
  padding: 16px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 8px;
  margin-bottom: 16px;
}

.search-form-content {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  :deep(.el-form-item) {
    margin-bottom: 0;
    flex: 1 1 calc(33.333% - 8px);
    min-width: 200px;

    &:last-child {
      flex: 0 0 auto;
    }
  }
}

.search-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 0;
  flex-wrap: wrap;
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.el-icon) {
  font-size: 14px;
}
</style>