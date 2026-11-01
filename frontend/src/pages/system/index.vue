<template>
  <PageContainer title="系统管理" subtitle="基于 RBAC 模型的用户、角色与权限统一管理">
    <template #actions>
      <el-button :loading="rbacStore.statsLoading" @click="loadStats">
        <Refresh /> 刷新统计
      </el-button>
    </template>

    <!-- 统计概览 -->
    <div class="stat-grid">
      <div class="stat-card" v-for="stat in statCards" :key="stat.key">
        <div class="stat-icon" :class="`tone-${stat.tone}`">
          <component :is="stat.icon" />
        </div>
        <div class="stat-body">
          <div class="stat-value">
            <el-skeleton v-if="rbacStore.statsLoading" :rows="0" animated style="width: 60px">
              <template #template><el-skeleton-item variant="text" style="width: 60px" /></template>
            </el-skeleton>
            <template v-else>{{ stat.value }}</template>
          </div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 模块入口 -->
    <div class="module-grid">
      <router-link v-for="module in modules" :key="module.path" :to="module.path" class="module-card">
        <div class="module-head">
          <span class="module-icon"><component :is="module.icon" /></span>
          <el-tag size="small" effect="plain" :type="module.tagType">{{ module.countLabel }}</el-tag>
        </div>
        <h3>{{ module.title }}</h3>
        <p>{{ module.description }}</p>
        <span class="module-action">
          进入管理 <ArrowRight />
        </span>
      </router-link>
    </div>

    <!-- RBAC 模型说明 -->
    <div class="model-panel">
      <div class="panel-head">
        <h3>RBAC 权限模型</h3>
        <span class="panel-hint">用户 → 角色 → 权限，支持多对多授权</span>
      </div>
      <div class="model-flow">
        <div class="flow-node">
          <UserFilled />
          <strong>用户</strong>
          <span>账号主体</span>
        </div>
        <ArrowRight class="flow-arrow" />
        <div class="flow-node">
          <Avatar />
          <strong>角色</strong>
          <span>权限集合</span>
        </div>
        <ArrowRight class="flow-arrow" />
        <div class="flow-node">
          <Key />
          <strong>权限</strong>
          <span>模块:操作</span>
        </div>
      </div>
      <ul class="model-notes">
        <li>一个用户可拥有多个角色，角色权限取并集生效。</li>
        <li>权限编码采用 <code>模块:资源:操作</code> 格式，便于分组与审计。</li>
        <li>角色与权限的变更会实时反映到用户授权与菜单可见性。</li>
      </ul>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElButton, ElTag, ElSkeleton, ElSkeletonItem } from 'element-plus'
import {
  Refresh, ArrowRight, UserFilled, Avatar, Key, Lock, User, Grid,
} from '@element-plus/icons-vue'
import PageContainer from '@/components/common/PageContainer.vue'
import { useRbacStore } from '@/store/modules/rbac'

const rbacStore = useRbacStore()

const loadStats = () => rbacStore.loadStats()

const statCards = computed(() => [
  { key: 'users', label: '用户总数', value: rbacStore.stats.users, icon: User, tone: 'blue' },
  { key: 'active', label: '活跃用户', value: rbacStore.stats.activeUsers, icon: UserFilled, tone: 'green' },
  { key: 'roles', label: '角色总数', value: rbacStore.stats.roles, icon: Avatar, tone: 'orange' },
  { key: 'permissions', label: '权限总数', value: rbacStore.stats.permissions, icon: Key, tone: 'slate' },
])

const modules = computed(() => [
  {
    path: '/system/user',
    title: '用户管理',
    description: '创建账号、查看用户详情，并为用户分配角色。',
    icon: User,
    countLabel: `${rbacStore.stats.users} 位用户`,
    tagType: 'primary' as const,
  },
  {
    path: '/system/role',
    title: '角色管理',
    description: '维护角色定义，配置角色所拥有的权限集合。',
    icon: Avatar,
    countLabel: `${rbacStore.stats.roles} 个角色`,
    tagType: 'warning' as const,
  },
  {
    path: '/system/permission',
    title: '权限管理',
    description: '维护权限编码与说明，按模块分类管理访问控制点。',
    icon: Key,
    countLabel: `${rbacStore.stats.permissions} 项权限`,
    tagType: 'success' as const,
  },
  {
    path: '/system/department',
    title: '部门管理',
    description: '组织架构维护（接口规划中，当前为占位页面）。',
    icon: Grid,
    countLabel: '规划中',
    tagType: 'info' as const,
  },
])

onMounted(() => {
  loadStats()
})
</script>

<style scoped lang="scss">
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5, #a0cfff);
  }
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  font-size: 20px;
  flex-shrink: 0;

  &.tone-blue { background: #eef4fe; color: #2f6fdb; }
  &.tone-green { background: #ecf7f0; color: #2f8f5b; }
  &.tone-orange { background: #fdf3ec; color: #b06a3b; }
  &.tone-slate { background: #f0f2f5; color: #4a5568; }
}

.stat-body {
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--el-text-color-primary, #303133);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
  margin-top: 2px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.module-card {
  display: block;
  padding: 20px;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--el-color-primary-light-5, #a0cfff);
    text-decoration: none;
  }

  &:active {
    transform: scale(0.995);
  }

  h3 {
    font-size: 16px;
    color: var(--el-text-color-primary, #303133);
    margin: 14px 0 6px;
  }

  p {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
    line-height: 1.6;
    margin: 0 0 14px;
  }
}

.module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.module-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-color-primary, #409eff);
  font-size: 18px;
}

.module-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-color-primary, #409eff);
}

.model-panel {
  padding: 20px;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;

  h3 {
    font-size: 16px;
    color: var(--el-text-color-primary, #303133);
  }
}

.panel-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.model-flow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 8px;
  margin-bottom: 16px;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 96px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 8px;
  color: var(--el-text-color-primary, #303133);

  svg {
    font-size: 20px;
    color: var(--el-color-primary, #409eff);
  }

  strong {
    font-size: 14px;
  }

  span {
    font-size: 12px;
    color: var(--el-text-color-secondary, #909399);
  }
}

.flow-arrow {
  color: var(--el-text-color-placeholder, #c0c4cc);
}

.model-notes {
  margin: 0;
  padding-left: 18px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;
  line-height: 1.9;

  code {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--el-fill-color-light, #f5f7fa);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--el-text-color-primary, #303133);
  }
}

@media (max-width: 1024px) {
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 768px) {
  .stat-grid,
  .module-grid { grid-template-columns: 1fr; }

  .model-flow { flex-direction: column; }
  .flow-arrow { transform: rotate(90deg); }
}
</style>
