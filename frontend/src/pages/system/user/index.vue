<template>
  <PageContainer title="用户管理" subtitle="创建用户账号并为用户分配角色">
    <template #actions>
      <el-button type="primary" @click="openCreateDialog">
        <Plus /> 新建用户
      </el-button>
    </template>

    <!-- 搜索 -->
    <SearchForm v-model="searchParams" :loading="userService.loading.value" @search="handleSearch" @reset="handleReset">
      <template #fields="{ form, setField }">
        <el-form-item label="关键字">
          <el-input
            :model-value="form.keyword"
            placeholder="用户名 / 邮箱"
            clearable
            @update:model-value="(v) => setField('keyword', v)"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <!-- 列表 -->
    <DataTable
      :data="userService.items.value"
      :loading="userService.loading.value"
      :current-page="userService.pagination.value.page"
      :page-size="userService.pagination.value.page_size"
      :total="userService.pagination.value.total"
      :page-sizes="[10, 20, 50]"
      show-export
      empty-text="暂无用户，点击右上角新建用户"
      @refresh="loadUsers"
      @export="handleExport"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    >
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" min-width="140">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="28">{{ avatarText(row.username) }}</el-avatar>
            <span class="username">{{ row.username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="220">
        <template #default="{ row }">
          <template v-if="row.roles?.length">
            <el-tag
              v-for="role in row.roles"
              :key="role.id"
              size="small"
              effect="plain"
              class="role-tag"
            >
              {{ role.name }}
            </el-tag>
          </template>
          <span v-else class="muted">未分配</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row.id)">
            <View /> 详情
          </el-button>
          <el-button link type="warning" size="small" @click="openAssignDialog(row as UserListItem)">
            <Avatar /> 分配角色
          </el-button>
        </template>
      </el-table-column>
    </DataTable>

    <!-- 新建用户 -->
    <el-dialog v-model="createVisible" title="新建用户" width="460px" destroy-on-close>
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="84px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="3-50 个字符" clearable />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createForm.email" placeholder="name@example.com" clearable />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分配角色 -->
    <el-dialog v-model="assignVisible" title="分配角色" width="460px" destroy-on-close>
      <p class="dialog-hint">
        用户：<strong>{{ assignTarget?.username }}</strong>，勾选后保存立即生效。
      </p>
      <el-checkbox-group v-model="selectedRoleIds" class="role-options">
        <el-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id" border>
          <div class="role-option">
            <span class="role-name">{{ role.name }}</span>
            <span class="role-code">{{ role.code }}</span>
          </div>
        </el-checkbox>
      </el-checkbox-group>
      <el-empty v-if="!roleOptions.length && !assignLoading" description="暂无可用角色" :image-size="60" />
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="submitAssign">保存</el-button>
      </template>
    </el-dialog>

    <!-- 用户详情 -->
    <el-drawer v-model="detailVisible" title="用户详情" size="420px" destroy-on-close>
      <div v-if="detailLoading" class="detail-loading">
        <el-skeleton :rows="5" animated />
      </div>
      <template v-else-if="userService.detail.value">
        <div class="detail-head">
          <el-avatar :size="48">{{ avatarText(userService.detail.value.username) }}</el-avatar>
          <div>
            <h3>{{ userService.detail.value.username }}</h3>
            <p>{{ userService.detail.value.email }}</p>
          </div>
          <el-tag :type="userService.detail.value.is_active ? 'success' : 'info'" size="small">
            {{ userService.detail.value.is_active ? '启用' : '禁用' }}
          </el-tag>
        </div>

        <el-descriptions :column="1" border class="detail-desc">
          <el-descriptions-item label="用户 ID">{{ userService.detail.value.id }}</el-descriptions-item>
          <el-descriptions-item label="角色数量">{{ userService.detail.value.roles.length }}</el-descriptions-item>
          <el-descriptions-item label="权限数量">{{ detailPermissionCodes.length }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="detail-section-title">角色</h4>
        <div class="detail-tags">
          <el-tag v-for="role in userService.detail.value.roles" :key="role.id" effect="plain">
            {{ role.name }}（{{ role.code }}）
          </el-tag>
          <span v-if="!userService.detail.value.roles.length" class="muted">未分配角色</span>
        </div>

        <h4 class="detail-section-title">权限</h4>
        <div class="detail-tags">
          <el-tag
            v-for="code in detailPermissionCodes"
            :key="code"
            size="small"
            type="info"
          >
            {{ code }}
          </el-tag>
          <span v-if="!detailPermissionCodes.length" class="muted">暂无权限</span>
        </div>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  ElButton, ElForm, ElFormItem, ElInput, ElDialog, ElDrawer, ElCheckboxGroup,
  ElCheckbox, ElAvatar, ElTag, ElTableColumn, ElEmpty, ElDescriptions,
  ElDescriptionsItem, ElSkeleton, ElMessage,
} from 'element-plus'
import { Plus, View, Avatar } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import PageContainer from '@/components/common/PageContainer.vue'
import SearchForm from '@/components/common/SearchForm.vue'
import DataTable from '@/components/common/DataTable.vue'
import { rbacUserService } from '@/services/rbac'
import { useRbacStore } from '@/store/modules/rbac'
import type { UserListItem } from '@/apis/modules/rbac'

const userService = rbacUserService
const rbacStore = useRbacStore()

const searchParams = reactive({ keyword: '' })

/* ---------- 列表 ---------- */

const loadUsers = () => {
  userService.load({ keyword: searchParams.keyword || undefined })
}

const handleSearch = () => {
  userService.load({ keyword: searchParams.keyword || undefined, page: 1 })
}

const handleReset = () => {
  searchParams.keyword = ''
  userService.load({ keyword: undefined, page: 1 })
}

const handlePageChange = (page: number) => {
  userService.setPage(page)
}

const handlePageSizeChange = (size: number) => {
  userService.setPageSize(size)
}

const handleExport = () => {
  const rows = userService.items.value
  if (!rows.length) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }
  const header = ['ID', '用户名', '邮箱', '状态', '角色']
  const lines = rows.map((row) => [
    row.id,
    row.username,
    row.email,
    row.is_active ? '启用' : '禁用',
    (row.roles || []).map((r) => r.name).join(' / ') || '未分配',
  ])
  const csv = [header, ...lines].map((cols) => cols.join(',')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const avatarText = (username: string) => (username || '?').slice(0, 1).toUpperCase()

/* ---------- 新建用户 ---------- */

const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive({ username: '', email: '', password: '' })

const createRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '长度在 3 到 50 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

const openCreateDialog = () => {
  createForm.username = ''
  createForm.email = ''
  createForm.password = ''
  createVisible.value = true
}

const submitCreate = async () => {
  if (!createFormRef.value) return
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return
    creating.value = true
    try {
      const user = await userService.createUser({ ...createForm })
      if (user) {
        ElMessage.success('用户创建成功')
        createVisible.value = false
        rbacStore.loadStats()
        loadUsers()
      } else {
        ElMessage.error('创建失败，请稍后重试')
      }
    } finally {
      creating.value = false
    }
  })
}

/* ---------- 分配角色 ---------- */

const assignVisible = ref(false)
const assigning = ref(false)
const assignLoading = ref(false)
const assignTarget = ref<UserListItem | null>(null)
const selectedRoleIds = ref<number[]>([])
const roleOptions = computed(() => rbacStore.roleOptions)

const openAssignDialog = async (row: UserListItem) => {
  assignTarget.value = row
  selectedRoleIds.value = (row.roles || []).map((r) => r.id)
  assignVisible.value = true
  assignLoading.value = true
  try {
    await rbacStore.loadRoleOptions()
    const detail = await userService.fetchDetail(row.id)
    if (detail) {
      selectedRoleIds.value = detail.roles.map((r) => r.id)
    }
  } finally {
    assignLoading.value = false
  }
}

const submitAssign = async () => {
  if (!assignTarget.value) return
  assigning.value = true
  try {
    const result = await userService.assignRoles(assignTarget.value.id, selectedRoleIds.value)
    if (result) {
      ElMessage.success('角色分配成功')
      assignVisible.value = false
      // 角色变更可能影响统计（活跃用户不变），刷新列表即可
      loadUsers()
    } else {
      ElMessage.error('分配失败，请稍后重试')
    }
  } finally {
    assigning.value = false
  }
}

/* ---------- 详情 ---------- */

const detailVisible = ref(false)
const detailLoading = ref(false)

const openDetail = async (userId: number) => {
  detailVisible.value = true
  detailLoading.value = true
  try {
    await userService.fetchDetail(userId)
  } finally {
    detailLoading.value = false
  }
}

const detailPermissionCodes = computed(() => {
  const detail = userService.detail.value
  if (!detail) return []
  return [...new Set(detail.roles.flatMap((role) => role.permissions.map((p) => p.code)))].sort()
})

onMounted(() => {
  loadUsers()
  rbacStore.loadRoleOptions()
})
</script>

<style scoped lang="scss">
.user-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .username {
    font-weight: 500;
  }
}

.role-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}

.muted {
  color: var(--el-text-color-placeholder, #c0c4cc);
  font-size: 13px;
}

.dialog-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 14px;
}

.role-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  :deep(.el-checkbox) {
    width: 100%;
    margin-right: 0;
    height: auto;
    padding: 10px 12px;
  }
}

.role-option {
  display: flex;
  flex-direction: column;
  line-height: 1.4;

  .role-name {
    font-size: 14px;
    color: var(--el-text-color-primary, #303133);
  }

  .role-code {
    font-size: 12px;
    color: var(--el-text-color-secondary, #909399);
    font-family: var(--font-mono, monospace);
  }
}

.detail-loading {
  padding: 8px 0;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);

  h3 {
    font-size: 16px;
    margin: 0 0 2px;
  }

  p {
    font-size: 13px;
    color: var(--el-text-color-secondary, #909399);
    margin: 0;
  }
}

.detail-desc {
  margin: 16px 0;
}

.detail-section-title {
  font-size: 14px;
  color: var(--el-text-color-primary, #303133);
  margin: 18px 0 10px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
