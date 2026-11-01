/**
 * API模块 - RBAC（用户 / 角色 / 权限）
 * 接口契约严格对齐 docs/openapi.json 的 /api/v1/* 定义
 */

import { request } from '../index'

/* ============================================================
 * 数据类型（与后端 Schema 一一对应）
 * ============================================================ */

/** 权限 */
export interface Permission {
  id: number
  code: string
  name: string
  description: string | null
}

/** 角色 */
export interface Role {
  id: number
  code: string
  name: string
  description: string | null
  permissions: Permission[]
}

/** 用户 */
export interface User {
  id: number
  username: string
  email: string
  is_active: boolean
}

/** 用户（含角色） */
export interface UserWithRoles extends User {
  roles: Role[]
}

/**
 * 用户列表项：后端 UserRead 为基础，
 * Mock 额外返回 roles 以便列表直接展示角色标签（可选字段）
 */
export interface UserListItem extends User {
  roles?: Role[]
}

/** 分页结果 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/* -------- 请求体 -------- */

export interface UserCreateParams {
  username: string
  email: string
  password: string
}

export interface UserAssignRolesParams {
  role_ids: number[]
}

export interface RoleCreateParams {
  code: string
  name: string
  description?: string | null
}

export interface RoleUpdateParams {
  name?: string | null
  description?: string | null
}

export interface RoleAssignPermissionsParams {
  permission_ids: number[]
}

export interface PermissionCreateParams {
  code: string
  name: string
  description?: string | null
}

export interface PermissionUpdateParams {
  name?: string | null
  description?: string | null
}

/** 分页查询参数 */
export interface PageQuery {
  page?: number
  page_size?: number
  keyword?: string
}

/* ============================================================
 * 用户接口
 * ============================================================ */

/** GET /api/v1/users —— 列表（offset / limit） */
export function getUsersApi(params?: { offset?: number; limit?: number }): Promise<UserListItem[]> {
  return request.get('/v1/users', params)
}

/** POST /api/v1/users —— 创建用户 */
export function createUserApi(data: UserCreateParams): Promise<User> {
  return request.post('/v1/users', data)
}

/** GET /api/v1/users/search —— 分页搜索用户 */
export function searchUsersApi(params: PageQuery): Promise<PageResult<UserListItem>> {
  return request.get('/v1/users/search', params)
}

/** GET /api/v1/users/me —— 获取当前登录用户信息 */
export function getCurrentUserApi(): Promise<UserWithRoles> {
  return request.get('/v1/users/me')
}

/** GET /api/v1/users/{user_id} —— 用户详情（含角色） */
export function getUserApi(userId: number): Promise<UserWithRoles> {
  return request.get(`/v1/users/${userId}`)
}

/** GET /api/v1/users/{user_id}/roles —— 用户角色列表 */
export function getUserRolesApi(userId: number): Promise<Role[]> {
  return request.get(`/v1/users/${userId}/roles`)
}

/** PUT /api/v1/users/{user_id}/roles —— 分配用户角色 */
export function assignUserRolesApi(userId: number, data: UserAssignRolesParams): Promise<UserWithRoles> {
  return request.put(`/v1/users/${userId}/roles`, data)
}

/* ============================================================
 * 角色接口
 * ============================================================ */

/** GET /api/v1/roles/ —— 获取所有角色 */
export function getRolesApi(): Promise<Role[]> {
  return request.get('/v1/roles/')
}

/** POST /api/v1/roles —— 创建角色 */
export function createRoleApi(data: RoleCreateParams): Promise<Role> {
  return request.post('/v1/roles', data)
}

/** GET /api/v1/roles/search —— 分页搜索角色 */
export function searchRolesApi(params: PageQuery): Promise<PageResult<Role>> {
  return request.get('/v1/roles/search', params)
}

/** GET /api/v1/roles/{role_id} —— 角色详情 */
export function getRoleApi(roleId: number): Promise<Role> {
  return request.get(`/v1/roles/${roleId}`)
}

/** PUT /api/v1/roles/{role_id} —— 更新角色 */
export function updateRoleApi(roleId: number, data: RoleUpdateParams): Promise<Role> {
  return request.put(`/v1/roles/${roleId}`, data)
}

/** DELETE /api/v1/roles/{role_id} —— 删除角色 */
export function deleteRoleApi(roleId: number): Promise<null> {
  return request.delete(`/v1/roles/${roleId}`)
}

/** PUT /api/v1/roles/{role_id}/permissions —— 分配角色权限 */
export function assignRolePermissionsApi(roleId: number, data: RoleAssignPermissionsParams): Promise<Role> {
  return request.put(`/v1/roles/${roleId}/permissions`, data)
}

/* ============================================================
 * 权限接口
 * ============================================================ */

/** GET /api/v1/permissions/ —— 获取所有权限 */
export function getPermissionsApi(): Promise<Permission[]> {
  return request.get('/v1/permissions/')
}

/** POST /api/v1/permissions —— 创建权限 */
export function createPermissionApi(data: PermissionCreateParams): Promise<Permission> {
  return request.post('/v1/permissions', data)
}

/** GET /api/v1/permissions/search —— 分页搜索权限 */
export function searchPermissionsApi(params: PageQuery): Promise<PageResult<Permission>> {
  return request.get('/v1/permissions/search', params)
}

/** GET /api/v1/permissions/{permission_id} —— 权限详情 */
export function getPermissionApi(permissionId: number): Promise<Permission> {
  return request.get(`/v1/permissions/${permissionId}`)
}

/** PUT /api/v1/permissions/{permission_id} —— 更新权限 */
export function updatePermissionApi(permissionId: number, data: PermissionUpdateParams): Promise<Permission> {
  return request.put(`/v1/permissions/${permissionId}`, data)
}

/** DELETE /api/v1/permissions/{permission_id} —— 删除权限 */
export function deletePermissionApi(permissionId: number): Promise<null> {
  return request.delete(`/v1/permissions/${permissionId}`)
}

/* ============================================================
 * 工具方法
 * ============================================================ */

/**
 * 从权限编码推断所属模块，例如 system:user:view -> system
 */
export function getPermissionModule(code: string): string {
  return code.split(':')[0] || code
}
