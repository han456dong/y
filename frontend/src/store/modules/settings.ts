/**
 * Pinia Store - 用户设置/偏好
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

interface UserSettings {
  // 通知设置
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    inApp: boolean
  }
  // 界面设置
  ui: {
    compactMode: boolean
    showBreadcrumb: boolean
    showTagsView: boolean
    showLogo: boolean
    showFooter: boolean
    fixedHeader: boolean
    fixedSidebar: boolean
  }
  // 编辑器设置
  editor: {
    fontSize: number
    tabSize: number
    wordWrap: boolean
    minimap: boolean
    lineNumbers: boolean
  }
  // 数据设置
  data: {
    defaultPageSize: number
    maxPageSize: number
    dateFormat: string
    timeFormat: string
    timezone: string
  }
}

const defaultSettings: UserSettings = {
  notifications: {
    email: true,
    sms: false,
    push: true,
    inApp: true,
  },
  ui: {
    compactMode: false,
    showBreadcrumb: true,
    showTagsView: true,
    showLogo: true,
    showFooter: true,
    fixedHeader: true,
    fixedSidebar: true,
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: false,
    lineNumbers: true,
  },
  data: {
    defaultPageSize: 20,
    maxPageSize: 100,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    timezone: 'Asia/Shanghai',
  },
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings>({ ...defaultSettings })
  const loading = ref(false)

  // 从本地存储加载
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem('user_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch {
      // 忽略解析错误，使用默认值
    }
  }

  // 保存到本地存储
  function saveToStorage() {
    try {
      localStorage.setItem('user_settings', JSON.stringify(settings.value))
    } catch {
      // 忽略存储错误
    }
  }

  // 更新通知设置
  function updateNotifications(partial: Partial<UserSettings['notifications']>) {
    settings.value.notifications = { ...settings.value.notifications, ...partial }
    saveToStorage()
  }

  // 更新UI设置
  function updateUI(partial: Partial<UserSettings['ui']>) {
    settings.value.ui = { ...settings.value.ui, ...partial }
    saveToStorage()
  }

  // 更新编辑器设置
  function updateEditor(partial: Partial<UserSettings['editor']>) {
    settings.value.editor = { ...settings.value.editor, ...partial }
    saveToStorage()
  }

  // 更新数据设置
  function updateData(partial: Partial<UserSettings['data']>) {
    settings.value.data = { ...settings.value.data, ...partial }
    saveToStorage()
  }

  // 重置为默认值
  function reset() {
    settings.value = { ...defaultSettings }
    saveToStorage()
  }

  // 导入设置
  function importSettings(data: Partial<UserSettings>) {
    settings.value = { ...defaultSettings, ...data }
    saveToStorage()
  }

  // 导出设置
  function exportSettings(): UserSettings {
    return { ...settings.value }
  }

  return {
    settings,
    loading,
    loadFromStorage,
    saveToStorage,
    updateNotifications,
    updateUI,
    updateEditor,
    updateData,
    reset,
    importSettings,
    exportSettings,
  }
})