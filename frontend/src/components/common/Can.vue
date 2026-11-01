<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePermissionStore } from '@/store/modules/permission'

/**
 * 声明式权限控制组件（PRD 8.5）
 * <Can permission="system.user:create"> ... </Can>
 * <Can :permission="['a', 'b']" mode="all"> ... </Can>
 * fallback 插槽用于无权限时的替代内容
 */
const props = withDefaults(
  defineProps<{
    permission: string | string[]
    /** any: 满足其一；all: 必须全部满足 */
    mode?: 'any' | 'all'
  }>(),
  { mode: 'any' }
)

const permissionStore = usePermissionStore()

const allowed = computed(() => {
  const codes = Array.isArray(props.permission) ? props.permission : [props.permission]
  return props.mode === 'all' ? permissionStore.hasAll(codes) : permissionStore.hasAny(codes)
})
</script>
