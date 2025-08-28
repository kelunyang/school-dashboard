import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiService } from '../services/apiService'

// 全域認證狀態
const isAuthenticated = ref(false)
const authChecked = ref(false)
const showAuthDialog = ref(false)

export function useAuth() {
  // 檢查認證狀態
  const checkAuthStatus = async () => {
    try {
      const result = await apiService.getAuthStatus()
      if (result.success && result.authenticated) {
        isAuthenticated.value = true
        showAuthDialog.value = false
      } else {
        isAuthenticated.value = false
        showAuthDialog.value = true
      }
    } catch (error) {
      console.error('檢查認證狀態失敗:', error)
      isAuthenticated.value = false
      showAuthDialog.value = true
    } finally {
      authChecked.value = true
    }
  }

  // 處理認證成功
  const handleAuthenticated = () => {
    isAuthenticated.value = true
    showAuthDialog.value = false
    ElMessage.success('認證成功，可以開始使用系統')
  }

  // 處理需要認證
  const handleAuthRequired = () => {
    isAuthenticated.value = false
    showAuthDialog.value = true
  }

  // 登出
  const logout = async () => {
    try {
      await apiService.logout()
      isAuthenticated.value = false
      showAuthDialog.value = true
      ElMessage.info('已登出')
    } catch (error) {
      console.error('登出失敗:', error)
    }
  }

  // 初始化認證監聽
  const initAuth = () => {
    // 監聽全域認證事件
    window.addEventListener('auth-required', handleAuthRequired)
    
    // 頁面載入時檢查認證狀態
    checkAuthStatus()
  }

  // 清理認證監聽
  const destroyAuth = () => {
    window.removeEventListener('auth-required', handleAuthRequired)
  }

  return {
    // 狀態
    isAuthenticated: computed(() => isAuthenticated.value),
    authChecked: computed(() => authChecked.value),
    showAuthDialog: computed({
      get: () => showAuthDialog.value,
      set: (value) => { showAuthDialog.value = value }
    }),
    
    // 方法
    checkAuthStatus,
    handleAuthenticated,
    handleAuthRequired,
    logout,
    initAuth,
    destroyAuth
  }
}