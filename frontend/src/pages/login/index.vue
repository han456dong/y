<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 左侧品牌展示 -->
      <div class="login-brand">
        <div class="brand-content">
          <div class="brand-logo">
            <Monitor class="brand-logo-icon" />
            <span class="brand-logo-text">辰光Agent平台</span>
          </div>
          <h1 class="brand-title">企业级AI Agent管理平台</h1>
          <p class="brand-description">
            提供Agent全生命周期管理、知识库管理、Prompt工程、模型管理、工具编排等能力
          </p>
          <div class="brand-features">
            <div class="feature-item" v-for="feature in features" :key="feature.title">
              <component :is="feature.icon" class="feature-icon" />
              <div class="feature-text">
                <h3>{{ feature.title }}</h3>
                <p>{{ feature.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="login-form-container">
        <div class="login-form-wrapper">
          <h2 class="login-title">欢迎登录</h2>
          <p class="login-subtitle">请输入您的账号和密码</p>
          <p class="login-demo-hint">演示账号：admin / 123456</p>

          <el-form
            ref="formRef"
            :model="formData"
            :rules="formRules"
            class="login-form"
            @submit.prevent="handleLogin"
          >
            <!-- 用户名 -->
            <el-form-item prop="username">
              <el-input
                v-model="formData.username"
                placeholder="请输入用户名"
                size="large"
                :prefix-icon="User"
                clearable
              />
            </el-form-item>

            <!-- 密码 -->
            <el-form-item prop="password">
              <el-input
                v-model="formData.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                :prefix-icon="Lock"
                show-password
                clearable
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <!-- 验证码 -->
            <el-form-item prop="captcha">
              <div class="captcha-row">
                <el-input
                  v-model="formData.captcha"
                  placeholder="请输入验证码"
                  size="large"
                  :prefix-icon="Key"
                  clearable
                />
                <div class="captcha-image" @click="refreshCaptcha" title="点击刷新验证码">
                  <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
                  <span v-else>点击获取</span>
                </div>
              </div>
            </el-form-item>

            <!-- 记住我 -->
            <div class="login-options">
              <el-checkbox v-model="formData.remember_me">记住我</el-checkbox>
              <a href="#" class="forgot-password" @click.prevent="handleForgotPassword">忘记密码？</a>
            </div>

            <!-- 登录按钮 -->
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              {{ loading ? '登录中...' : '登录' }}
            </el-button>

            <!-- 其他登录方式 -->
            <div class="login-divider">
              <span>其他登录方式</span>
            </div>
            <div class="login-others">
              <el-button circle size="large" @click="handleOAuth('wechat')">
                <ChatDotRound />
              </el-button>
              <el-button circle size="large" @click="handleOAuth('github')">
                <Link />
              </el-button>
              <el-button circle size="large" @click="handleOAuth('email')">
                <Message />
              </el-button>
            </div>
          </el-form>
        </div>

        <!-- 版权信息 -->
        <div class="login-footer">
          <span>© 2024 辰光Agent平台. All Rights Reserved.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElForm, ElFormItem, ElInput, ElCheckbox, ElButton, ElMessage } from 'element-plus'
import {
  User, Lock, Key, Monitor, ChatDotRound, Link, Message,
  MagicStick, Collection, Cpu, Connection
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/modules/auth'
import { getCaptchaApi } from '@/apis/modules/auth'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const captchaImage = ref('')
const captchaKey = ref('')

// 表单数据
const formData = reactive({
  username: '',
  password: '',
  captcha: '',
  remember_me: false,
})

// 表单验证规则
const formRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在3到50个字符之间', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度在6到32个字符之间', trigger: 'blur' },
  ],
  captcha: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 4, message: '验证码为4位字符', trigger: 'blur' },
  ],
}

// 品牌特性
const features = [
  { icon: MagicStick, title: 'Agent管理', description: '全生命周期管理AI Agent' },
  { icon: Collection, title: '知识库', description: 'RAG知识库管理与检索' },
  { icon: Cpu, title: '模型管理', description: '多种AI模型统一接入' },
  { icon: Connection, title: '工具编排', description: '灵活的工具链编排能力' },
]

// 获取验证码（GET /api/v1/captcha）
const refreshCaptcha = async () => {
  try {
    const data = await getCaptchaApi()
    captchaKey.value = data.key
    captchaImage.value = data.image
  } catch {
    // 验证码获取失败，用户可点击重试
  }
}

// 处理登录
const handleLogin = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      await authStore.login({
        username: formData.username,
        password: formData.password,
        captcha_key: captchaKey.value,
        captcha_code: formData.captcha,
      })

      ElMessage.success('登录成功')

      // 跳转到重定向页面或首页
      const redirect = route.query.redirect as string
      router.push(redirect || '/dashboard')
    } catch (error: any) {
      ElMessage.error(error?.message || '登录失败，请检查用户名和密码')
      await refreshCaptcha()
    } finally {
      loading.value = false
    }
  })
}

// 忘记密码
const handleForgotPassword = () => {
  ElMessage.info('请联系管理员重置密码')
}

// 第三方登录
const handleOAuth = (provider: string) => {
  ElMessage.info(`${provider}登录功能开发中`)
}

onMounted(() => {
  // 如果已登录，直接跳转
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
    return
  }
  // 初始化验证码
  refreshCaptcha()
})
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #263445 0%, #2c3e50 55%, #1f2a38 100%);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 50%);
    animation: rotate 20s linear infinite;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.login-container {
  display: flex;
  width: 1000px;
  max-width: 90vw;
  height: 600px;
  max-height: 90vh;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  position: relative;
  z-index: 1;
}

// 左侧品牌展示
.login-brand {
  flex: 1;
  background: linear-gradient(150deg, #2c3e50 0%, #34495e 60%, #3a4f63 100%);
  padding: 60px 40px;
  color: white;
  display: flex;
  align-items: center;

  .brand-content {
    max-width: 400px;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 40px;

    .brand-logo-icon {
      font-size: 36px;
    }

    .brand-logo-text {
      font-size: 24px;
      font-weight: 600;
    }
  }

  .brand-title {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 16px;
  }

  .brand-description {
    font-size: 14px;
    line-height: 1.6;
    opacity: 0.9;
    margin-bottom: 40px;
  }

  .brand-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;

      .feature-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .feature-text {
        h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px;
        }

        p {
          font-size: 12px;
          opacity: 0.8;
          margin: 0;
        }
      }
    }
  }
}

// 右侧登录表单
.login-form-container {
  width: 400px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  .login-form-wrapper {
    flex: 1;
  }

  .login-title {
    font-size: 24px;
    font-weight: 700;
    color: #303133;
    margin: 0 0 8px;
  }

  .login-subtitle {
    font-size: 14px;
    color: #909399;
    margin: 0 0 8px;
  }

  .login-demo-hint {
    font-size: 12px;
    color: #b07d5f;
    background: #fdf3ec;
    border: 1px solid #f3d9c8;
    border-radius: 6px;
    padding: 6px 10px;
    margin: 0 0 24px;
    display: inline-block;
  }

  .login-form {
    :deep(.el-form-item) {
      margin-bottom: 20px;
    }

    :deep(.el-input__wrapper) {
      border-radius: 8px;
      padding: 4px 12px;
    }
  }

  .captcha-row {
    display: flex;
    gap: 12px;
    width: 100%;

    .el-input {
      flex: 1;
    }

    .captcha-image {
      width: 100px;
      height: 40px;
      background: #f0f2f5;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: hidden;
      font-size: 12px;
      color: #909399;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

  .login-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .forgot-password {
      font-size: 13px;
      color: #409eff;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .login-btn {
    width: 100%;
    height: 44px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 24px;
  }

  .login-divider {
    position: relative;
    text-align: center;
    margin: 20px 0;
    color: #c0c4cc;
    font-size: 12px;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 100px;
      height: 1px;
      background: #e4e7ed;
    }

    &::before {
      left: 0;
    }

    &::after {
      right: 0;
    }

    span {
      position: relative;
      padding: 0 12px;
      background: white;
    }
  }

  .login-others {
    display: flex;
    justify-content: center;
    gap: 16px;

    :deep(.el-button) {
      width: 44px;
      height: 44px;
      font-size: 18px;
    }
  }

  .login-footer {
    text-align: center;
    font-size: 12px;
    color: #c0c4cc;
  }
}

// 响应式
@media (max-width: 768px) {
  .login-brand {
    display: none;
  }

  .login-form-container {
    width: 100%;
    padding: 24px;
  }
}
</style>