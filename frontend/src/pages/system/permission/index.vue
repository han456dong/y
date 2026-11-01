<template>
  <PageContainer title="权限管理" subtitle="维护权限编码与说明，权限编码采用 模块:资源:操作 格式">
    <template #actions>
      <el-button type="primary" @click="openCreateDialog">
        <Plus /> 新建权限
      </el-button>
    </template>

    <!-- 概览 -->
    <div class="summary-row">
      <div class="summary-item">
        <span class="summary-label">权限总数</span>
        <strong class="summary-value">{{ permissionService.pagination.value.total }}</strong>
      </div>
      <div v-for="stat in moduleStats" :key="stat.module" class="summary-item">
        <span class="summary-label">{{ stat.module }} 模块</span>
        <strong class="summary-value">{{ stat.count }}</strong>
      </div>
    </div>

    <!-- 搜索 -->
    <SearchForm
      v-model="searchParams"
      :loading="permissionService.loading.value"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #fields="{ form, setField }">
        <el-form-item label="关键字">
          <el-input
            :model-value="form.keyword"
            placeholder="权限编码 / 名称 / 描述"
            clearable
            @update:model-value="(v) => setField('keyword', v)"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <!-- 列表 -->
    <DataTable
      :data="permissionService.items.value"
      :loading="permissionService.loading.value"
      :current-page="permissionService.pagination.value.page"
      :page-size="permissionService.pagination.value.page_size"
      :total="permissionService.pagination.value.total"
      :page-sizes="[10, 20, 50]"
      empty-text="暂无权限，点击右上角新建权限"
      @refresh="loadPermissions"
      @update:current-page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    >
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="模块" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="moduleTagType(row.code)" effect="plain">
            {{ moduleOf(row.code) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="权限编码" min-width="220">
        <template #default="{ row }">
          <code class="code-text">{{ row.code }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="权限名称" min-width="150" />
      <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.description">{{ row.description }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEditDialog(row as Permission)">
            <Edit /> 编辑
          </el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row as Permission)">
            <Delete /> 删除
          </el-button>
        </template>
      </el-table-column>
    </DataTable>

    <!-- 新建 / 编辑 -->
    <el-dialog v-model="formVisible" :title="editingPermission ? '编辑权限' : '新建权限'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="84px">
        <el-form-item label="权限编码" prop="code">
          <el-input
            v-model="form.code"
            placeholder="如 system:user:view"
            :disabled="!!editingPermission"
            clearable
          />
          <p class="field-hint">格式：模块:资源:操作，例如 system:user:view；创建后不可修改。</p>
        </el-form-item>
        <el-form-item label="权限名称" prop="name">
          <el-input v-model="form.name" placeholder="如 查看用户" clearable />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="权限用途说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ editingPermission ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  ElButton, ElForm, ElFormItem, ElInput, ElDialog, ElTag, ElTableColumn,
  ElMessage, ElMessageBox,
} from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import PageContainer from '@/components/common/PageContainer.vue'
import SearchForm from '@/components/common/SearchForm.vue'
import DataTable from '@/components/common/DataTable.vue'
import { rbacPermissionService } from '@/services/rbac'
import { useRbacStore } from '@/store/modules/rbac'
import { getPermissionModule, type Permission } from '@/apis/modules/rbac'

const permissionService = rbacPermissionService
const rbacStore = useRbacStore()

const searchParams = reactive({ keyword: '' })
const moduleStats = computed(() => permissionService.moduleStats.value)

/* ---------- 列表 ---------- */

const loadPermissions = () => {
  permissionService.load({ keyword: searchParams.keyword || undefined })
}

const handleSearch = () => {
  permissionService.load({ keyword: searchParams.keyword || undefined, page: 1 })
}

const handleReset = () => {
  searchParams.keyword = ''
  permissionService.load({ keyword: undefined, page: 1 })
}

const handlePageChange = (page: number) => permissionService.setPage(page)
const handlePageSizeChange = (size: number) => permissionService.setPageSize(size)

/* ---------- 模块标签 ---------- */

const moduleOf = (code: string) => getPermissionModule(code)

const MODULE_TAG_TYPES: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  dashboard: 'primary',
  system: 'warning',
  monitor: 'success',
  agent: 'primary',
  model: 'success',
  kb: 'info',
  tool: 'danger',
}

const moduleTagType = (code: string) => MODULE_TAG_TYPES[moduleOf(code)] || 'info'

/* ---------- 新建 / 编辑 ---------- */

const formVisible = ref(false)
const submitting = ref(false)
const editingPermission = ref<Permission | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({ code: '', name: '', description: '' })

const formRules: FormRules = {
  code: [
    { required: true, message: '请输入权限编码', trigger: 'blur' },
    {
      pattern: /^[a-z][a-z0-9_]*:[a-z0-9_]+(:[a-z0-9_]+)?$/,
      message: '格式应为 模块:资源 或 模块:资源:操作',
      trigger: 'blur',
    },
  ],
  name: [{ required: true, message: '请输入权限名称', trigger: 'blur' }],
}

const openCreateDialog = () => {
  editingPermission.value = null
  form.code = ''
  form.name = ''
  form.description = ''
  formVisible.value = true
}

const openEditDialog = (permission: Permission) => {
  editingPermission.value = permission
  form.code = permission.code
  form.name = permission.name
  form.description = permission.description || ''
  formVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload = { name: form.name, description: form.description || null }
      const result = editingPermission.value
        ? await permissionService.updatePermission(editingPermission.value.id, payload)
        : await permissionService.createPermission({ code: form.code, ...payload })

      if (result) {
        ElMessage.success(editingPermission.value ? '权限已更新' : '权限创建成功')
        formVisible.value = false
        rbacStore.invalidate('permissions')
        rbacStore.loadStats()
        loadPermissions()
      } else {
        ElMessage.error('操作失败，请稍后重试')
      }
    } finally {
      submitting.value = false
    }
  })
}

/* ---------- 删除 ---------- */

const handleDelete = async (permission: Permission) => {
  try {
    await ElMessageBox.confirm(
      `确定删除权限「${permission.name}」（${permission.code}）吗？该权限将从所有角色中移除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  const success = await permissionService.deletePermission(permission.id)
  if (success) {
    ElMessage.success('权限已删除')
    rbacStore.invalidate('permissions')
    rbacStore.loadStats()
    loadPermissions()
  } else {
    ElMessage.error('删除失败，请稍后重试')
  }
}

onMounted(() => {
  loadPermissions()
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
  text-transform: capitalize;
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
</style>
