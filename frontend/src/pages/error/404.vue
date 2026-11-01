<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">404</h1>
      <h2 class="error-title">页面未找到</h2>
      <p class="error-description">您访问的页面不存在或已被移除</p>
      <el-button type="primary" @click="goHome">
        <HomeFilled /> 返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import { HomeFilled } from '@element-plus/icons-vue'

const router = useRouter()
const goHome = () => router.push('/')
</script>

<style scoped lang="scss">
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}

.error-content {
  text-align: center;

  .error-code {
    font-size: 120px;
    font-weight: 700;
    color: #409eff;
    margin: 0;
    line-height: 1;
  }

  .error-title {
    font-size: 24px;
    color: #303133;
    margin: 16px 0 8px;
  }

  .error-description {
    font-size: 14px;
    color: #909399;
    margin: 0 0 24px;
  }
}
</style>