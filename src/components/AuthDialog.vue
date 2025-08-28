<template>
  <el-drawer
    v-model="visible"
    title="系統認證"
    direction="ttb"
    size="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div class="auth-content">
      <el-icon class="auth-icon" size="64" color="#409eff">
        <Lock />
      </el-icon>
      <p class="auth-message">請輸入系統 passKey 以繼續使用</p>
      <el-form @submit.prevent="handleSubmit">
        <el-form-item>
          <el-input
            v-model="passKey"
            type="password"
            placeholder="請輸入 passKey"
            show-password
            size="large"
            :disabled="loading"
            @keyup.enter="handleSubmit"
            autofocus
          >
            <template #prefix>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleSubmit"
            style="width: 100%"
          >
            {{ loading ? '驗證中...' : '登入' }}
          </el-button>
        </el-form-item>
      </el-form>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Lock, Key } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'authenticated'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const passKey = ref('')
const loading = ref(false)
const errorMessage = ref('')

const handleSubmit = async () => {
  if (!passKey.value.trim()) {
    errorMessage.value = '請輸入 passKey'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await apiService.verifyPassKey(passKey.value.trim())
    
    if (result.success) {
      ElMessage.success('認證成功')
      emit('authenticated')
      visible.value = false
      passKey.value = '' // 清空輸入
    } else {
      errorMessage.value = result.error || '認證失敗'
      passKey.value = '' // 清空錯誤的輸入
    }
  } catch (error) {
    console.error('認證請求失敗:', error)
    errorMessage.value = '網路錯誤，請稍後重試'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-content {
  text-align: center;
  padding: 20px 0;
}

.auth-icon {
  margin-bottom: 20px;
}

.auth-message {
  font-size: 16px;
  color: #606266;
  margin-bottom: 30px;
  line-height: 1.5;
}

.error-message {
  color: #f56c6c;
  font-size: 14px;
  margin-top: 15px;
  line-height: 1.4;
}

.el-form-item {
  margin-bottom: 20px;
}

/* 抽屜樣式調整 */
:deep(.el-drawer__header) {
  background: linear-gradient(135deg, #409eff 0%, #5cb3f4 100%);
  color: white;
  padding: 20px;
  margin: 0;
}

:deep(.el-drawer__title) {
  color: white;
  font-weight: 600;
}

:deep(.el-drawer__body) {
  padding: 30px;
}
</style>