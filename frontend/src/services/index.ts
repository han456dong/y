/**
 * Service层统一导出
 */

export { BaseService, type BaseServiceConfig, type ServiceState, type PaginationParams, type PaginationResponse } from './base'
export { authService } from './auth'
export { userService } from './user'
// 可继续添加更多服务
// export { roleService } from './role'
// export { permissionService } from './permission'
// export { agentService } from './agent'
// export { modelService } from './model'
// export { knowledgeService } from './knowledge'