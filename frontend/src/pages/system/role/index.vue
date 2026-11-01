<template>
  <PageContainer title="角色管理" subtitle="维护角色定义并为角色配置权限集合">
    <template #actions>
      <el-button type="primary" @click="openCreateDialog">
        <Plus /> 新建角色
      </el-button>
    </template>

    <!-- 概览 -->
    <div class="summary-row">
      <div class="summary-item">
        <span class="summary-label">角色总数</span>
        <strong class="summary-value">{{ roleService.pagination.value.total }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">当前页权限合计</span>
        <strong class="summary-value">{{ totalPermissionCount }}</strong>
      </div>
      <div class="summary-item">
        <span class="summary-label">已授权角色</span>
        <strong class="summary-value">{{ authorizedRoleCount }}</strong>
      </div>
    </div>

    <!-- 搜索 -->
    <SearchForm v-model="searchParams" :loading="roleService.loading.value" @search="handleSearch" @reset="handleReset">
      <template #fields="{ form, setField }">
        <el-form-item label="关键字">
          <el-input
            :model-value="form.keyword"
            placeholder="角色编码 / 名称 / 描述"
            clearable
            @update:model-value="(v) => setField('keyword', v)"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <!-- 列表 -->
    <DataTable
      :data="roleService.items.value"
      :loading="roleService.loading.value"
      :current-page="roleService.pagination.value.page"
      :page-size="roleService.pagination.value.page_size"
      :total="roleService.pagination.value.total"
      :page-sizes="[10, 20, 50]"
      empty-text="暂无角色，点击右上角新建角色"
      @refresh="loadRoles"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    >
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="code" label="角色编码" min-width="150">
        <template #default="{ row }">
          <code class="code-text">{{ row.code }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="角色名称" min-width="140" />
      <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.description">{{ row.description }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="权限数" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.permissions.length ? 'success' : 'info'" effect="plain">
            {{ row.permissions.length }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEditDialog(row as Role)">
            <Edit /> 编辑
          </el-button>
          <el-button link type="warning" size="small" @click="openAssignDialog(row as Role)">
            <Key /> 分配权限
          </el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row as Role)">
            <Delete /> 删除
          </el-button>
        </template>
      </el-table-column>
    </DataTable>

    <!-- 新建 / 编辑 -->
    <el-dialog v-model="formVisible" :title="editingRole ? '编辑角色' : '新建角色'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="84px">
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="form.code" placeholder="如 auditor" :disabled="!!editingRole" clearable />
          <p class="field-hint">编码创建后不可修改，建议与业务语义一致。</p>
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="如 审计员" clearable />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="角色职责说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ editingRole ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 分配权限 -->
    <el-dialog v-model="assignVisible" title="分配权限" width="640px" destroy-on-close>
      <p class="dialog-hint">
        角色：<strong>{{ assignTarget?.name }}</strong>（{{ assignTarget?.code }}），
        已选 <strong>{{ selectedPermissionIds.length }}</strong> / {{ allPermissions.length }} 项权限。
      </p>

      <div v-if="assignLoading" class="assign-loading">
        <el-skeleton :rows="6" animated />
      </div>
      <el-empty v-else-if="!allPermissions.length" description="暂无可分配的权限" :image-size="80" />
      <div v-else class="permission-groups">
        <section v-for="(permissions, module) in groupedPermissions" :key="module" class="permission-group">
          <header class="group-head">
            <el-checkbox
              :model-value="isModuleChecked(permissions)"
              :indeterminate="isModuleIndeterminate(permissions)"
              @change="(checked) => toggleModule(permissions, Boolean(checked))"
            >
              <span class="group-title">{{ module }}</span>
              <span class="group-count">{{ permissions.length }} 项</span>
            </el-checkbox>
          </header>
          <el-checkbox-group v-model="selectedPermissionIds" class="group-body">
            <el-checkbox v-for="permission in permissions" :key="permission.id" :value="permission.id">
              <span class="perm-name">{{ permission.name }}</span>
              <code class="perm-code">{{ permission.code }}</code>
            </el-checkbox>
          </el-checkbox-group>
        </section>
      </div>

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
  ElTag, ElTableColumn, ElEmpty, ElSkeleton, ElMessage, ElMessageBox,
} from 'element-plus'
import { Plus, Edit, Delete, Key } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import PageContainer from '@/components/common/PageContainer.vue'
import SearchForm from '@/components/common/SearchForm.vue'
import DataTable from '@/components/common/DataTable.vue'
import { rbacRoleService, RbacRoleService } from '@/services/rbac'
import { useRbacStore } from '@/store/modules/rbac'
import type { Role, Permission } from '@/apis/modules/rbac'

const roleService = rbacRoleService
const rbacStore = useRbacStore()

const searchParams = reactive({ keyword: '' })

const totalPermissionCount = computed(() =>
  roleService.items.value.reduce((sum, role) => sum + role.permissions.length, 0)
)
const authorizedRoleCount = computed(
  () => roleService.items.value.filter((role) => role.permissions.length > 0).length
)

/* ---------- 列表 ---------- */

const loadRoles = () => {
  roleService.load({ keyword: searchParams.keyword || undefined })
}

const handleSearch = () => {
  roleService.load({ keyword: searchParams.keyword || undefined, page: 1 })
}

const handleReset = () => {
  searchParams.keyword = ''
  roleService.load({ keyword: undefined, page: 1 })
}

const handlePageChange = (page: number) => roleService.setPage(page)
const handlePageSizeChange = (size: number) => roleService.setPageSize(size)

/* ---------- 新建 / 编辑 ---------- */

const formVisible = ref(false)
const submitting = ref(false)
const editingRole = ref<Role | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({ code: '', name: '', description: '' })

const formRules: FormRules = {
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '小写字母开头，可包含数字与下划线', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
}

const openCreateDialog = () => {
  editingRole.value = null
  form.code = ''
  form.name = ''
  form.description = ''
  formVisible.value = true
}

const openEditDialog = (role: Role) => {
  editingRole.value = role
  form.code = role.code
  form.name = role.name
  form.description = role.description || ''
  formVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
      }
      const result = editingRole.value
        ? await roleService.updateRole(editingRole.value.id, payload)
        : await roleService.createRole({ code: form.code, ...payload })

      if (result) {
        ElMessage.success(editingRole.value ? '角色已更新' : '角色创建成功')
        formVisible.value = false
        rbacStore.invalidate('roles')
        rbacStore.loadStats()
        loadRoles()
      } else {
        ElMessage.error('操作失败，请稍后重试')
      }
    } finally {
      submitting.value = false
    }
  })
}

/* ---------- 删除 ---------- */

const handleDelete = async (role: Role) => {
  try {
    await ElMessageBox.confirm(
      `确定删除角色「${role.name}」吗？该角色将从所有用户身上移除，此操作不可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  const success = await roleService.deleteRole(role.id)
  if (success) {
    ElMessage.success('角色已删除')
    rbacStore.invalidate('roles')
    rbacStore.loadStats()
    loadRoles()
  } else {
    ElMessage.error('删除失败，请稍后重试')
  }
}

/* ---------- 分配权限 ---------- */

const assignVisible = ref(false)
const assigning = ref(false)
const assignLoading = ref(false)
const assignTarget = ref<Role | null>(null)
const selectedPermissionIds = ref<number[]>([])
const allPermissions = ref<Permission[]>([])

const groupedPermissions = computed(() => RbacRoleService.groupPermissionsByModule(allPermissions.value))

const openAssignDialog = async (role: Role) => {
  assignTarget.value = role
  selectedPermissionIds.value = role.permissions.map((p) => p.id)
  assignVisible.value = true
  assignLoading.value = true
  try {
    const [permissions, detail] = await Promise.all([
      rbacStore.loadPermissionOptions(),
      roleService.fetchDetail(role.id),
    ])
    allPermissions.value = permissions
    if (detail) {
      selectedPermissionIds.value = detail.permissions.map((p) => p.id)
    }
  } finally {
    assignLoading.value = false
  }
}

const isModuleChecked = (permissions: Permission[]) =>
  permissions.every((p) => selectedPermissionIds.value.includes(p.id))

const isModuleIndeterminate = (permissions: Permission[]) => {
  const selected = permissions.filter((p) => selectedPermissionIds.value.includes(p.id)).length
  return selected > 0 && selected < permissions.length
}

const toggleModule = (permissions: Permission[], checked: boolean) => {
  const ids = permissions.map((p) => p.id)
  if (checked) {
    selectedPermissionIds.value = [...new Set([...selectedPermissionIds.value, ...ids])]
  } else {
    selectedPermissionIds.value = selectedPermissionIds.value.filter((id) => !ids.includes(id))
  }
}

const submitAssign = async () => {
  if (!assignTarget.value) return
  assigning.value = true
  try {
    const result = await roleService.assignPermissions(assignTarget.value.id, selectedPermissionIds.value)
    if (result) {
      ElMessage.success('权限分配成功')
      assignVisible.value = false
      rbacStore.invalidate('permissions')
      loadRoles()
    } else {
      ElMessage.error('分配失败，请稍后重试')
    }
  } finally {
    assigning.value = false
  }
}

onMounted(() => {
  loadRoles()
  rbacStore.loadPermissionOptions()
})
</script>

<style scoped lang="scss">
.summary-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 16px;
  background: var(--el-fill-color-lighter, #fafafa);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 6px;
}

.summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.summary-value {
  font-size: 18px;
  color: var(--el-text-color-primary, #303133);
  font-variant-numeric: tabular-nums;
}

.code-text {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--el-fill-color-light, #f5f7fa);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--el-text-color-primary, #303133);
}

.muted {
  color: var(--el-text-color-placeholder, #c0c4cc);
}

.field-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder, #c0c4cc);
  margin: 4px 0 0;
  line-height: 1.5;
}

.dialog-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
  margin-bottom: 14px;
}

.assign-loading {
  padding: 8px 0;
}

.permission-groups {
  max-height: 52vh;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.permission-group {
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-radius: 6px;
  overflow: hidden;
}

.group-head {
  padding: 8px 12px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);

  .group-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-primary, #303133);
    text-transform: capitalize;
  }

  .group-count {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary, #909399);
  }
}

.group-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  padding: 10px 12px;

  :deep(.el-checkbox) {
    height: auto;
    padding: 4px 0;
    margin-right: 0;
    align-items: flex-start;
  }
}

.perm-name {
  font-size: 13px;
  color: var(--el-text-color-primary, #303133);
}

.perm-code {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-placeholder, #c0c4cc);
  font-family: var(--font-mono, monospace);
}

@media (max-width: 768px) {
  .group-body { grid-template-columns: 1fr; }
}
</style>
