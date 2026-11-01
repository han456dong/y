/**
 * 组件测试 - Can 权限声明组件
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Can from '@/components/common/Can.vue'
import { usePermissionStore } from '@/store/modules/permission'

describe('组件 - Can', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function setupPermissions(codes: string[], isSuperuser = false) {
    const store = usePermissionStore()
    store.permissions = new Set(codes)
    store.isSuperuser = isSuperuser
    store.loaded = true
  }

  const mountCan = (props: any) =>
    mount(Can, {
      props,
      slots: {
        default: '<span class="allowed">allowed</span>',
        fallback: '<span class="denied">denied</span>',
      },
    })

  it('拥有权限时渲染默认插槽', () => {
    setupPermissions(['system.user:read'])
    const wrapper = mountCan({ permission: 'system.user:read' })
    expect(wrapper.find('.allowed').exists()).toBe(true)
    expect(wrapper.find('.denied').exists()).toBe(false)
  })

  it('缺少权限时渲染 fallback', () => {
    setupPermissions(['dashboard:read'])
    const wrapper = mountCan({ permission: 'system.user:delete' })
    expect(wrapper.find('.allowed').exists()).toBe(false)
    expect(wrapper.find('.denied').exists()).toBe(true)
  })

  it('数组 + any 模式：满足其一即可', () => {
    setupPermissions(['system.user:read'])
    const wrapper = mountCan({ permission: ['system.user:read', 'system.role:read'] })
    expect(wrapper.find('.allowed').exists()).toBe(true)
  })

  it('数组 + all 模式：必须全部满足', () => {
    setupPermissions(['system.user:read'])
    const wrapper = mountCan({
      permission: ['system.user:read', 'system.role:read'],
      mode: 'all',
    })
    expect(wrapper.find('.denied').exists()).toBe(true)
  })

  it('超管直通', () => {
    setupPermissions([], true)
    const wrapper = mountCan({ permission: 'system.permission:delete' })
    expect(wrapper.find('.allowed').exists()).toBe(true)
  })

  it('无 fallback 插槽时渲染为空', () => {
    setupPermissions([])
    const wrapper = mount(Can, {
      props: { permission: 'agent:create' },
      slots: { default: '<span class="allowed">allowed</span>' },
    })
    expect(wrapper.find('.allowed').exists()).toBe(false)
    expect(wrapper.html()).toBe('')
  })
})
