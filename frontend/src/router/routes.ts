/**
 * 路由配置 - 路由表定义
 */

import type { RouteRecordRaw } from 'vue-router'

// 使用懒加载避免循环依赖
const Layout = () => import('@/components/layout/Layout.vue')

/**
 * 静态路由（无需权限的路由）
 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/index.vue'),
    meta: {
      title: '登录',
      hideInMenu: true,
      requiresAuth: false,
    },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/pages/error/403.vue'),
    meta: {
      title: '无权限',
      hideInMenu: true,
      requiresAuth: false,
    },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/pages/error/404.vue'),
    meta: {
      title: '页面未找到',
      hideInMenu: true,
      requiresAuth: false,
    },
  },
  {
    path: '/500',
    name: 'ServerError',
    component: () => import('@/pages/error/500.vue'),
    meta: {
      title: '服务器错误',
      hideInMenu: true,
      requiresAuth: false,
    },
  },
]

/**
 * 异步路由（需要权限的路由）
 * 根据用户角色动态加载
 */
export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Root',
    component: Layout,
    redirect: '/dashboard',
    meta: {
      title: '首页',
      icon: 'Home',
      hideInMenu: false,
    },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/index.vue'),
        meta: {
          title: '仪表盘',
          icon: 'Monitor',
          requiresAuth: true,
          permissions: ['dashboard:view'],
        },
      },
    ],
  },
  {
    path: '/system',
    name: 'System',
    component: Layout,
    redirect: '/system/user',
    meta: {
      title: '系统管理',
      icon: 'Setting',
      requiresAuth: true,
      permissions: ['system:manage'],
    },
    children: [
      {
        path: 'user',
        name: 'UserManagement',
        component: () => import('@/pages/system/user/index.vue'),
        meta: {
          title: '用户管理',
          icon: 'User',
          requiresAuth: true,
          permissions: ['system:user:view'],
        },
      },
      {
        path: 'role',
        name: 'RoleManagement',
        component: () => import('@/pages/system/role/index.vue'),
        meta: {
          title: '角色管理',
          icon: 'Shield',
          requiresAuth: true,
          permissions: ['system:role:view'],
        },
      },
      {
        path: 'permission',
        name: 'PermissionManagement',
        component: () => import('@/pages/system/permission/index.vue'),
        meta: {
          title: '权限管理',
          icon: 'Key',
          requiresAuth: true,
          permissions: ['system:permission:view'],
        },
      },
      {
        path: 'department',
        name: 'DepartmentManagement',
        component: () => import('@/pages/system/department/index.vue'),
        meta: {
          title: '部门管理',
          icon: 'Building',
          requiresAuth: true,
          permissions: ['system:department:view'],
        },
      },
      {
        path: 'menu',
        name: 'MenuManagement',
        component: () => import('@/pages/system/menu/index.vue'),
        meta: {
          title: '菜单管理',
          icon: 'Menu',
          requiresAuth: true,
          permissions: ['system:menu:view'],
        },
      },
      {
        path: 'dict',
        name: 'DictManagement',
        component: () => import('@/pages/system/dict/index.vue'),
        meta: {
          title: '字典管理',
          icon: 'BookOpen',
          requiresAuth: true,
          permissions: ['system:dict:view'],
        },
      },
      {
        path: 'config',
        name: 'ConfigManagement',
        component: () => import('@/pages/system/config/index.vue'),
        meta: {
          title: '参数配置',
          icon: 'SlidersHorizontal',
          requiresAuth: true,
          permissions: ['system:config:view'],
        },
      },
      {
        path: 'log/login',
        name: 'LoginLog',
        component: () => import('@/pages/system/log/login.vue'),
        meta: {
          title: '登录日志',
          icon: 'LogIn',
          requiresAuth: true,
          permissions: ['system:log:login:view'],
        },
      },
      {
        path: 'log/operation',
        name: 'OperationLog',
        component: () => import('@/pages/system/log/operation.vue'),
        meta: {
          title: '操作日志',
          icon: 'FileText',
          requiresAuth: true,
          permissions: ['system:log:operation:view'],
        },
      },
    ],
  },
  {
    path: '/monitor',
    name: 'Monitor',
    component: Layout,
    redirect: '/monitor/online',
    meta: {
      title: '系统监控',
      icon: 'Activity',
      requiresAuth: true,
      permissions: ['monitor:view'],
    },
    children: [
      {
        path: 'online',
        name: 'OnlineUser',
        component: () => import('@/pages/monitor/online/index.vue'),
        meta: {
          title: '在线用户',
          icon: 'Users',
          requiresAuth: true,
          permissions: ['monitor:online:view'],
        },
      },
      {
        path: 'server',
        name: 'ServerMonitor',
        component: () => import('@/pages/monitor/server/index.vue'),
        meta: {
          title: '服务监控',
          icon: 'Server',
          requiresAuth: true,
          permissions: ['monitor:server:view'],
        },
      },
      {
        path: 'cache',
        name: 'CacheMonitor',
        component: () => import('@/pages/monitor/cache/index.vue'),
        meta: {
          title: '缓存监控',
          icon: 'Database',
          requiresAuth: true,
          permissions: ['monitor:cache:view'],
        },
      },
    ],
  },
  {
    path: '/profile',
    name: 'Profile',
    component: Layout,
    redirect: '/profile/index',
    meta: {
      title: '个人中心',
      icon: 'UserCog',
      hideInMenu: true,
      requiresAuth: true,
    },
    children: [
      {
        path: 'index',
        name: 'ProfileIndex',
        component: () => import('@/pages/profile/index.vue'),
        meta: {
          title: '个人信息',
          requiresAuth: true,
        },
      },
      {
        path: 'password',
        name: 'ChangePassword',
        component: () => import('@/pages/profile/password.vue'),
        meta: {
          title: '修改密码',
          requiresAuth: true,
        },
      },
    ],
  },
]

/**
 * 路由白名单（不需要登录即可访问）
 */
export const whiteList = ['/login', '/403', '/404', '/500']

/**
 * 获取所有路由（静态 + 异步）
 */
export function getAllRoutes(): RouteRecordRaw[] {
  return [...constantRoutes, ...asyncRoutes]
}