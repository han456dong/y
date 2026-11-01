import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './store/modules/auth'
import { useAppStore } from './store/modules/app'
import { useSettingsStore } from './store/modules/settings'
import './style.css'

/**
 * 应用启动流程
 * 1. 开发环境按需启动 Mock Server（MSW）
 * 2. 注册 Pinia / Element Plus / 图标 / 路由
 * 3. 初始化各模块状态
 * 4. 挂载应用
 */
async function bootstrap() {
  // 开发环境 + 开启Mock时才启动，避免影响真实后端联调
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true') {
    const { startMockServer } = await import('./mocks/browser')
    await startMockServer()
  }

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(ElementPlus, {
    locale: zhCn,
    size: 'default',
  })

  // 注册全部Element Plus图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(router)

  // 初始化状态
  useAuthStore(pinia).initialize()
  useAppStore(pinia).initialize()
  useSettingsStore(pinia).loadFromStorage()

  app.mount('#app')
}

bootstrap()
