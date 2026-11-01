<template>
  <PageContainer title="用户管理" subtitle="管理系统用户账号和权限">
    <!-- 搜索表单 -->
    <SearchForm
      v-model="searchParams"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #fields="{ form, setField }">
        <el-form-item label="关键字">
          <el-input
            :model-value="form.keyword"
            placeholder="用户名/邮箱/姓名"
            clearable
            @update:model-value="(v) => setField('keyword', v)"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            :model-value="form.status"
            placeholder="选择状态"
            clearable
            @update:model-value="(v) => setField('status', v)"
          >
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            :model-value="form.role_id"
            placeholder="选择角色"
            clearable
            @update:model-value="(v) => setField('role_id', v)"
          >
            <el-option
              v-for="role in roleOptions"
              :key="role.id"
              :label="role.name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
      </template>
      <template #actions>
        <el-button type="success" @click="handleAdd">
          <Plus /> 新增用户
        </el-button>
      </template>
    </SearchForm>

    <!-- 数据表格 -->
    <DataTable
      :data="userList"
      :loading="loading"
      :current-page="pagination.page"
      :page-size="pagination.page_size"
      :total="pagination.total"
      selectable
      @selection-change="handleSelectionChange"
      @refresh="handleRefresh"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    >
      <el-table-column prop="username" label="用户名" min-width="120">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="32" :src="row.avatar">{{ row.username?.[0]?.toUpperCase() }}</el-avatar>
            <span class="username">{{ row.username }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="full_name" label="姓名" min-width="100" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="角色" min-width="150">
        <template #default="{ row }">
          <el-tag
            v-for="role in row.roles"
            :key="role.id"
            type="info"
            size="small"
            class="role-tag"
          >
            {{ role.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_login_at" label="最后登录" min-width="160">
        <template #default="{ row }">
          {{ row.last_login_at || '从未登录' }}
        </template>
      </el-table-column>

      <template #actions="{ row }">
        <el-button size="small" type="primary" link @click="handleEdit(row as UserInfo)">
          <Edit /> 编辑
        </el-button>
        <el-button size="small" type="info" link @click="handleResetPassword(row as UserInfo)">
          <Key /> 重置密码
        </el-button>
        <el-button
          size="small"
          :type="row.status === 1 ? 'danger' : 'success'"
          link
          @click="handleToggleStatus(row as UserInfo)"
        >
          {{ row.status === 1 ? '禁用' : '启用' }}
        </el-button>
        <el-button size="small" type="danger" link @click="handleDelete(row as UserInfo)">
          <Delete /> 删除
        </el-button>
      </template>
    </DataTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElTableColumn, ElTag, ElAvatar, ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Key, Delete } from '@element-plus/icons-vue'
import PageContainer from '@/components/common/PageContainer.vue'
import SearchForm from '@/components/common/SearchForm.vue'
import DataTable from '@/components/common/DataTable.vue'
import { userService } from '@/services/user'
import type { UserInfo, RoleInfo } from '@/apis/modules/user'

const loading = ref(false)
const userList = ref<UserInfo[]>([])
const roleOptions = ref<RoleInfo[]>([])
const selectedUsers = ref<UserInfo[]>([])

const searchParams = reactive({
  keyword: '',
  status: undefined as number | undefined,
  role_id: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0,
})

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const result = await userService.loadList({
      page: pagination.page,
      page_size: pagination.page_size,
      keyword: searchParams.keyword || undefined,
      status: searchParams.status,
      role_id: searchParams.role_id,
    })

    if (result) {
      userList.value = result.items
      pagination.total = result.total
      pagination.total_pages = result.total_pages
    }
  } finally {
    loading.value = false
  }
}

// 加载角色选项
const loadRoleOptions = async () => {
  roleOptions.value = await userService.getRoleOptions()
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadUsers()
}

// 重置
const handleReset = () => {
  searchParams.keyword = ''
  searchParams.status = undefined
  searchParams.role_id = undefined
  pagination.page = 1
  loadUsers()
}

// 刷新
const handleRefresh = () => {
  loadUsers()
}

// 分页
const handlePageChange = (page: number) => {
  pagination.page = page
  loadUsers()
}

const handlePageSizeChange = (size: number) => {
  pagination.page_size = size
  pagination.page = 1
  loadUsers()
}

// 选择变化
const handleSelectionChange = (selection: UserInfo[]) => {
  selectedUsers.value = selection
}

// 新增用户
const handleAdd = () => {
  ElMessage.info('新增用户功能开发中')
}

// 编辑用户
const handleEdit = (row: UserInfo) => {
  ElMessage.info(`编辑用户 ${row.username}（功能开发中）`)
}

// 重置密码
const handleResetPassword = (row: UserInfo) => {
  ElMessageBox.prompt(`请输入用户「${row.username}」的新密码`, '重置密码', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'password',
    inputValidator: (value) => {
      if (!value) return '密码不能为空'
      if (value.length < 6) return '密码长度至少6位'
      return true
    },
  }).then(async ({ value }) => {
    const success = await userService.resetPassword(row.id, {
      password: value,
      confirm_password: value,
    })
    if (success) {
      ElMessage.success('密码重置成功')
    }
  }).catch(() => {})
}

// 切换状态
const handleToggleStatus = async (row: UserInfo) => {
  const newStatus = row.status === 1 ? 0 : 1
  const action = newStatus === 1 ? '启用' : '禁用'
  await ElMessageBox.confirm(`确定要${action}用户「${row.username}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const success = await userService.toggleStatus(row.id, newStatus)
    if (success) {
      ElMessage.success(`${action}成功`)
    }
  }).catch(() => {})
}

// 删除用户
const handleDelete = async (row: UserInfo) => {
  await ElMessageBox.confirm(`确定要删除用户「${row.username}」吗？此操作不可恢复`, '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'error',
  }).then(async () => {
    const success = await userService.delete(row.id)
    if (success) {
      ElMessage.success('删除成功')
      loadUsers()
    }
  }).catch(() => {})
}

onMounted(() => {
  loadUsers()
  loadRoleOptions()
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
}
</style>