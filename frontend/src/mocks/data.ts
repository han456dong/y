/**
 * Mock数据 - 用户相关
 */

import type { UserInfo, RoleInfo } from '@/apis/modules/user'

// 模拟角色数据
export const mockRoles: RoleInfo[] = [
  {
    id: 1,
    name: '超级管理员',
    code: 'super_admin',
    description: '拥有系统所有权限',
  },
  {
    id: 2,
    name: '管理员',
    code: 'admin',
    description: '拥有大部分管理权限',
  },
  {
    id: 3,
    name: '普通用户',
    code: 'user',
    description: '普通用户权限',
  },
  {
    id: 4,
    name: '访客',
    code: 'guest',
    description: '只读权限',
  },
]

// 模拟权限数据
export const mockPermissions = [
  'dashboard:view',
  'system:manage',
  'system:user:view',
  'system:user:create',
  'system:user:edit',
  'system:user:delete',
  'system:role:view',
  'system:permission:view',
  'monitor:view',
  'monitor:online:view',
  'monitor:server:view',
  'monitor:cache:view',
]

// 模拟用户数据
export const mockUsers: UserInfo[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@chenguang.com',
    full_name: '系统管理员',
    phone: '13800138001',
    avatar: '',
    status: 1,
    status_label: '启用',
    roles: [mockRoles[0]],
    last_login_at: '2024-11-01 10:30:00',
    last_login_ip: '192.168.1.100',
    created_at: '2024-01-01 08:00:00',
    updated_at: '2024-11-01 10:30:00',
  },
  {
    id: 2,
    username: 'zhangsan',
    email: 'zhangsan@chenguang.com',
    full_name: '张三',
    phone: '13800138002',
    avatar: '',
    status: 1,
    status_label: '启用',
    roles: [mockRoles[2]],
    last_login_at: '2024-10-31 16:20:00',
    last_login_ip: '192.168.1.101',
    created_at: '2024-02-15 09:00:00',
    updated_at: '2024-10-31 16:20:00',
  },
  {
    id: 3,
    username: 'lisi',
    email: 'lisi@chenguang.com',
    full_name: '李四',
    phone: '13800138003',
    avatar: '',
    status: 1,
    status_label: '启用',
    roles: [mockRoles[2]],
    last_login_at: '2024-10-30 14:15:00',
    last_login_ip: '192.168.1.102',
    created_at: '2024-03-20 10:30:00',
    updated_at: '2024-10-30 14:15:00',
  },
  {
    id: 4,
    username: 'wangwu',
    email: 'wangwu@chenguang.com',
    full_name: '王五',
    phone: '13800138004',
    avatar: '',
    status: 0,
    status_label: '禁用',
    roles: [mockRoles[3]],
    last_login_at: '2024-09-15 11:00:00',
    last_login_ip: '192.168.1.103',
    created_at: '2024-04-10 15:00:00',
    updated_at: '2024-09-15 11:00:00',
  },
  {
    id: 5,
    username: 'zhaoliu',
    email: 'zhaoliu@chenguang.com',
    full_name: '赵六',
    phone: '13800138005',
    avatar: '',
    status: 1,
    status_label: '启用',
    roles: [mockRoles[1]],
    last_login_at: '2024-10-28 09:45:00',
    last_login_ip: '192.168.1.104',
    created_at: '2024-05-05 08:30:00',
    updated_at: '2024-10-28 09:45:00',
  },
]

// 分页响应
export function paginateUsers(
  users: UserInfo[],
  page: number,
  page_size: number,
  keyword?: string,
  status?: number,
  role_id?: number
) {
  let filtered = [...users]

  if (keyword) {
    filtered = filtered.filter(
      (u) =>
        u.username.includes(keyword) ||
        u.email.includes(keyword) ||
        u.full_name.includes(keyword)
    )
  }

  if (status !== undefined) {
    filtered = filtered.filter((u) => u.status === status)
  }

  if (role_id !== undefined) {
    filtered = filtered.filter((u) => u.roles.some((r) => r.id === role_id))
  }

  const total = filtered.length
  const total_pages = Math.ceil(total / page_size)
  const start = (page - 1) * page_size
  const items = filtered.slice(start, start + page_size)

  return {
    items,
    total,
    page,
    page_size,
    total_pages,
  }
}