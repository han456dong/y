/// <reference types="vite/client" />

// 模块声明
declare module 'nprogress' {
  interface NProgress {
    start(): NProgress
    done(): NProgress
    set(value: number): NProgress
    inc(): NProgress
    configure(options: Record<string, unknown>): NProgress
  }
  const nprogress: NProgress
  export default nprogress
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  readonly VITE_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
