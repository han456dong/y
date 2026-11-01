<template>
  <!-- 菜单项组件 - 支持递归渲染多级菜单 -->
  <el-sub-menu v-if="hasChildren" :index="route.path" :popper-class="'sub-menu-popper'">
    <template #title>
      <component :is="resolveIcon(menuIcon)" class="menu-icon" />
      <span class="menu-title">{{ menuTitle }}</span>
    </template>
    <sidebar-menu-item
      v-for="child in route.children"
      :key="child.path"
      :route="child"
      :is-collapsed="isCollapsed"
    />
  </el-sub-menu>

  <el-menu-item v-else :index="route.path" :disabled="route.meta?.disabled">
    <component :is="resolveIcon(menuIcon)" class="menu-icon" />
    <template #title>
      <span class="menu-title">{{ menuTitle }}</span>
    </template>
  </el-menu-item>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { ElSubMenu, ElMenuItem } from 'element-plus'

interface Props {
  route: any
  isCollapsed: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false,
})

// 判断是否有子路由
const hasChildren = computed(() => {
  return props.route.children && props.route.children.length > 0
})

// 菜单图标名称
const menuIcon = computed(() => {
  return props.route.meta?.icon || (hasChildren.value ? 'FolderOpened' : 'Document')
})

// 菜单标题
const menuTitle = computed(() => {
  return props.route.meta?.title || props.route.name || '未命名'
})

// 动态解析图标组件
const resolveIcon = (name: string) => {
  return resolveComponent(name)
}
</script>

<style scoped lang="scss">
.menu-icon {
  font-size: 16px;
  margin-right: 8px;
  flex-shrink: 0;
  width: 1em;
  height: 1em;
}

.menu-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-sub-menu__title) {
  display: flex;
  align-items: center;
}

:deep(.sub-menu-popper) {
  :deep(.el-menu) {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
    border: 1px solid var(--el-border-color-light, #e4e7ed);
    border-radius: 8px;
    padding: 8px 0;
  }
}
</style>