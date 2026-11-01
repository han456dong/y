<template>
  <PageContainer :title="title" :subtitle="subtitle">
    <div class="placeholder-page">
      <el-empty :description="description">
        <template #image>
          <div class="placeholder-icon">
            <Tools />
          </div>
        </template>
      </el-empty>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { ElEmpty } from 'element-plus'
import { Tools } from '@element-plus/icons-vue'
import PageContainer from './PageContainer.vue'

interface Props {
  title: string
  subtitle?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  description: '该功能正在开发中，敬请期待',
})
</script>

<style scoped lang="scss">
.placeholder-page {
  padding: 40px 0;

  .placeholder-icon {
    font-size: 64px;
    color: #c0c4cc;
  }
}
</style>