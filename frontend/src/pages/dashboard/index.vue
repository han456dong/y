<template>
  <div class="dashboard-page">
    <!-- 欢迎卡片 -->
    <div class="welcome-card">
      <div class="welcome-content">
        <h1 class="welcome-title">欢迎回来，{{ authStore.userName }}</h1>
        <p class="welcome-description">今天是 {{ today }}，祝您工作愉快！</p>
      </div>
      <div class="welcome-stats">
        <div class="stat-item">
          <div class="stat-value">{{ stats.agents }}</div>
          <div class="stat-label">Agent总数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.knowledgeBases }}</div>
          <div class="stat-label">知识库</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.models }}</div>
          <div class="stat-label">模型数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.tools }}</div>
          <div class="stat-label">工具数</div>
        </div>
      </div>
    </div>

    <!-- 图表卡片 -->
    <div class="chart-grid">
      <div class="chart-card">
        <h3 class="chart-title">Agent使用趋势</h3>
        <div class="chart-placeholder">
          <TrendCharts />
        </div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">知识库增长</h3>
        <div class="chart-placeholder">
          <DataAnalysis />
        </div>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="recent-card">
      <h3 class="chart-title">最近活动</h3>
      <el-timeline>
        <el-timeline-item
          v-for="activity in activities"
          :key="activity.id"
          :timestamp="activity.time"
          :type="activity.type"
        >
          {{ activity.content }}
        </el-timeline-item>
      </el-timeline>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElTimeline, ElTimelineItem } from 'element-plus'
import { TrendCharts, DataAnalysis } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/modules/auth'

const authStore = useAuthStore()

const today = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
})

// 统计数据
const stats = ref({
  agents: 12,
  knowledgeBases: 5,
  models: 8,
  tools: 15,
})

// 最近活动
const activities = ref<Array<{ id: number; time: string; content: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }>>([
  { id: 1, time: '2024-11-01 10:30', content: '创建了新的Agent「客服助手」', type: 'success' },
  { id: 2, time: '2024-11-01 09:15', content: '更新了知识库「产品文档」', type: 'info' },
  { id: 3, time: '2024-10-31 16:45', content: '调整了模型配置「GPT-4」', type: 'warning' },
  { id: 4, time: '2024-10-31 14:20', content: '新增工具「网页搜索」', type: 'success' },
  { id: 5, time: '2024-10-31 11:00', content: '用户「张三」登录系统', type: 'info' },
])
</script>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 32px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .welcome-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .welcome-description {
    font-size: 14px;
    opacity: 0.9;
    margin: 0;
  }

  .welcome-stats {
    display: flex;
    gap: 32px;

    .stat-item {
      text-align: center;

      .stat-value {
        font-size: 28px;
        font-weight: 700;
      }

      .stat-label {
        font-size: 12px;
        opacity: 0.8;
        margin-top: 4px;
      }
    }
  }
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  .chart-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e4e7ed;

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 16px;
    }

    .chart-placeholder {
      height: 200px;
      background: #f5f7fa;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #909399;
      font-size: 48px;
    }
  }
}

.recent-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e4e7ed;

  .chart-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 16px;
  }
}

@media (max-width: 768px) {
  .welcome-card {
    flex-direction: column;
    gap: 24px;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>