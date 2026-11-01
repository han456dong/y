<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">500</h1>
      <h2 class="error-title">服务器错误</h2>
      <p class="error-description">服务器发生错误，请稍后重试</p>
      <el-button type="primary" @click="reload">
        <Refresh /> 刷新页面
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

const reload = () => window.location.reload()
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
    color: #f56c6c;
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