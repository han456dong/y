/**
 * API层 - Axios封装
 * 统一管理HTTP请求，包含拦截器、错误处理、请求/响应转换
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

// 响应数据通用接口
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
  timestamp: number
}

// 请求配置扩展
export interface RequestConfig extends AxiosRequestConfig {
  // 是否显示错误提示
  showError?: boolean
  // 是否显示加载状态
  showLoading?: boolean
  // 自定义错误处理
  customErrorHandler?: (error: ApiError) => void
}

// API错误类型
export interface ApiError {
  code: number
  message: string
  details?: unknown
}

// 默认配置
const DEFAULT_CONFIG: RequestConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  showError: true,
  showLoading: false,
}

/**
 * 创建Axios实例
 */
function createAxiosInstance(config: RequestConfig = {}): AxiosInstance {
  const instance = axios.create({ ...DEFAULT_CONFIG, ...config })

  // 请求拦截器
  instance.interceptors.request.use(
    (requestConfig: InternalAxiosRequestConfig) => {
      // 添加认证token
      const token = localStorage.getItem('access_token')
      if (token && requestConfig.headers) {
        requestConfig.headers.Authorization = `Bearer ${token}`
      }

      // 添加请求时间戳
      requestConfig.headers['X-Request-Time'] = Date.now().toString()

      return requestConfig
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // 响应拦截器
  instance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const { data } = response

      // 业务成功码判断
      if (data.code === 200 || data.code === 0) {
        // 直接返回业务数据（类型断言，绕过axios严格类型检查）
        return data.data as unknown as AxiosResponse
      }

      // 业务错误处理
      const error: ApiError = {
        code: data.code,
        message: data.message || '请求失败',
        details: data.data,
      }

      // 显示错误提示
      if ((response.config as RequestConfig).showError !== false) {
        ElMessage.error(error.message)
      }

      return Promise.reject(error)
    },
    (error) => {
      // HTTP错误处理
      const apiError: ApiError = {
        code: error.response?.status || 500,
        message: error.response?.data?.message || error.message || '网络错误',
        details: error.response?.data,
      }

      // 401 未授权 - 跳转登录
      if (apiError.code === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(apiError)
      }

      // 403 禁止访问
      if (apiError.code === 403) {
        ElMessage.error('权限不足，无法访问')
        return Promise.reject(apiError)
      }

      // 404 未找到
      if (apiError.code === 404) {
        ElMessage.error('请求的资源不存在')
        return Promise.reject(apiError)
      }

      // 5xx 服务器错误
      if (apiError.code >= 500) {
        ElMessage.error('服务器内部错误，请稍后重试')
        return Promise.reject(apiError)
      }

      // 显示错误提示
      if ((error.config as RequestConfig)?.showError !== false) {
        ElMessage.error(apiError.message)
      }

      return Promise.reject(apiError)
    }
  )

  return instance
}

// 创建默认实例
const http = createAxiosInstance()

/**
 * 请求方法封装
 * 注意：响应拦截器已解包业务数据，这里通过类型断言适配
 */
export const request = {
  get<T = unknown>(url: string, params?: object, config?: RequestConfig): Promise<T> {
    return http.get(url, { params, ...config }) as unknown as Promise<T>
  },

  post<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return http.post(url, data, config) as unknown as Promise<T>
  },

  put<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return http.put(url, data, config) as unknown as Promise<T>
  },

  patch<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return http.patch(url, data, config) as unknown as Promise<T>
  },

  delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return http.delete(url, config) as unknown as Promise<T>
  },

  // 文件上传
  upload<T = unknown>(url: string, file: File, onProgress?: (progress: number) => void, config?: RequestConfig): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    return http.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    }) as unknown as Promise<T>
  },

  // 文件下载
  download(url: string, filename?: string, config?: RequestConfig): Promise<void> {
    return http
      .get(url, {
        ...config,
        responseType: 'blob',
      })
      .then((response) => {
        const blob = response as unknown as Blob
        const objectUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = filename || 'download'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(objectUrl)
      })
  },
}

/**
 * 创建带有特定基础路径的API实例
 */
export function createApi(baseURL: string): typeof request {
  const instance = createAxiosInstance({ baseURL })
  return {
    get<T = unknown>(url: string, params?: object, config?: RequestConfig): Promise<T> {
      return instance.get(url, { params, ...config }) as unknown as Promise<T>
    },
    post<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
      return instance.post(url, data, config) as unknown as Promise<T>
    },
    put<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
      return instance.put(url, data, config) as unknown as Promise<T>
    },
    patch<T = unknown>(url: string, data?: object, config?: RequestConfig): Promise<T> {
      return instance.patch(url, data, config) as unknown as Promise<T>
    },
    delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
      return instance.delete(url, config) as unknown as Promise<T>
    },
    upload<T = unknown>(url: string, file: File, onProgress?: (progress: number) => void, config?: RequestConfig): Promise<T> {
      const formData = new FormData()
      formData.append('file', file)
      return instance.post(url, formData, {
        ...config,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
          }
        },
      }) as unknown as Promise<T>
    },
    download(url: string, filename?: string, config?: RequestConfig): Promise<void> {
      return instance
        .get(url, { ...config, responseType: 'blob' })
        .then((response) => {
          const blob = response as unknown as Blob
          const objectUrl = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = objectUrl
          link.download = filename || 'download'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(objectUrl)
        })
    },
  }
}

export default http