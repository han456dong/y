/**
 * API模块 - 用户管理相关接口
 */

import { request } from '../index'

// 用户查询参数
export interface UserQueryParams {
  page: number
  page_size: number
  keyword?: string
  status?: number
  role_id?: number
  department_id?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// 用户列表响应
export interface UserListResponse {
  items: UserInfo[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// 用户详细信息
export interface UserInfo {
  id: number
  username: string
  email: string
  full_name: string
  phone?: string
  avatar?: string
  status: number
  status_label: string
  roles: RoleInfo[]
  department?: DepartmentInfo
  last_login_at?: string
  last_login_ip?: string
  created_at: string
  updated_at: string
}

// 角色信息
export interface RoleInfo {
  id: number
  name: string
  code: string
  description?: string
}

// 部门信息
export interface DepartmentInfo {
  id: number
  name: string
  code: string
}

// 创建用户请求
export interface CreateUserParams {
  username: string
  email: string
  password: string
  full_name: string
  phone?: string
  role_ids: number[]
  department_id?: number
  status?: number
}

// 更新用户请求
export interface UpdateUserParams {
  email?: string
  full_name?: string
  phone?: string
  avatar?: string
  role_ids?: number[]
  department_id?: number
  status?: number
}

// 重置密码请求
export interface ResetPasswordParams {
  password: string
  confirm_password: string
}

/**
 * 获取用户列表
 */
export function getUserListApi(params: UserQueryParams): Promise<UserListResponse> {
  return request.get('/users', params)
}

/**
 * 获取用户详情
 */
export function getUserDetailApi(id: number): Promise<UserInfo> {
  return request.get(`/users/${id}`)
}

/**
 * 创建用户
 */
export function createUserApi(data: CreateUserParams): Promise<UserInfo> {
  return request.post('/users', data)
}

/**
 * 更新用户
 */
export function updateUserApi(id: number, data: UpdateUserParams): Promise<UserInfo> {
  return request.put(`/users/${id}`, data)
}

/**
 * 删除用户
 */
export function deleteUserApi(id: number): Promise<void> {
  return request.delete(`/users/${id}`)
}

/**
 * 批量删除用户
 */
export function batchDeleteUsersApi(ids: number[]): Promise<void> {
  return request.post('/users/batch-delete', { ids })
}

/**
 * 重置用户密码
 */
export function resetUserPasswordApi(id: number, data: ResetPasswordParams): Promise<void> {
  return request.post(`/users/${id}/reset-password`, data)
}

/**
 * 启用/禁用用户
 */
export function toggleUserStatusApi(id: number, status: number): Promise<void> {
  return request.patch(`/users/${id}/status`, { status })
}

/**
 * 获取用户角色选项
 */
export function getUserRoleOptionsApi(): Promise<RoleInfo[]> {
  return request.get('/users/role-options')
}

/**
 * 导出用户数据
 */
export function exportUsersApi(params: UserQueryParams): Promise<Blob> {
  return request.get('/users/export', params, { responseType: 'blob' })
}

/**
 * 导入用户数据
 */
export function importUsersApi(file: File): Promise<{ success: number; failed: number; errors: string[] }> {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/users/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}