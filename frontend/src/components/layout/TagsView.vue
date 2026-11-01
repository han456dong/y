<template>
  <div class="tags-view" ref="tagsContainer">
    <!-- 滚动按钮 -->
    <button
      v-if="showLeftScroll"
      class="scroll-btn left"
      @click="scrollLeft"
      :disabled="!canScrollLeft"
      aria-label="向左滚动"
    >
      <DArrowLeft />
    </button>

    <!-- 标签页列表 -->
    <div class="tags-wrapper" ref="tagsWrapper" @wheel.prevent="handleWheel">
      <div class="tags-list" ref="tagsList" :style="{ transform: `translateX(${scrollX}px)` }">
        <!-- 首页标签（固定） -->
        <div
          v-if="showHomeTab"
          class="tag-item home-tag"
          @click="handleTagClick('/dashboard')"
        >
          <HomeFilled class="tag-icon" />
          <span class="tag-title">首页</span>
        </div>

        <!-- 动态标签 -->
        <div
          v-for="tag in visitedViews"
          :key="tag.path"
          class="tag-item"
          :class="{ active: tag.path === activePath, closable: tag.closable }"
          @click="handleTagClick(tag.path)"
          @contextmenu.prevent="handleContextMenu(tag, $event)"
        >
          <component
            :is="tag.icon || 'Document'"
            class="tag-icon"
            v-if="tag.icon"
          />
          <span class="tag-title">{{ tag.title }}</span>
          <Close
            v-if="tag.closable"
            class="tag-close"
            @click.stop="closeTag(tag.path)"
          />
        </div>
      </div>
    </div>

    <button
      v-if="showRightScroll"
      class="scroll-btn right"
      @click="scrollRight"
      :disabled="!canScrollRight"
      aria-label="向右滚动"
    >
      <DArrowRight />
    </button>

    <!-- 更多操作下拉菜单 -->
    <el-dropdown trigger="click" v-if="visitedViews.length > 0">
      <button class="more-btn" aria-label="更多操作">
        <More />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="closeOtherTags">
            <DeleteLocation /> 关闭其他
          </el-dropdown-item>
          <el-dropdown-item @click="closeAllTags">
            <Delete /> 关闭所有
          </el-dropdown-item>
          <el-dropdown-item divided @click="refreshCurrentTag">
            <Refresh /> 刷新当前
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/store/modules/app'
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import {
  HomeFilled, Close, DArrowLeft, DArrowRight, More,
  Delete, DeleteLocation, Refresh, Document
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const tagsContainer = ref<HTMLElement>()
const tagsWrapper = ref<HTMLElement>()
const tagsList = ref<HTMLElement>()

const scrollX = ref(0)
const TAG_ITEM_WIDTH = 160 // 估算每个标签宽度
const SCROLL_STEP = 320 // 每次滚动距离

// 计算属性
const visitedViews = computed(() => appStore.tagsView.visitedViews)
const activePath = computed(() => route.fullPath)
const showHomeTab = computed(() => !visitedViews.value.some(v => v.path === '/dashboard'))

const containerWidth = computed(() => tagsWrapper.value?.clientWidth || 0)
const listWidth = computed(() => tagsList.value?.scrollWidth || 0)

const canScrollLeft = computed(() => scrollX.value < 0)
const canScrollRight = computed(() => Math.abs(scrollX.value) + containerWidth.value < listWidth.value)

const showLeftScroll = computed(() => canScrollLeft.value)
const showRightScroll = computed(() => canScrollRight.value)

// 处理滚动
const handleWheel = (event: WheelEvent) => {
  if (event.deltaY !== 0) {
    scrollX.value = Math.max(
      Math.min(scrollX.value - event.deltaY, 0),
      containerWidth.value - listWidth.value
    )
  }
}

const scrollLeft = () => {
  scrollX.value = Math.min(scrollX.value + SCROLL_STEP, 0)
}

const scrollRight = () => {
  scrollX.value = Math.max(scrollX.value - SCROLL_STEP, containerWidth.value - listWidth.value)
}

// 标签点击
const handleTagClick = (path: string) => {
  router.push(path)
}

// 右键菜单
const handleContextMenu = (tag: any, event: MouseEvent) => {
  event.preventDefault()
  // TODO: 显示右键菜单
  console.log('右键菜单', tag)
}

// 关闭标签
const closeTag = async (path: string) => {
  const tag = visitedViews.value.find(v => v.path === path)
  if (!tag || !tag.closable) return

  // 如果关闭的是当前激活标签，跳转到相邻标签
  if (path === activePath.value) {
    const index = visitedViews.value.findIndex(v => v.path === path)
    const nextTag = visitedViews.value[index + 1] || visitedViews.value[index - 1]
    if (nextTag) {
      await router.push(nextTag.path)
    } else {
      await router.push('/dashboard')
    }
  }

  appStore.removeVisitedView(path)
  appStore.removeCachedView(tag.name as string)
}

// 关闭其他标签
const closeOtherTags = () => {
  const currentPath = activePath.value
  const otherTags = visitedViews.value.filter(v => v.path !== currentPath && v.closable)

  otherTags.forEach(tag => {
    appStore.removeVisitedView(tag.path)
    appStore.removeCachedView(tag.name as string)
  })
}

// 关闭所有标签
const closeAllTags = () => {
  const closableTags = visitedViews.value.filter(v => v.closable)

  closableTags.forEach(tag => {
    appStore.removeVisitedView(tag.path)
    appStore.removeCachedView(tag.name as string)
  })

  router.push('/dashboard')
}

// 刷新当前标签
const refreshCurrentTag = () => {
  // 通过路由替换触发刷新
  router.replace(activePath.value)
}

// 更新滚动位置
const updateScroll = async () => {
  await nextTick()
  if (!tagsList.value || !tagsWrapper.value) return

  const activeTag = tagsList.value.querySelector('.tag-item.active') as HTMLElement
  if (!activeTag) return

  const wrapperRect = tagsWrapper.value.getBoundingClientRect()
  const tagRect = activeTag.getBoundingClientRect()

  if (tagRect.left < wrapperRect.left) {
    scrollX.value += tagRect.left - wrapperRect.left - 10
  } else if (tagRect.right > wrapperRect.right) {
    scrollX.value -= tagRect.right - wrapperRect.right + 10
  }

  // 限制范围
  scrollX.value = Math.max(Math.min(scrollX.value, 0), containerWidth.value - listWidth.value)
}

// 监听路由变化
watch(
  () => route.fullPath,
  () => {
    updateScroll()
  }
)

watch(
  () => visitedViews.value.length,
  () => {
    nextTick(() => updateScroll())
  }
)

onMounted(() => {
  updateScroll()
  window.addEventListener('resize', updateScroll)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScroll)
})
</script>

<style scoped lang="scss">
.tags-view {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  background: var(--el-bg-color-overlay, #ffffff);
  position: relative;
  z-index: 10;
}

.tags-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tags-list {
  display: flex;
  align-items: center;
  height: 100%;
  transition: transform 0.3s ease;
  will-change: transform;
}

.tag-item {
  display: flex;
  align-items: center;
  min-width: 120px;
  max-width: 200px;
  height: 32px;
  padding: 0 12px;
  margin: 0 4px;
  border-radius: 6px;
  background: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-text-color-secondary, #909399);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s ease;

  &:hover {
    background: var(--el-fill-color, #f0f2f5);
    color: var(--el-text-color-primary, #303133);
  }

  &.active {
    background: var(--el-color-primary-light-9, #ecf5ff);
    color: var(--el-color-primary, #409eff);
    font-weight: 500;
  }

  &.closable {
    padding-right: 28px;
  }

  .tag-icon {
    font-size: 14px;
    margin-right: 6px;
    flex-shrink: 0;
  }

  .tag-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-close {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: var(--el-text-color-placeholder, #c0c4cc);
    cursor: pointer;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;

    &:hover {
      background: var(--el-color-danger, #f56c6c);
      color: white;
    }
  }
}

.home-tag {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);

  .tag-icon {
    color: var(--el-color-primary, #409eff);
  }
}

.scroll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--el-text-color-secondary, #909399);
  cursor: pointer;
  flex-shrink: 0;
  z-index: 1;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-text-color-primary, #303133);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &.left {
    margin-right: 4px;
    background: linear-gradient(90deg, var(--el-bg-color-overlay, #ffffff), transparent);
  }

  &.right {
    margin-left: 4px;
    background: linear-gradient(270deg, var(--el-bg-color-overlay, #ffffff), transparent);
  }
}

.more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--el-text-color-secondary, #909399);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-text-color-primary, #303133);
  }
}

:deep(.el-dropdown-menu) {
  min-width: 140px;
  padding: 6px 0;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
}

:deep(.el-dropdown-item) {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-primary, #303133);

  &:hover {
    background: var(--el-fill-color-light, #f5f7fa);
    color: var(--el-color-primary, #409eff);
  }
}
</style>