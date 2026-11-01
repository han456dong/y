<template>
  <PageContainer title="用户管理" subtitle="管理账号状态与角色分配，内置安全边界保护">
    <template #actions>
      <Can permission="system.user:create">
        <el-button type="primary" @click="openCreateDialog">
          <Plus /> 新建用户
        </el-button>
      </Can>
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
      empty-text="暂无用户"
      @refresh="loadUsers"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    >
      <el-table-column prop="id" label="ID" width="64" />
      <el-table-column prop="username" label="用户名" min-width="150">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="28">{{ avatarText(row.username) }}</el-avatar>
            <span class="username">{{ row.username }}</span>
            <el-tag v-if="row.is_superuser" size="small" type="danger" effect="plain">超管</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="200" show-overflow-tooltip />
      <el-table-column label="角色" min-width="200">
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
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-switch
            :model-value="row.is_active"
            :disabled="!canToggle(row as User)"
            :loading="statusLoadingId === row.id"
            inline-prompt
            active-text="启用"
            inactive-text="禁用"
            @change="(val: string | number | boolean) => handleToggleActive(row as User, Boolean(val))"
          />
        </template>
      </el-table-column>
      <el-table-column prop="last_login" label="最后登录" min-width="170">
        <template #default="{ row }">
          <span v-if="row.last_login">{{ row.last_login }}</span>
          <span v-else class="muted">从未登录</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <Can permission="system.user:update">
            <el-button link type="primary" size="small" @click="openEditDialog(row as User)">
              <Edit /> 编辑
            </el-button>
          </Can>
          <Can permission="system.user:assign">
            <el-button link type="warning" size="small" @click="openAssignDialog(row as User)">
              <Avatar /> 分配角色
            </el-button>
          </Can>
          <Can permission="system.user:delete">
            <el-tooltip :disabled="canDelete(row as User)" content="不能删除当前登录账号" placement="top">
              <span>
                <el-button
                  link
                  type="danger"
                  size="small"
                  :disabled="!canDelete(row as User)"
                  @click="handleDelete(row as User)"
                >
                  <Delete /> 删除
                </el-button>
              </span>
            </el-tooltip>
          </Can>
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

    <!-- 编辑用户（邮箱） -->
    <el-dialog v-model="editVisible" title="编辑用户" width="440px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="84px">
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email" placeholder="name@example.com" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配角色 -->
    <el-dialog v-model="assignVisible" title="分配角色" width="480px" destroy-on-close>
      <p class="dialog-hint">
        用户：<strong>{{ assignTarget?.username }}</strong>，勾选后保存立即生效；整体替换现有角色。
      </p>
      <el-checkbox-group v-model="selectedRoleIds" class="role-options">
        <el-checkbox v-for="role in roleOptions" :key="role.id" :value="role.id" border>
          <div class="role-option">
            <span class="role-name">
              {{ role.name }}
              <el-tag v-if="role.is_system" size="small" type="info" effect="plain">内置</el-tag>
            </span>
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
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  ElButton, ElForm, ElFormItem, ElInput, ElDialog, ElCheckboxGroup, ElCheckbox,
  ElAvatar, ElTag, ElTableColumn, ElEmpty, ElSwitch, ElTooltip, ElMessage, ElMessageBox,
} from 'element-plus'
import { Plus, Edit, Delete, Avatar } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import PageContainer from '@/components/common/PageContainer.vue'
import SearchForm from '@/components/common/SearchForm.vue'
import DataTable from '@/components/common/DataTable.vue'
import Can from '@/components/common/Can.vue'
import { rbacUserService } from '@/services/rbac'
import { useRbacStore } from '@/store/modules/rbac'
import { usePermissionStore } from '@/store/modules/permission'
import { useAuthStore } from '@/store/modules/auth'
import type { User } from '@/apis/modules/rbac'

const userService = rbacUserService
const rbacStore = useRbacStore()
const permissionStore = usePermissionStore()
const authStore = useAuthStore()

const searchParams = reactive({ keyword: '' })
const statusLoadingId = ref<number | null>(null)

/* ---------- 列表 ---------- */

const loadUsers = () => {
  userService.load({ keyword: searchParams.keyword || undefined })
}

const handleSearch = () => userService.load({ keyword: searchParams.keyword || undefined, page: 1 })
const handleReset = () => {
  searchParams.keyword = ''
  userService.load({ keyword: undefined, page: 1 })
}
const handlePageChange = (page: number) => userService.setPage(page)
const handlePageSizeChange = (size: number) => userService.setPageSize(size)

const avatarText = (username: string) => (username || '?').slice(0, 1).toUpperCase()

/* ---------- 安全边界 ---------- */

const isSelf = (row: User) => row.id === authStore.user?.id

const canToggle = (row: User) =>
  permissionStore.has('system.user:update') && !isSelf(row)

const canDelete = (row: User) => !isSelf(row)

/* ---------- 启停 ---------- */

const handleToggleActive = async (row: User, nextActive: boolean) => {
  const action = nextActive ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定要${action}用户「${row.username}」吗？`, '状态变更', {
      type: 'warning',
      confirmButtonText: action,
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  statusLoadingId.value = row.id
  try {
    const updated = await userService.toggleActive(row.id, nextActive)
    if (updated) {
      ElMessage.success(`${action}成功`)
      rbacStore.loadStats()
    } else {
      ElMessage.error(userService.error.value?.message || `${action}失败`)
      loadUsers()
    }
  } finally {
    statusLoadingId.value = null
  }
}

/* ---------- 新建 ---------- */

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
        ElMessage.error(userService.error.value?.message || '创建失败')
      }
    } finally {
      creating.value = false
    }
  })
}

/* ---------- 编辑 ---------- */

const editVisible = ref(false)
const editing = ref(false)
const editFormRef = ref<FormInstance>()
const editTarget = ref<User | null>(null)
const editForm = reactive({ email: '' })

const editRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
}

const openEditDialog = (row: User) => {
  editTarget.value = row
  editForm.email = row.email
  editVisible.value = true
}

const submitEdit = async () => {
  if (!editFormRef.value || !editTarget.value) return
  await editFormRef.value.validate(async (valid) => {
    if (!valid) return
    editing.value = true
    try {
      const updated = await userService.updateUser(editTarget.value!.id, { email: editForm.email })
      if (updated) {
        ElMessage.success('用户已更新')
        editVisible.value = false
      } else {
        ElMessage.error(userService.error.value?.message || '更新失败')
      }
    } finally {
      editing.value = false
    }
  })
}

/* ---------- 分配角色 ---------- */

const assignVisible = ref(false)
const assigning = ref(false)
const assignLoading = ref(false)
const assignTarget = ref<User | null>(null)
const selectedRoleIds = ref<number[]>([])
const roleOptions = computed(() => rbacStore.roleOptions)

const openAssignDialog = async (row: User) => {
  assignTarget.value = row
  selectedRoleIds.value = (row.roles || []).map((r) => r.id)
  assignVisible.value = true
  assignLoading.value = true
  try {
    await rbacStore.loadRoleOptions(true)
    const roles = await userService.fetchUserRoles(row.id)
    selectedRoleIds.value = roles.map((r) => r.id)
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
      rbacStore.loadStats()
      loadUsers()
    } else {
      ElMessage.error(userService.error.value?.message || '分配失败')
    }
  } finally {
    assigning.value = false
  }
}

/* ---------- 删除 ---------- */

const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确定删除用户「${row.username}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  const success = await userService.deleteUser(row.id)
  if (success) {
    ElMessage.success('用户已删除')
    rbacStore.loadStats()
    loadUsers()
  } else {
    ElMessage.error(userService.error.value?.message || '删除失败')
  }
}

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
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--el-text-color-primary, #303133);
  }

  .role-code {
    font-size: 12px;
    color: var(--el-text-color-secondary, #909399);
    font-family: var(--font-mono, monospace);
  }
}
</style>
