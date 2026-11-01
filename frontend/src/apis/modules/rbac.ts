/**
 * API模块 - RBAC V2（用户 / 角色 / 权限 / 权限树）
 * 接口契约对齐 docs/spec/PROJECT_SPEC_V2.md 第 7 章与 rbac-plan.md
 */

import { request } from '../index'

/* ============================================================
 * 数据类型
 * ============================================================ */

/** 权限（PermissionRead 扩展 module/action/is_system/sort_order） */
export interface Permission {
  id: number
  code: string
  name: string
  description: string | null
  module: string
  action: string
  is_system: boolean
  sort_order: number
}

/** 精简角色（UserRead.roles） */
export interface RoleLite {
  id: number
  code: string
  name: string
}

/** 角色（RoleRead 扩展 is_system/user_count） */
export interface Role {
  id: number
  code: string
  name: string
  description: string | null
  is_system: boolean
  sort_order: number
  user_count: number
  permissions: Permission[]
}

/** 用户（UserRead 扩展 roles/is_superuser/last_login） */
export interface User {
  id: number
  username: string
  email: string
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  roles: RoleLite[]
}

/** 用户详情（含角色） */
export interface UserWithRoles extends User {
  roles: RoleLite[]
}

/** 分页结果 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/** 当前用户权限上下文（PRD 7.2.1） */
export interface PermissionContext {
  user_id: number
  username: string
  is_superuser: boolean
  roles: RoleLite[]
  permissions: string[]
  permission_version: number
  cached_at: string
}

/** 权限树分组（PRD 7.2.2） */
export interface PermissionTreeGroup {
  module: string
  module_name: string
  permissions: Array<{
    id: number
    code: string
    name: string
    action: string
    is_system: boolean
    sort_order: number
  }>
}

/* -------- 请求体 -------- */

export interface UserCreateParams {
  username: string
  email: string
  password: string
}

export interface UserUpdateParams {
  email?: string
  is_active?: boolean
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

export interface PageQuery {
  page?: number
  page_size?: number
  keyword?: string
}

/** 权限码格式（PRD 4.2） */
export const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$/

/* ============================================================
 * 用户接口
 * ============================================================ */

/** GET /v1/users —— 列表（offset / limit） */
export function getUsersApi(params?: { offset?: number; limit?: number }): Promise<User[]> {
  return request.get('/v1/users', params)
}

/** POST /v1/users —— 创建用户 */
export function createUserApi(data: UserCreateParams): Promise<User> {
  return request.post('/v1/users', data)
}

/** GET /v1/users/search —— 分页搜索用户 */
export function searchUsersApi(params: PageQuery): Promise<PageResult<User>> {
  return request.get('/v1/users/search', params)
}

/** GET /v1/users/me —— 当前登录用户 */
export function getCurrentUserApi(): Promise<User> {
  return request.get('/v1/users/me')
}

/** GET /v1/users/me/permissions —— 当前用户权限上下文 */
export function getMyPermissionsApi(): Promise<PermissionContext> {
  return request.get('/v1/users/me/permissions')
}

/** GET /v1/users/{user_id} —— 用户详情 */
export function getUserApi(userId: number): Promise<UserWithRoles> {
  return request.get(`/v1/users/${userId}`)
}

/** GET /v1/users/{user_id}/roles —— 用户角色列表 */
export function getUserRolesApi(userId: number): Promise<RoleLite[]> {
  return request.get(`/v1/users/${userId}/roles`)
}

/** PUT /v1/users/{user_id}/roles —— 分配用户角色 */
export function assignUserRolesApi(userId: number, data: UserAssignRolesParams): Promise<UserWithRoles> {
  return request.put(`/v1/users/${userId}/roles`, data)
}

/** PUT /v1/users/{user_id} —— 更新用户（邮箱/启停） */
export function updateUserApi(userId: number, data: UserUpdateParams): Promise<User> {
  return request.put(`/v1/users/${userId}`, data)
}

/** DELETE /v1/users/{user_id} —— 删除用户 */
export function deleteUserApi(userId: number): Promise<null> {
  return request.delete(`/v1/users/${userId}`)
}

/* ============================================================
 * 角色接口
 * ============================================================ */

/** GET /v1/roles/ —— 所有角色 */
export function getRolesApi(): Promise<Role[]> {
  return request.get('/v1/roles/')
}

/** POST /v1/roles —— 创建角色 */
export function createRoleApi(data: RoleCreateParams): Promise<Role> {
  return request.post('/v1/roles', data)
}

/** GET /v1/roles/search —— 分页搜索角色 */
export function searchRolesApi(params: PageQuery): Promise<PageResult<Role>> {
  return request.get('/v1/roles/search', params)
}

/** GET /v1/roles/{role_id} —— 角色详情 */
export function getRoleApi(roleId: number): Promise<Role> {
  return request.get(`/v1/roles/${roleId}`)
}

/** PUT /v1/roles/{role_id} —— 更新角色 */
export function updateRoleApi(roleId: number, data: RoleUpdateParams): Promise<Role> {
  return request.put(`/v1/roles/${roleId}`, data)
}

/** DELETE /v1/roles/{role_id} —— 删除角色 */
export function deleteRoleApi(roleId: number): Promise<null> {
  return request.delete(`/v1/roles/${roleId}`)
}

/** PUT /v1/roles/{role_id}/permissions —— 分配角色权限 */
export function assignRolePermissionsApi(roleId: number, data: RoleAssignPermissionsParams): Promise<Role> {
  return request.put(`/v1/roles/${roleId}/permissions`, data)
}

/* ============================================================
 * 权限接口
 * ============================================================ */

/** GET /v1/permissions/ —— 所有权限 */
export function getPermissionsApi(): Promise<Permission[]> {
  return request.get('/v1/permissions/')
}

/** GET /v1/permissions/tree —— 权限树（按模块分组） */
export function getPermissionTreeApi(): Promise<PermissionTreeGroup[]> {
  return request.get('/v1/permissions/tree')
}

/** POST /v1/permissions —— 创建权限 */
export function createPermissionApi(data: PermissionCreateParams): Promise<Permission> {
  return request.post('/v1/permissions', data)
}

/** GET /v1/permissions/search —— 分页搜索权限（支持模块筛选） */
export function searchPermissionsApi(params: PageQuery & { module?: string }): Promise<PageResult<Permission>> {
  return request.get('/v1/permissions/search', params)
}

/** GET /v1/permissions/{permission_id} —— 权限详情 */
export function getPermissionApi(permissionId: number): Promise<Permission> {
  return request.get(`/v1/permissions/${permissionId}`)
}

/** PUT /v1/permissions/{permission_id} —— 更新权限 */
export function updatePermissionApi(permissionId: number, data: PermissionUpdateParams): Promise<Permission> {
  return request.put(`/v1/permissions/${permissionId}`, data)
}

/** DELETE /v1/permissions/{permission_id} —— 删除权限（内置权限受保护） */
export function deletePermissionApi(permissionId: number): Promise<null> {
  return request.delete(`/v1/permissions/${permissionId}`)
}

/* ============================================================
 * 工具方法
 * ============================================================ */

/** 从权限码推断模块（system.user:read -> system.user） */
export function getPermissionModule(code: string): string {
  return code.split(':')[0] || code
}

/** 校验权限码格式 */
export function isValidPermissionCode(code: string): boolean {
  return PERMISSION_CODE_PATTERN.test(code)
}
