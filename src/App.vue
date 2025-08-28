<template>
  <el-container>
    <el-header>
      <div class="header-content">
        <h1>{{ headerTitle }}</h1>
        <div class="header-actions">
          <template v-if="isAuthenticated && authChecked">
            <el-button 
              type="primary" 
              @click="showFunctionSelector"
              :icon="Menu"
              :class="{ 'blink-button': dashboardLoading }"
            >
              功能選擇
            </el-button>
            <el-button 
              type="success" 
              @click="showCrossFunctionalDialog = true"
              :disabled="crossFunctionalUIDs.length === 0"
              style="margin-left: 10px;"
            >
              跨功能查詢 ({{ crossFunctionalUIDs.length }})
            </el-button>
            
            <!-- 會話有效期倒數 -->
            <div style="margin-left: 15px; display: flex; align-items: center;">
              <el-progress 
                type="dashboard" 
                :percentage="sessionProgress"
                :width="60"
                :stroke-width="8"
                :color="getProgressColor()"
                style="transform: scale(0.8);"
              >
                <template #default="{ percentage }">
                  <span style="font-size: 12px; font-weight: bold;color:white">{{ formatRemainingTime() }}</span>
                </template>
              </el-progress>
            </div>
          </template>
          <template v-else>
            <el-button 
              type="info" 
              @click="showAuthDialog = true"
              :icon="Lock"
              size="small"
            >
              身份驗證
            </el-button>
          </template>
        </div>
      </div>
    </el-header>
    <el-main>
      <!-- 未認證時的歡迎畫面 -->
      <div v-if="!isAuthenticated || !authChecked" class="welcome-screen">
        <div class="welcome-content">
          <div class="welcome-header">
            <div class="welcome-icon">🏫</div>
            <h1>林口高中註冊組學生資訊統計系統</h1>
            <p class="welcome-subtitle">請先完成身份驗證以使用系統功能</p>
          </div>
          
          <div v-if="!authChecked" class="loading-section">
            <el-icon class="is-loading" size="24"><Loading /></el-icon>
            <p>正在檢查認證狀態...</p>
          </div>
          
          <div v-else-if="!isAuthenticated" class="auth-prompt">
            <el-button type="primary" size="large" @click="showAuthDialog = true">
              <el-icon><Lock /></el-icon>
              開始驗證
            </el-button>
          </div>
        </div>
      </div>
      
      <!-- 已認證時的功能區域 -->
      <div v-else>
        <!-- 功能提示 -->
        <el-row :gutter="20" v-if="!selectedDashboard" style="margin-bottom: 20px;">
          <el-col :span="24">
            <el-alert
              title="歡迎使用林口高中註冊組學生資訊統計系統"
              type="success"
              description="請從上方選擇一個功能開始使用：歷年新生統計、畢業生流向統計、學測分數統計或分科成績統計。"
              :closable="false"
              show-icon
            />
          </el-col>
        </el-row>
      
      <!-- 跨功能選擇提示 -->
      <el-row :gutter="20" v-if="crossFunctionalLocked" style="margin-bottom: 20px;">
        <el-col :span="24">
          <el-alert
            :title="`跨功能追蹤模式 - 正在追蹤 ${lockedStudents.length} 位學生`"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>系統會顯示這些學生在所有功能中的跨年份資料。由於學生在不同時期參與不同測驗（例如：參與學測的學生是三年前的新生），系統會自動匹配並顯示相關資料。</span>
                <el-button
                  type="warning"
                  size="small"
                  @click="unlockCrossFunctionalQuery"
                  style="margin-left: 20px;"
                >
                  解除跨功能查詢
                </el-button>
              </div>
            </template>
          </el-alert>
        </el-col>
      </el-row>
      
      <el-row :gutter="20">
        <el-col :span="24">
          <el-card>
            
            <!-- 全局年份選擇器 -->
            <div v-if="selectedDashboard && selectedDashboard !== 'currentStudent' && availableYears.length > 0" style="margin-top: 20px;">
              <div class="year-selector-container">
                <span class="year-selector-label">選擇年度：</span>
                <!-- 新生、學測、分科模式使用多選 -->
                <el-select 
                  v-if="['newbie', 'examScore', 'stScore'].includes(selectedDashboard)"
                  v-model="selectedYears" 
                  multiple
                  placeholder="選擇年度" 
                  :loading="yearLoading"
                  :disabled="crossFunctionalLocked"
                  @change="handleYearsChange"
                  style="width: 300px;"
                  collapse-tags
                  collapse-tags-tooltip
                >
                  <el-option
                    v-for="year in availableYears"
                    :key="year"
                    :label="`${year} 年`"
                    :value="year"
                  />
                </el-select>
                <!-- 畢業生模式使用單選 -->
                <el-select 
                  v-else
                  v-model="selectedYear" 
                  placeholder="選擇年度" 
                  :loading="yearLoading"
                  :disabled="crossFunctionalLocked"
                  @change="handleYearChange"
                  style="width: 200px;"
                >
                  <el-option label="全部年度" value="all" />
                  <el-option
                    v-for="year in availableYears"
                    :key="year"
                    :label="`${year} 年`"
                    :value="year"
                  />
                </el-select>
                
                <!-- 手動刷新按鈕 -->
                <el-button 
                  v-if="['newbie', 'graduate', 'examScore', 'stScore'].includes(selectedDashboard)"
                  type="primary"
                  :loading="dataRefreshing"
                  @click="handleManualRefresh"
                  style="margin-left: 10px;"
                >
                  <el-icon><Refresh /></el-icon>
                  手動刷新
                </el-button>
                
                <!-- 資料更新時間按鈕 -->
                <el-button 
                  v-if="['newbie', 'graduate', 'examScore', 'stScore'].includes(selectedDashboard)"
                  type="info"
                  @click="showLastModifiedDialog = true"
                  style="margin-left: 10px;"
                >
                  查看資料更新時間
                </el-button>
                
                <span v-if="crossFunctionalLocked" class="year-lock-notice">
                  (跨功能模式：自動查詢所有年度)
                </span>
              </div>
            </div>
            
            <!-- 跨功能查詢控制區 -->
            <div v-if="selectedDashboard && selectedStudents.size > 0" class="cross-functional-controls">
              <div class="selection-info">
                <span class="selection-count">
                  <el-icon><UserFilled /></el-icon>
                  已選擇 {{ selectedStudents.size }} 位學生
                </span>
                <div class="control-buttons">
                  <el-button 
                    v-if="!crossFunctionalLocked"
                    type="primary" 
                    size="small"
                    @click="lockCrossFunctionalQuery"
                  >
                    加入跨功能查詢名單
                  </el-button>
                  <el-button 
                    v-if="crossFunctionalLocked"
                    type="warning" 
                    size="small"
                    @click="unlockCrossFunctionalQuery"
                  >
                    解除鎖定
                  </el-button>
                  <el-button 
                    type="danger" 
                    size="small"
                    plain
                    @click="clearSelectedStudents"
                  >
                    清除所有選擇
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <template v-if="selectedDashboard === 'newbie'">
        <div 
          v-loading="dashboardLoading" 
          element-loading-text="載入統計資料中..." 
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.7)"
          class="dashboard-loading-container"
        >
          <NewbieDashboard 
            :selected-years="selectedYears" 
            :data-refresh-trigger="dataRefreshing"
            @loading-change="handleDashboardLoadingChange"
            @data-loaded="handleNewbieDataLoaded"
            @show-last-modified="() => showLastModifiedDialog('newbie')"
          />
        </div>
      </template>
      
      <template v-if="selectedDashboard === 'graduate'">
        <div 
          v-loading="dashboardLoading" 
          element-loading-text="載入統計資料中..." 
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.7)"
          class="dashboard-loading-container"
        >
          <GraduateDashboard 
            :selected-year="selectedYear" 
            :data-package="currentDataPackage" 
            @loading-change="handleDashboardLoadingChange" 
            @data-loaded="handleGraduateDataLoaded"
            @show-last-modified="() => showLastModifiedDialog('graduate')"
          />
        </div>
      </template>
      
      <template v-if="selectedDashboard === 'examScore'">
        <div 
          v-loading="dashboardLoading" 
          element-loading-text="載入統計資料中..." 
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.7)"
          class="dashboard-loading-container"
        >
          <ExamScoreDashboard 
            :selected-year="selectedYears" 
            :data-package="currentDataPackage" 
            @loading-change="handleDashboardLoadingChange" 
            @data-loaded="handleExamScoreDataLoaded"
            @show-last-modified="() => showLastModifiedDialog('examScore')"
          />
        </div>
      </template>
      
      <template v-if="selectedDashboard === 'stScore'">
        <div 
          v-loading="dashboardLoading" 
          element-loading-text="載入統計資料中..." 
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.7)"
          class="dashboard-loading-container"
        >
          <STDashboard 
            :selected-year="selectedYears" 
            :data-package="currentDataPackage" 
            @loading-change="handleDashboardLoadingChange" 
            @data-loaded="handleSTDataLoaded"
            @show-last-modified="() => showLastModifiedDialog('stScore')"
          />
        </div>
      </template>
      
      <template v-if="selectedDashboard === 'crossFunctional'">
        <CrossFunctionalQuery />
      </template>
      
      <template v-if="selectedDashboard === 'currentStudent'">
        <div 
          v-loading="dashboardLoading" 
          element-loading-text="載入統計資料中..." 
          element-loading-spinner="el-icon-loading"
          element-loading-background="rgba(0, 0, 0, 0.7)"
          class="dashboard-loading-container"
        >
          <CurrentStudentDashboard 
            :selected-year="selectedYear" 
            :data-package="currentDataPackage" 
            @loading-change="handleDashboardLoadingChange" 
            @data-loaded="handleCurrentStudentDataLoaded"
            @show-last-modified="() => showLastModifiedDialog('currentStudent')"
          />
        </div>
      </template>
      </div> <!-- 結束「已認證時的功能區域」div -->
    </el-main>
    
    <!-- 歡迎overlay -->
    <el-drawer
      v-model="showWelcomeOverlay"
      :title="getOverlayTitle"
      direction="ttb"
      size="80%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="userEmail && userAuthorized && !isFirstLoad"
    >
      <div class="welcome-content">
        <!-- 未登入狀態 - Session API 模式 -->
        <div v-if="!userEmail && !authenticationLoading" class="login-prompt">
          <div class="welcome-icon">🔐</div>
          <h3>請先登入 Google 帳號</h3>
          <p>系統正在使用您的 Google 帳號驗證身份，請確保您已在瀏覽器中登入 Google 帳號。</p>
          <div class="session-login-section">
            <!-- 只有在認證失敗後才顯示重新驗證按鈕 -->
            <el-button 
              type="primary" 
              size="large" 
              @click="reAuthenticate" 
              :loading="authenticationLoading"
              v-if="authenticationFailed"
            >
              <el-icon style="margin-right: 8px;"><UserFilled /></el-icon>
              重新驗證
            </el-button>
            <!-- 初次載入時顯示登入中 -->
            <div v-else class="initial-loading">
              <el-icon class="loading-icon" :size="24">
                <Loading />
              </el-icon>
              <p>登入中...</p>
            </div>
            <!-- 除錯資訊 -->
            <div v-if="manualDebug" class="debug-info">
              <p>驗證模式: Session API (自動驗證)</p>
              <p>無需手動登入</p>
            </div>
            <!-- 登入失敗提示 -->
            <div v-if="authenticationFailed" class="login-failed">
              <p style="color: #f56c6c; font-size: 16px; font-weight: bold; margin-top: 16px; text-align: center;">
                登入失敗
              </p>
              <p v-if="attemptedEmail" style="color: #909399; font-size: 14px; margin-top: 8px; text-align: center;">
                {{ attemptedEmail }} 無權限存取此系統
              </p>
            </div>
          </div>
        </div>
        
        <!-- 載入中狀態 -->
        <div v-else-if="authenticationLoading || permissionsLoading" class="permissions-loading">
          <el-icon class="loading-icon" :size="24">
            <Loading />
          </el-icon>
          <p>{{ authenticationLoading ? '正在驗證身分...' : '權限檢查中，請稍候...' }}</p>
        </div>
        
        <!-- 無權限狀態 -->
        <div v-else-if="userEmail && !userAuthorized && !permissionsLoading" class="no-permission">
          <div class="welcome-icon">❌</div>
          <h3>無權限存取</h3>
          <p>您的帳號 ({{ userEmail }}) 無權限存取此系統。</p>
          <p>如需協助，請聯繫系統管理員。</p>
          <el-button @click="signOut">重新登入</el-button>
        </div>
        
        <!-- 有權限，顯示功能選擇 -->
        <div v-else-if="userAuthorized">
          <div v-if="isFirstLoad" class="welcome-icon">🎓</div>
          <h3 v-else>請選擇您要使用的功能：</h3>
          
          <!-- 功能選擇卡片 -->
          <div class="function-grid">
          <el-card
            class="function-card" 
            @click="selectFunction('newbie')"
            :class="{ 'hover-card': true, 'loading-card': selectedDashboard === 'newbie' && dashboardLoading }"
            v-loading="selectedDashboard === 'newbie' && dashboardLoading"
            element-loading-text="載入中..."
          >
            <div class="function-header">
              <div class="function-icon">👥</div>
              <div v-if="dataPackages.newbie" class="data-status">
                <el-icon color="#67c23a" size="12"><CircleCheckFilled /></el-icon>
                <span class="status-text">已下載</span>
              </div>
            </div>
            <h4>歷年新生統計</h4>
            <p>查看新生入學相關統計資料</p>
          </el-card>
          
          <el-card
            class="function-card" 
            @click="selectFunction('graduate')"
            :class="{ 'hover-card': true, 'loading-card': selectedDashboard === 'graduate' && dashboardLoading }"
            v-loading="selectedDashboard === 'graduate' && dashboardLoading"
            element-loading-text="載入中..."
          >
            <div class="function-header">
              <div class="function-icon">🎯</div>
              <div v-if="dataPackages.graduate" class="data-status">
                <el-icon color="#67c23a" size="12"><CircleCheckFilled /></el-icon>
                <span class="status-text">已下載</span>
              </div>
            </div>
            <h4>畢業生流向統計</h4>
            <p>分析畢業生升學流向</p>
          </el-card>
          
          <el-card
            class="function-card" 
            @click="selectFunction('examScore')"
            :class="{ 'hover-card': true, 'loading-card': selectedDashboard === 'examScore' && dashboardLoading }"
            v-loading="selectedDashboard === 'examScore' && dashboardLoading"
            element-loading-text="載入中..."
          >
            <div class="function-header">
              <div class="function-icon">📊</div>
              <div v-if="dataPackages.examScore" class="data-status">
                <el-icon color="#67c23a" size="12"><CircleCheckFilled /></el-icon>
                <span class="status-text">已下載</span>
              </div>
            </div>
            <h4>學測分數統計</h4>
            <p>查看學測成績分析</p>
          </el-card>
          
          <el-card
            class="function-card" 
            @click="selectFunction('stScore')"
            :class="{ 'hover-card': true, 'loading-card': selectedDashboard === 'stScore' && dashboardLoading }"
            v-loading="selectedDashboard === 'stScore' && dashboardLoading"
            element-loading-text="載入中..."
          >
            <div class="function-header">
              <div class="function-icon">📈</div>
              <div v-if="dataPackages.stScore" class="data-status">
                <el-icon color="#67c23a" size="12"><CircleCheckFilled /></el-icon>
                <span class="status-text">已下載</span>
              </div>
            </div>
            <h4>分科成績統計</h4>
            <p>分析分科測驗成績</p>
          </el-card>
          
          <el-card
            class="function-card" 
            @click="selectFunction('currentStudent')"
            :class="{ 'hover-card': true, 'loading-card': selectedDashboard === 'currentStudent' && dashboardLoading }"
            v-loading="selectedDashboard === 'currentStudent' && dashboardLoading"
            element-loading-text="載入中..."
          >
            <div class="function-header">
              <div class="function-icon">📚</div>
              <div v-if="dataPackages.currentStudent" class="data-status">
                <el-icon color="#67c23a" size="12"><CircleCheckFilled /></el-icon>
                <span class="status-text">已下載</span>
              </div>
            </div>
            <h4>當學期學生名單查詢</h4>
            <p>查詢當學期學生詳細名單</p>
          </el-card>
          </div>
        </div>
      </div>
    </el-drawer>
    
    <!-- 跨功能查詢抽屜 -->
    <el-drawer
      v-model="showCrossFunctionalDialog"
      title="跨功能查詢"
      direction="ttb"
      size="70%"
      :show-close="true"
      :close-on-click-modal="false"
      @close="handleCrossFunctionalDialogClose"
    >
      <div class="cross-functional-content">
        <!-- 簡化的表格，只顯示已選擇的學生 -->
        <el-table
          :data="crossFunctionalPaginatedData"
          v-loading="crossFunctionalLoading"
          stripe
          style="width: 100%"
          @selection-change="handleCrossFunctionalSelectionChange"
        >
          <el-table-column
            type="selection"
            width="55"
            fixed
          />
          <el-table-column
            prop="uid"
            label="身分證號"
            show-overflow-tooltip
          />
          <el-table-column
            prop="source"
            label="勾選來源"
            width="120"
          />
        </el-table>
        
        <!-- 分頁 -->
        <div style="margin-top: 20px; text-align: center;">
          <el-pagination
            v-model:current-page="crossFunctionalCurrentPage"
            v-model:page-size="crossFunctionalPageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="crossFunctionalSelectedList.length"
          />
        </div>
        
        <!-- 操作按鈕 -->
        <div style="margin-top: 20px; text-align: right;">
          <el-button 
            type="danger" 
            @click="removeCrossFunctionalSelected"
            :disabled="crossFunctionalSelection.length === 0"
          >
            移除選中項目
          </el-button>
          <el-button 
            type="warning" 
            @click="clearAllCrossFunctionalSelection"
            :disabled="crossFunctionalUIDs.length === 0"
          >
            清空全部
          </el-button>
        </div>
      </div>
    </el-drawer>
    
    <!-- 認證對話框 -->
    <AuthDialog 
      v-model="showAuthDialog" 
      @authenticated="customHandleAuthenticated"
    />
    
    <!-- 頁面底部連結 -->
    <footer class="app-footer" style="color:#333; text-align:center">Kelunyang@2025</footer>
  </el-container>
</template>

<script setup>
import { ref, provide, onMounted, computed, onUnmounted } from 'vue'
import { UserFilled, Loading, Menu, Refresh, CircleCheckFilled, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import NewbieDashboard from './components/NewbieDashboard.vue'
import GraduateDashboard from './components/GraduateDashboard.vue'
import ExamScoreDashboard from './components/ExamScoreDashboard.vue'
import STDashboard from './components/STDashboard.vue'
import CrossFunctionalQuery from './components/CrossFunctionalQuery.vue'
import CurrentStudentDashboard from './components/CurrentStudentDashboard.vue'
import AuthDialog from './components/AuthDialog.vue'
import { apiService } from './services/apiService'
import { optimizedApiService } from './services/optimizedApiService'
import { useLastModified } from './composables/useLastModified'
import { useAuth } from './composables/useAuth'

const selectedDashboard = ref('')
const selectedYear = ref('') // 初始化為空字串，等待年份載入
const selectedYears = ref([]) // 新生模式的多選年份
const availableYears = ref([])
const dataRefreshing = ref(false) // 手動刷新狀態
const yearLoading = ref(false)
// 為每個功能創建獨立的數據包存儲，避免功能間數據互相覆蓋
const dataPackages = ref({
  newbie: null,
  graduate: null, 
  examScore: null,
  stScore: null,
  currentStudent: null
})

// 當前活躍的數據包（向後兼容）
const currentDataPackage = computed(() => {
  return dataPackages.value[selectedDashboard.value] || null
})
const dashboardLoading = ref(false)
const showWelcomeOverlay = ref(false) // 預設隱藏，只有認證成功後才顯示
const isFirstLoad = ref(true)
const hasSelectedFunction = ref(false)
const showFunctionSelector = () => {
  // 只有在已認證的情況下才顯示功能選單
  if (isAuthenticated.value && authChecked.value) {
    isFirstLoad.value = false
    showWelcomeOverlay.value = true
  } else {
    // 未認證時顯示認證對話框
    showAuthDialog.value = true
  }
}

// 直接設定所有權限狀態
const tabPermissions = ref({
  newbie: true,
  graduate: true,
  examScore: true,
  stScore: true,
  crossFunctional: true,
  currentStudent: true
})
const userGroups = ref(['所有人'])
const permissionsLoading = ref(false)

// 直接設定為已登入狀態
const userEmail = ref('default@app.lksh.ntpc.edu.tw')
const userAuthorized = ref(true)
const authenticationLoading = ref(false)
const authenticationFailed = ref(false)
const attemptedEmail = ref('')
const manualDebug = ref(false)

// 認證系統設定
const { 
  isAuthenticated, 
  authChecked, 
  showAuthDialog, 
  handleAuthenticated, 
  logout, 
  initAuth, 
  destroyAuth 
} = useAuth()

// 調試輸出輔助函數（遵循manualDebug設定）
const debugLog = (...args) => {
  if (!manualDebug.value) {
    console.log(...args)
  }
}

const debugWarn = (...args) => {
  if (!manualDebug.value) {
    console.warn(...args)
  }
}

const debugError = (...args) => {
  // error 始終輸出，不受 manualDebug 影響
  console.error(...args)
}

// 會話進度管理
const sessionProgress = ref(100) // 百分比
const sessionTimer = ref(null)
const warningShown = ref(false)
const renewalTimer = ref(null)

// 格式化剩餘時間
const formatRemainingTime = () => {
  const remaining = apiService.getRemainingTime()
  
  if (remaining <= 0) return '0s'
  
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  
  if (minutes > 0) {
    return `${minutes}m${seconds}s`
  }
  return `${seconds}s`
}

// 進度條顏色
const getProgressColor = () => {
  if (sessionProgress.value > 70) return '#67c23a'
  if (sessionProgress.value > 30) return '#e6a23c'
  return '#f56c6c'
}

// 更新會話進度
const updateSessionProgress = () => {
  if (!apiService.lastApiAccessTime || !apiService.activeTime) {
    debugLog('會話資訊未初始化，跳過更新')
    sessionProgress.value = 0
    return
  }
  
  const remaining = apiService.getRemainingTime()
  const activeTime = apiService.activeTime // 後端已經返回秒為單位
  
  debugLog('更新會話進度:', {
    remaining: remaining,
    activeTime: activeTime,
    lastApiAccessTime: apiService.lastApiAccessTime,
    currentTime: Math.floor(Date.now() / 1000)
  })
  
  if (remaining <= 0) {
    sessionProgress.value = 0
    handleSessionExpired()
    return
  }
  
  sessionProgress.value = Math.max(0, Math.min(100, (remaining / activeTime) * 100))
  debugLog('會話進度已更新:', sessionProgress.value + '%', '剩餘:', remaining, '秒')
  
  // 當時間少於5分鐘時顯示警告
  if (remaining <= 300 && !warningShown.value) {
    showSessionWarning()
  }
}

// 顯示會話即將過期警告
const showSessionWarning = async () => {
  warningShown.value = true
  
  try {
    await ElMessage.warning({
      message: '您的會話即將過期，是否繼續使用？',
      duration: 0,
      showClose: true,
      onClose: () => {
        // 用戶關镘9警告時，嘗試重新整理會話
        renewSession()
      }
    })
  } catch (error) {
    debugError('顯示會話警告失敗:', error)
  }
}

// 刷新會話
const renewSession = async () => {
  try {
    const result = await apiService.renewSession()
    if (result.success) {
      warningShown.value = false
      ElMessage.success('會話已刷新，倒數計時器已重置')
      // 不需要手動呼叫 updateSessionProgress，定時器會自動更新
    } else {
      if (result.needAuth) {
        handleSessionExpired()
      } else {
        ElMessage.error('刷新會話失敗：' + result.error)
      }
    }
  } catch (error) {
    debugError('刷新會話失敗:', error)
    ElMessage.error('刷新會話失敗')
  }
}

// 處理會話過期
const handleSessionExpired = () => {
  sessionProgress.value = 0
  warningShown.value = false
  
  // 清空定時器
  if (sessionTimer.value) {
    clearInterval(sessionTimer.value)
    sessionTimer.value = null
  }
  if (renewalTimer.value) {
    clearTimeout(renewalTimer.value)
    renewalTimer.value = null
  }
  
  // 顯示重新登入對話框
  showAuthDialog.value = true
  ElMessage.error('會話已過期，請重新登入')
}

// 啟動會話監控
const startSessionMonitoring = () => {
  debugLog('啟動會話監控')
  
  // 清空現有定時器
  if (sessionTimer.value) {
    clearInterval(sessionTimer.value)
  }
  
  // 立即更新一次
  updateSessionProgress()
  
  // 每秒更新進度
  sessionTimer.value = setInterval(() => {
    debugLog('定時器觸發，更新會話進度')
    updateSessionProgress()
  }, 1000)
  
  debugLog('會話監控已啟動，定時器 ID:', sessionTimer.value)
}

// 停止會話監控
const stopSessionMonitoring = () => {
  if (sessionTimer.value) {
    clearInterval(sessionTimer.value)
    sessionTimer.value = null
  }
  if (renewalTimer.value) {
    clearTimeout(renewalTimer.value)
    renewalTimer.value = null
  }
  sessionProgress.value = 0
  warningShown.value = false
}

// 處理認證成功後的設置
const setupUserPermissions = () => {
  userEmail.value = 'default@app.lksh.ntpc.edu.tw'
  userAuthorized.value = true
  authenticationFailed.value = false
  
  // 設定所有權限為 true
  tabPermissions.value = {
    newbie: true,
    graduate: true,
    examScore: true,
    stScore: true,
    crossFunctional: true,
    currentStudent: true
  }
  
  userGroups.value = ['所有人']
  debugLog('認證成功，權限已設定:', userEmail.value)
}

// 重寫認證處理函數
const customHandleAuthenticated = async () => {
  handleAuthenticated()
  setupUserPermissions()
  
  // 獲取會話資訊並初始化時間
  try {
    const authStatus = await apiService.getAuthStatus()
    if (authStatus.success && authStatus.authenticated) {
      // 設置會話資訊，這會重置 sessionStartTime
      apiService.resetSessionTimer(
        authStatus.apiAccessTime || Math.floor(Date.now() / 1000), 
        authStatus.activeTime || 1800
      )
      debugLog('會話資訊已初始化:', {
        apiAccessTime: authStatus.apiAccessTime,
        activeTime: authStatus.activeTime
      })
    }
  } catch (error) {
    debugError('獲取會話資訊失敗:', error)
    // 使用預設值（30分鐘 = 1800秒）
    const currentTime = Math.floor(Date.now() / 1000)
    apiService.resetSessionTimer(currentTime, 1800)
  }
  
  // 啟動會話監控
  startSessionMonitoring()
  
  // 執行回調函數（如果有的話）
  if (authSuccessCallback) {
    try {
      authSuccessCallback()
    } catch (error) {
      debugError('執行認證成功回調失敗:', error)
    }
    authSuccessCallback = null // 清除回調
  }
  
  // 認證成功後允許顯示功能選單
  setTimeout(() => {
    if (!selectedDashboard.value) {
      showWelcomeOverlay.value = true
    }
  }, 500) // 給一點時間讓認證狀態更新
}

// localStorage 相關函數 - 跨功能查詢名單管理
const STORAGE_KEY = 'crossFunctionalLockedStudents'
const CROSS_FUNCTIONAL_STORAGE_KEY = 'crossFunctionalSelectedUIDs'

const getLockedStudentsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const studentData = JSON.parse(stored)
      debugLog('從 localStorage 讀取鎖定名單，數量:', studentData.length)
      debugLog('從 localStorage 讀取鎖定名單，前3筆:', studentData.slice(0, 3))
      return studentData.length > 0 ? studentData : null
    }
  } catch (error) {
    debugError('讀取鎖定名單失敗:', error)
  }
  return null
}

const saveLockedStudentsToStorage = (studentIds) => {
  try {
    if (studentIds && studentIds.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(studentIds))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (error) {
    debugError('保存鎖定名單失敗:', error)
  }
}

const clearLockedStudentsFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    debugError('清除鎖定名單失敗:', error)
  }
}

// 跨功能查詢 UID 管理 - 新結構: [{uid: string, source: string}]
const getCrossFunctionalUIDsFromStorage = () => {
  try {
    const stored = localStorage.getItem(CROSS_FUNCTIONAL_STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      debugLog('從 localStorage 讀取跨功能查詢資料，數量:', data.length)
      return data.length > 0 ? data : []
    }
  } catch (error) {
    debugError('讀取跨功能查詢資料失敗:', error)
  }
  return []
}

const saveCrossFunctionalUIDsToStorage = (data) => {
  try {
    if (data && data.length > 0) {
      localStorage.setItem(CROSS_FUNCTIONAL_STORAGE_KEY, JSON.stringify(data))
    } else {
      localStorage.removeItem(CROSS_FUNCTIONAL_STORAGE_KEY)
    }
  } catch (error) {
    debugError('保存跨功能查詢資料失敗:', error)
  }
}


// 跨功能查詢相關狀態
const selectedStudents = ref(new Map()) // 臨時選擇的學生資料 Map<idNumber, studentData>
const lockedStudents = ref(getLockedStudentsFromStorage()) // 已鎖定的學生資料
const crossFunctionalLocked = computed(() => lockedStudents.value && lockedStudents.value.length > 0)

// 跨功能查詢 UID 系統 - 新結構: [{uid: string, source: string}]
const crossFunctionalUIDs = ref(getCrossFunctionalUIDsFromStorage()) // 跨功能查詢的資料陣列

// 資料表最後修改時間功能
const { showLastModifiedDialog, showDataLoadedNotification } = useLastModified()

// 跨功能查詢對話框狀態
const showCrossFunctionalDialog = ref(false)
const crossFunctionalLoading = ref(false)
const crossFunctionalCurrentPage = ref(1)
const crossFunctionalPageSize = ref(20)
const crossFunctionalSelection = ref([])

// 跨功能查詢選中的學生列表（基於新的結構）
const crossFunctionalSelectedList = computed(() => {
  return crossFunctionalUIDs.value || []
})

// 跨功能查詢分頁數據
const crossFunctionalPaginatedData = computed(() => {
  const start = (crossFunctionalCurrentPage.value - 1) * crossFunctionalPageSize.value
  const end = start + crossFunctionalPageSize.value
  return crossFunctionalSelectedList.value.slice(start, end)
})

// 跨功能查詢名單標籤
const crossFunctionalTabLabel = computed(() => {
  const count = selectedStudents.value.size
  return count > 0 ? `跨功能查詢名單 (${count})` : '跨功能查詢名單'
})

// 跨功能查詢對話框方法

const handleCrossFunctionalSelectionChange = (selection) => {
  crossFunctionalSelection.value = selection
}

const handleCrossFunctionalDialogClose = () => {
  crossFunctionalSelection.value = []
  crossFunctionalCurrentPage.value = 1
}

const removeCrossFunctionalSelected = () => {
  if (crossFunctionalSelection.value.length === 0) return
  
  const removeCount = crossFunctionalSelection.value.length
  
  crossFunctionalSelection.value.forEach(selectedItem => {
    const uid = selectedItem.uid
    removeFromCrossFunctionalUIDs(uid)
  })
  
  crossFunctionalSelection.value = []
  ElMessage.success(`已移除 ${removeCount} 位學生`)
}

const clearAllCrossFunctionalSelection = () => {
  crossFunctionalUIDs.value = []
  saveCrossFunctionalUIDsToStorage([])
  crossFunctionalSelection.value = []
  ElMessage.success('已清空所有跨功能查詢的學生')
}

// 功能名稱對應表
const getFunctionDisplayName = (dashboard) => {
  const functionNames = {
    'newbie': '新生統計',
    'graduate': '畢業生統計', 
    'examScore': '學測成績',
    'stScore': '分科成績',
    'currentStudent': '當學期名單'
  }
  return functionNames[dashboard] || dashboard
}

// UID 管理函數 - 更新為新結構
const addToCrossFunctionalUIDs = (uid, source = null) => {
  if (!uid) return
  
  // 使用當前選中的功能作為來源，如果沒有提供source的話
  const sourceFunction = source || selectedDashboard.value
  const displaySource = getFunctionDisplayName(sourceFunction)
  
  // 檢查是否已存在
  const existingIndex = crossFunctionalUIDs.value.findIndex(item => item.uid === uid)
  if (existingIndex === -1) {
    crossFunctionalUIDs.value.push({ uid, source: displaySource })
    saveCrossFunctionalUIDsToStorage(crossFunctionalUIDs.value)
    debugLog(`跨功能查詢新增: ${uid} (來源: ${displaySource})`)
  }
}

const removeFromCrossFunctionalUIDs = (uid) => {
  const index = crossFunctionalUIDs.value.findIndex(item => item.uid === uid)
  if (index > -1) {
    crossFunctionalUIDs.value.splice(index, 1)
    saveCrossFunctionalUIDsToStorage(crossFunctionalUIDs.value)
    debugLog(`跨功能查詢移除: ${uid}`)
  }
}

const isCrossFunctionalSelected = (uid) => {
  return crossFunctionalUIDs.value.some(item => item.uid === uid)
}


const handleDashboardChange = async (value) => {
  debugLog('=== handleDashboardChange 呼叫 ===')
  debugLog('Selected dashboard:', value)
  
  if (value === 'currentStudent') {
    debugLog('=== currentStudent dashboard change ===')
    debugLog('當前數據包載入狀態:', !!currentDataPackage.value)
    
    // currentStudent 功能不使用跨功能查詢，有自己的年份學期選擇器
    yearLoading.value = true
    dashboardLoading.value = true
    
    // 對於 currentStudent，載入 'latest' 數據包（包含最新的 currentStudents 數據）
    await loadCompleteDataPackage('latest', 'currentStudent')
    
    yearLoading.value = false
    // dashboardLoading會由子組件控制
  } else if (value === 'newbie' || value === 'graduate' || value === 'examScore' || value === 'stScore') {
    // 如果有鎖定名單，不需要載入年份資料
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      debugLog('有鎖定名單，跳過年份載入，直接使用跨功能查詢')
      dashboardLoading.value = true
      return
    }
    
    yearLoading.value = true
    dashboardLoading.value = true
    
    // 優化：使用統一的年份載入
    await loadOptimizedAvailableYears()
    
    yearLoading.value = false
    // dashboardLoading 會由 loadOptimizedAvailableYears 中的 loadCompleteDataPackage 負責設定
  } else if (value === 'crossFunctional') {
    // 跨功能查詢立即完成載入
    setTimeout(() => {
      dashboardLoading.value = false
    }, 500) // 短暫延遲讓使用者看到載入效果
  } else if (value === 'newbie') {
    // 新生模式使用自己的載入系統，只載入年份選項但不載入數據包
    debugLog('🚀 新生模式：只載入年份選項，跳過數據包載入')
    yearLoading.value = true
    
    try {
      const yearsResult = await optimizedApiService.getAvailableYears()
      if (yearsResult && yearsResult.all && Array.isArray(yearsResult.all)) {
        availableYears.value = yearsResult.all
        if (yearsResult.all.length > 0) {
          // 只有新生模式預設選中所有年份，學測和分科保持空陣列（相當於all狀態）
          if (selectedDashboard.value === 'newbie') {
            selectedYears.value = [...yearsResult.all]
            debugLog('🎯 新生模式設定預設年份:', selectedYears.value)
          } else {
            selectedYears.value = []
            debugLog('🎯 學測/分科模式保持預設狀態（顯示所有年份）')
          }
        }
      }
    } catch (error) {
      debugError('新生模式載入年份失敗:', error)
    }
    
    yearLoading.value = false
    dashboardLoading.value = false
  }
}

const handleYearChange = async () => {
  debugLog('年份變更為:', selectedYear.value)
  
  // 新生、學測、分科模式跳過數據包載入（使用前端過濾）
  if (['newbie', 'examScore', 'stScore'].includes(selectedDashboard.value)) {
    debugLog(`🚀 ${selectedDashboard.value} 模式年份變更，使用前端過濾，跳過數據包載入`)
    return
  }
  
  dashboardLoading.value = true
  
  // 優化：載入數據包（僅對於需要後端請求的 dashboard）
  await loadCompleteDataPackage(selectedYear.value, selectedDashboard.value)
  
  dashboardLoading.value = false
}

// 新生模式多選年份變更
const handleYearsChange = () => {
  debugLog('新生模式年份變更為:', selectedYears.value)
  // 新生模式不需要重新載入數據，只需要前端篩選
}

// 手動刷新數據
const handleManualRefresh = async () => {
  debugLog('🔄 手動刷新新生資料')
  dataRefreshing.value = true
  
  try {
    // 清除現有資料，強制重新載入
    if (selectedDashboard.value) {
      dataPackages.value[selectedDashboard.value] = null
    }
    
    // 觸發 NewbieDashboard 重新載入
    ElMessage.info('正在重新載入資料...')
    
    // 等待一小段時間讓組件響應
    setTimeout(() => {
      dataRefreshing.value = false
      ElMessage.success('資料刷新完成')
    }, 1000)
    
  } catch (error) {
    debugError('手動刷新失敗:', error)
    ElMessage.error('刷新失敗')
    dataRefreshing.value = false
  }
}

const handleDashboardLoadingChange = (loading) => {
  dashboardLoading.value = loading
}

// 處理新生統計數據載入完成事件
const handleNewbieDataLoaded = (dataInfo) => {
  debugLog('NewbieDashboard 數據載入完成:', dataInfo)
  // 設置 dataPackages 以顯示"已下載"狀態
  dataPackages.value.newbie = {
    metadata: dataInfo.metadata,
    data: dataInfo.data
  }
  debugLog('✅ 新生統計數據包已設置，顯示已下載狀態')
  
  // 顯示資料表最後更新時間通知
  showDataLoadedNotification('newbie')
}

// 處理畢業生流向數據載入完成事件
const handleGraduateDataLoaded = () => {
  showDataLoadedNotification('graduate')
}

// 處理學測成績數據載入完成事件
const handleExamScoreDataLoaded = () => {
  showDataLoadedNotification('examScore')
}

// 處理分科成績數據載入完成事件
const handleSTDataLoaded = () => {
  showDataLoadedNotification('stScore')
}

// 處理當學期名單數據載入完成事件
const handleCurrentStudentDataLoaded = () => {
  showDataLoadedNotification('currentStudent')
}

// 選擇功能
const selectFunction = (functionName) => {
  debugLog('=== selectFunction 呼叫 ===')
  debugLog('選擇的功能:', functionName)
  debugLog('當前數據包:', dataPackages.value[functionName])
  
  if (functionName === 'currentStudent') {
    debugLog('=== currentStudent 功能選擇 ===')
    debugLog('currentStudent 權限:', tabPermissions.value.currentStudent)
    const currentStudentPackage = dataPackages.value.currentStudent
    debugLog('數據包存在:', !!currentStudentPackage)
    debugLog('currentStudents 數據存在:', !!currentStudentPackage?.currentStudents)
    if (currentStudentPackage?.currentStudents) {
      debugLog('currentStudents 數據結構:', {
        dataLength: currentStudentPackage.currentStudents.data?.length,
        byYearSemesterKeys: Object.keys(currentStudentPackage.currentStudents.byYearSemester || {}),
        count: currentStudentPackage.currentStudents.count
      })
    }
  }
  
  // 立即關閉 overlay
  isFirstLoad.value = false
  hasSelectedFunction.value = true
  showWelcomeOverlay.value = false
  selectedDashboard.value = functionName
  dashboardLoading.value = true // 開始載入
  handleDashboardChange(functionName)
}

// 優化：統一的年份載入函數
const loadOptimizedAvailableYears = async () => {
  try {
    const yearsResult = await optimizedApiService.getAvailableYears()
    if (yearsResult && yearsResult.all && Array.isArray(yearsResult.all)) {
      availableYears.value = yearsResult.all
      // 總是選擇最新的年份
      if (yearsResult.all.length > 0) {
        selectedYear.value = yearsResult.all[0]
        debugLog('設定預設年份:', selectedYear.value)
        // 只有當 selectedDashboard 存在且不是新生模式時才載入數據包
        if (selectedDashboard.value && selectedDashboard.value !== 'newbie') {
          debugLog('載入數據包:', selectedYear.value, selectedDashboard.value)
          await loadCompleteDataPackage(selectedYear.value, selectedDashboard.value)
        } else if (selectedDashboard.value === 'newbie') {
          debugLog('🚀 新生模式跳過年份載入時的數據包載入')
        }
      }
    }
  } catch (error) {
    debugError('Failed to load optimized available years:', error)
  }
}

// 優化：載入完整數據包（為每個功能獨立存儲）
const loadCompleteDataPackage = async (year, dashboardType = null) => {
  try {
    // 新生模式使用自己的載入系統，跳過數據包載入
    if (dashboardType === 'newbie') {
      debugLog('🚀 新生模式跳過數據包載入，使用組件內載入')
      // 不設為null，讓NewbieDashboard組件在數據載入完成後設置
      return
    }
    
    debugLog(`=== loadCompleteDataPackage 呼叫 ===`)
    debugLog(`載入 ${year} 年度數據包，功能類型: ${dashboardType}`)
    
    // 檢查是否已經有當前功能的數據包
    if (dataPackages.value[dashboardType]) {
      debugLog(`📦 ${dashboardType} 數據包已存在，跳過載入`)
      return
    }
    
    const dataPackage = await optimizedApiService.getCompleteDataPackage(year, dashboardType)
    dataPackages.value[dashboardType] = dataPackage
    debugLog(`✅ ${dashboardType} 數據包載入完成:`, dataPackage.metadata)
    debugLog('數據包包含的數據類型:', Object.keys(dataPackage))
    debugLog('currentStudents 是否存在:', !!dataPackage.currentStudents)
    if (dataPackage.currentStudents) {
      debugLog('currentStudents 結構:', {
        dataCount: dataPackage.currentStudents.data?.length,
        byYearSemesterCount: Object.keys(dataPackage.currentStudents.byYearSemester || {}).length,
        totalCount: dataPackage.currentStudents.count
      })
    }
  } catch (error) {
    debugError('Failed to load complete data package:', error)
    ElMessage.error('數據載入失敗')
  }
}

// 跨功能查詢相關函數
const handleStudentSelection = (studentData, isSelected) => {
  // 只有在未鎖定狀態下才能選擇學生
  if (!crossFunctionalLocked.value) {
    if (isSelected && studentData && studentData.idNumber) {
      // 存儲完整的學生資料
      selectedStudents.value.set(studentData.idNumber, {
        idNumber: studentData.idNumber,
        name: studentData.name || studentData['姓名'],
        registrationNumber: studentData.registrationNumber || studentData['報名序號'] || studentData['學測報名序號'],
        originalIdNumber: studentData.originalIdNumber || studentData['原始身分證字號'],
        year: studentData.year || studentData['考試年分'] || studentData['入學年分'] || studentData['榜單年分']
      })
    } else if (!isSelected && studentData && studentData.idNumber) {
      selectedStudents.value.delete(studentData.idNumber)
    }
    // 強制觸發reactive更新
    selectedStudents.value = new Map(selectedStudents.value)
  }
}

const lockCrossFunctionalQuery = () => {
  if (selectedStudents.value.size > 0) {
    // 將Map轉換為陣列格式儲存
    const studentDataArray = Array.from(selectedStudents.value.values())
    debugLog('鎖定跨功能查詢，選中學生數量:', studentDataArray.length)
    debugLog('鎖定跨功能查詢，前3筆學生資料:', studentDataArray.slice(0, 3))
    
    // 保存到 localStorage（儲存完整資料）
    saveLockedStudentsToStorage(studentDataArray)
    lockedStudents.value = studentDataArray
    
    // 鎖定時自動設定為查詢所有年度
    selectedYear.value = 'all'
    
    // 清空臨時選擇
    selectedStudents.value.clear()
  }
}

const unlockCrossFunctionalQuery = async () => {
  debugLog('解除跨功能查詢鎖定')
  
  // 清除 localStorage 中的鎖定名單
  clearLockedStudentsFromStorage()
  lockedStudents.value = null
  
  // 清空臨時選擇
  selectedStudents.value.clear()
  
  // 如果當前有選中的dashboard，需要重新載入整個tab
  if (selectedDashboard.value && selectedDashboard.value !== 'crossFunctional') {
    debugLog('重新載入整個tab:', selectedDashboard.value)
    
    // 重設載入狀態
    yearLoading.value = true
    dashboardLoading.value = true
    
    // 優化：重新載入統一年份資料
    try {
      await loadOptimizedAvailableYears()
    } catch (error) {
      debugError('重新載入年份資料失敗:', error)
    } finally {
      yearLoading.value = false
      // dashboardLoading會由子組件控制
    }
  }
  
  // 如果沒有選中dashboard或是crossFunctional，確保年份恢復到最新
  if (availableYears.value.length > 0) {
    selectedYear.value = availableYears.value[0]
  }
}

const clearSelectedStudents = () => {
  selectedStudents.value.clear()
  selectedStudents.value = new Map(selectedStudents.value)
}

// 添加學生到鎖定名單（追加，不覆蓋）
const addStudentsToLockedList = (newStudentDataArray) => {
  if (!Array.isArray(newStudentDataArray) || newStudentDataArray.length === 0) {
    return
  }
  
  // 獲取當前已鎖定的學生資料
  const currentLocked = lockedStudents.value ? [...lockedStudents.value] : []
  
  // 建立ID Set來檢查重複
  const existingIds = new Set(currentLocked.map(s => s.idNumber))
  
  // 只添加不存在的學生
  const newStudents = newStudentDataArray.filter(s => !existingIds.has(s.idNumber))
  
  // 合併資料
  const allStudents = [...currentLocked, ...newStudents]
  
  debugLog('添加學生到鎖定名單，當前鎖定數量:', currentLocked.length)
  debugLog('新增學生數量:', newStudents.length)
  debugLog('合併後總數量:', allStudents.length)
  
  // 保存到 localStorage
  saveLockedStudentsToStorage(allStudents)
  lockedStudents.value = allStudents
  
  // 鎖定時自動設定為查詢所有年度
  selectedYear.value = 'all'
  
  return allStudents.length
}

// 從鎖定名單中移除指定學生
const removeStudentsFromLockedList = (studentIdsToRemove) => {
  if (!Array.isArray(studentIdsToRemove) || studentIdsToRemove.length === 0) {
    return
  }
  
  // 獲取當前已鎖定的學生資料
  const currentLocked = lockedStudents.value ? [...lockedStudents.value] : []
  
  // 移除指定的學生
  const remainingStudents = currentLocked.filter(student => !studentIdsToRemove.includes(student.idNumber))
  
  debugLog('從鎖定名單移除學生，當前鎖定數量:', currentLocked.length)
  debugLog('移除學生數量:', studentIdsToRemove.length)
  debugLog('剩餘學生數量:', remainingStudents.length)
  
  // 更新localStorage和狀態
  if (remainingStudents.length > 0) {
    saveLockedStudentsToStorage(remainingStudents)
    lockedStudents.value = remainingStudents
  } else {
    // 如果沒有剩餘學生，完全解除鎖定
    unlockCrossFunctionalQuery()
  }
  
  return remainingStudents.length
}

// 提供給子組件使用
provide('selectedYear', selectedYear)
provide('availableYears', availableYears)
provide('currentDataPackage', currentDataPackage) // 優化：提供數據包
provide('selectedStudents', selectedStudents)
provide('lockedStudents', lockedStudents)
provide('crossFunctionalLocked', crossFunctionalLocked)
provide('handleStudentSelection', handleStudentSelection)
provide('unlockCrossFunctionalQuery', unlockCrossFunctionalQuery)
provide('addStudentsToLockedList', addStudentsToLockedList)
provide('removeStudentsFromLockedList', removeStudentsFromLockedList)
// 新的 UID 系統
provide('crossFunctionalUIDs', crossFunctionalUIDs)
provide('addToCrossFunctionalUIDs', addToCrossFunctionalUIDs)
provide('removeFromCrossFunctionalUIDs', removeFromCrossFunctionalUIDs)
provide('isCrossFunctionalSelected', isCrossFunctionalSelected)


// 檢測是否在 iframe 中運行
const isInIframe = () => {
  try {
    return window.self !== window.top
  } catch (e) {
    return true
  }
}

// Session API 重新驗證 (已停用權限檢查)
const reAuthenticate = async () => {
  debugLog('重新驗證用戶身份... (已停用權限檢查)')
  authenticationLoading.value = true
  authenticationFailed.value = false
  
  // 檢查是否在 iframe 中運行
  if (isInIframe()) {
    debugLog('檢測到在 iframe 環境中運行，跳過 Google 認證')
    // 在 iframe 中直接設定為已認證
    userEmail.value = 'iframe-user@app.lksh.ntpc.edu.tw'
    userAuthorized.value = true
    authenticationFailed.value = false
    
    // 設定所有權限為 true
    tabPermissions.value = {
      newbie: true,
      graduate: true,
      examScore: true,
      stScore: true,
      crossFunctional: true,
      currentStudent: true
    }
    
    userGroups.value = ['iframe用戶']
    
    debugLog('iframe 環境驗證成功:', userEmail.value)
    ElMessage.success('iframe 環境驗證成功！')
  } else {
    // 不在 iframe 中，使用一般驗證流程
    userEmail.value = 'default@app.lksh.ntpc.edu.tw'
    userAuthorized.value = true
    authenticationFailed.value = false
    
    // 設定所有權限為 true
    tabPermissions.value = {
      newbie: true,
      graduate: true,
      examScore: true,
      stScore: true,
      crossFunctional: true,
      currentStudent: true
    }
    
    userGroups.value = ['所有人']
    
    debugLog('重新驗證成功 (已停用權限檢查):', userEmail.value)
    ElMessage.success('驗證成功！')
  }
  
  if (!isFirstLoad.value) {
    showWelcomeOverlay.value = false
  }
  
  authenticationLoading.value = false
  
  /* 原始權限驗證代碼 - 已停用
  try {
    const result = await apiService.getUserTabPermissions()
    
    if (result.success) {
      userEmail.value = result.userEmail
      userAuthorized.value = true
      authenticationFailed.value = false
      
      // 將中文權限名稱轉換為英文屬性名稱
      const permissionMapping = {
        '歷年新生統計': 'newbie',
        '畢業生流向統計': 'graduate',
        '學測分數統計': 'examScore',
        '分科成績統計': 'stScore',
        '跨功能查詢名單': 'crossFunctional',
        '當學期學生名單查詢': 'currentStudent'
      }
      
      const mappedPermissions = {}
      // 處理嵌套的 permissions 結構
      const actualPermissions = result.permissions?.permissions || result.permissions || {}
      
      if (actualPermissions && typeof actualPermissions === 'object') {
        Object.keys(actualPermissions).forEach(chineseName => {
          const englishName = permissionMapping[chineseName]
          if (englishName) {
            mappedPermissions[englishName] = actualPermissions[chineseName]
          }
        })
      }
      
      tabPermissions.value = mappedPermissions
      userGroups.value = result.userGroups
      
      debugLog('重新驗證成功:', result.userEmail)
      ElMessage.success('驗證成功！')
      
      if (!isFirstLoad.value) {
        showWelcomeOverlay.value = false
      }
    } else {
      if (result.userEmail) {
        // 已登入但無權限 - 這是授權失敗，不是認證失敗
        authenticationFailed.value = false
        userEmail.value = result.userEmail
        attemptedEmail.value = result.userEmail // 記錄嘗試的 email
        userAuthorized.value = false
        ElMessage.error('權限不足')
      } else {
        // 完全未登入 - 這才是認證失敗
        authenticationFailed.value = true
        userEmail.value = ''
        attemptedEmail.value = ''
        userAuthorized.value = false
        ElMessage.error('登入失敗')
      }
    }
  } catch (error) {
    debugError('重新驗證失敗:', error)
    authenticationFailed.value = true
    userAuthorized.value = false
    ElMessage.error('登入失敗')
  } finally {
    authenticationLoading.value = false
  }
  */
}

const signOut = () => {
  userEmail.value = ''
  userAuthorized.value = false
  authenticationFailed.value = false
  attemptedEmail.value = ''
  tabPermissions.value = {}
  userGroups.value = []
  
  debugLog('用戶已登出')
  
  // 檢查是否在 iframe 中運行
  if (isInIframe()) {
    // 在 iframe 中，開新視窗進行 Google 登入
    window.open('https://accounts.google.com/signin', '_blank')
    ElMessage({
      message: '請在新開的視窗完成 Google 登入，然後重新整理此頁面',
      type: 'info',
      duration: 8000
    })
  } else {
    // 不在 iframe 中，正常重新導向
    window.location.href = 'https://accounts.google.com/signin'
  }
}



// 計算標題
const headerTitle = computed(() => {
  const functionNames = {
    'newbie': '歷年新生統計',
    'graduate': '畢業生流向統計',
    'examScore': '學測分數統計',
    'stScore': '分科成績統計',
    'crossFunctional': crossFunctionalTabLabel.value,
    'currentStudent': '當學期學生名單查詢'
  }
  
  if (selectedDashboard.value) {
    return `學生資訊統計表：${functionNames[selectedDashboard.value]}`
  }
  return '學生資訊統計表'
})

// Overlay 標題
const getOverlayTitle = computed(() => {
  if (!userEmail.value) {
    return '歡迎使用林口高中註冊組學生資訊統計系統'
  } else if (!userAuthorized.value) {
    return permissionsLoading.value ? '正在載入...' : '無權限存取'
  } else if (isFirstLoad.value) {
    return '歡迎使用林口高中註冊組學生資訊統計系統'
  } else {
    return '選擇查詢功能'
  }
})

// 載入系統配置
const loadSystemConfig = async () => {
  try {
    const configResult = await apiService.getSystemConfig()
    if (configResult.success && configResult.config) {
      manualDebug.value = configResult.config.manualDebug || false
      
      // 設定全域 console 控制（跟後端保持一致）
      // manualDebug = true → 關閉 console 輸出
      // manualDebug = false → 啟用 console 輸出
      if (manualDebug.value === true) {
        // 保存原始 console 方法（如果還沒保存過）
        if (!window._originalConsole) {
          window._originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
          }
        }
        
        // 禁用 console 輸出
        console.log = () => {}
        console.warn = () => {}
        console.info = () => {}
        // 保留 error 以便除錯關鍵錯誤
      } else {
        // manualDebug = false 或未設定時，恢復 console 輸出
        if (window._originalConsole) {
          console.log = window._originalConsole.log
          console.warn = window._originalConsole.warn
          console.info = window._originalConsole.info
        }
      }
      
      // 使用原始 console.log 因為這時候 debugLog 可能還沒有正確設置
      if (!manualDebug.value) {
        console.log('系統配置載入成功，manualDebug:', manualDebug.value)
      }
    }
  } catch (error) {
    // 使用原始 console.warn 因為這時候 debugWarn 可能還沒有正確設置
    if (!manualDebug.value) {
      console.warn('載入系統配置失敗，使用預設值:', error)
    }
    manualDebug.value = false
  }
}

// 儲存認證成功後的回調函數
let authSuccessCallback = null

// 設置全域認證事件監聽器
const setupGlobalAuthListeners = () => {
  // 監聽認證過期事件
  window.addEventListener('auth-required', (event) => {
    debugLog('收到認證要求事件')
    
    // 停止會話監控
    stopSessionMonitoring()
    
    // 顯示認證對話框
    showAuthDialog.value = true
    
    // 設置回調函數
    if (event.detail && event.detail.onAuthSuccess) {
      authSuccessCallback = event.detail.onAuthSuccess
    }
  })
}

const removeGlobalAuthListeners = () => {
  // 留空以便必要時清理監聽器
}

// 初始化設定 (已停用權限檢查)
onMounted(async () => {
  // 使用原始 console.log 因為這時候 manualDebug 還沒設定
  debugLog('應用啟動 - 初始化認證系統')
  
  // 設置全域事件監聽器
  setupGlobalAuthListeners()
  
  // 載入系統配置
  await loadSystemConfig()
  
  // 初始化認證系統
  initAuth()
  
  // 等待認證檢查完成
  while (!authChecked.value) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 只有在已認證的情況下才設定權限和載入功能選單
  if (isAuthenticated.value) {
    setupUserPermissions()
    // 已認證用戶首次載入時顯示功能選單
    showWelcomeOverlay.value = true
    // 這裡使用原始 console.log 因為 onMounted 中 manualDebug 可能還沒有正確設定
    console.log('認證完成，用戶可以使用系統功能')
  } else {
    console.log('等待用戶認證...')
    // 確保功能選單不會顯示
    showWelcomeOverlay.value = false
  }
  
  authenticationLoading.value = false
  
  /* 原始權限驗證代碼 - 已停用
  try {
    debugLog('開始 Session API 驗證...')
    
    // 直接向後端請求用戶權限，後端會使用 Session.getActiveUser() 驗證
    const result = await apiService.getUserTabPermissions()
    
    if (result.success) {
      // 成功取得權限
      userEmail.value = result.userEmail
      userAuthorized.value = true
      authenticationFailed.value = false
      
      // 將中文權限名稱轉換為英文屬性名稱
      const permissionMapping = {
        '歷年新生統計': 'newbie',
        '畢業生流向統計': 'graduate',
        '學測分數統計': 'examScore',
        '分科成績統計': 'stScore',
        '跨功能查詢名單': 'crossFunctional',
        '當學期學生名單查詢': 'currentStudent'
      }
      
      const mappedPermissions = {}
      // 處理嵌套的 permissions 結構
      const actualPermissions = result.permissions?.permissions || result.permissions || {}
      
      if (actualPermissions && typeof actualPermissions === 'object') {
        Object.keys(actualPermissions).forEach(chineseName => {
          const englishName = permissionMapping[chineseName]
          if (englishName) {
            mappedPermissions[englishName] = actualPermissions[chineseName]
          }
        })
      }
      
      tabPermissions.value = mappedPermissions
      userGroups.value = result.userGroups
      
      debugLog('Session API 驗證成功:', result)
      debugLog('實際權限物件:', actualPermissions)
      debugLog('映射後的權限:', mappedPermissions)
      debugLog('tabPermissions 更新為:', tabPermissions.value)
      debugLog('用戶 Email:', result.userEmail)
      debugLog('用戶群組:', result.userGroups)
      
      ElMessage.success('驗證成功！')
      
      // 如果這不是第一次載入，關閉 overlay
      if (!isFirstLoad.value) {
        showWelcomeOverlay.value = false
      }
    } else {
      // 檢查是否有用戶 email（已登入但無權限）
      if (result.userEmail) {
        // 已登入但無權限 - 這是授權失敗，不是認證失敗
        authenticationFailed.value = false
        userEmail.value = result.userEmail
        attemptedEmail.value = result.userEmail // 記錄嘗試的 email
        userAuthorized.value = false
        debugWarn('用戶已登入但無權限:', result.userEmail)
        ElMessage.error('權限不足')
      } else {
        // 完全未登入 - 這才是認證失敗
        authenticationFailed.value = true
        debugWarn('用戶未登入 Google 帳號')
        userEmail.value = ''
        attemptedEmail.value = ''
        userAuthorized.value = false
        // 保持 overlay 開啟讓用戶知道需要登入
      }
    }
    
  } catch (error) {
    debugError('Session API 驗證錯誤:', error)
    authenticationFailed.value = true
    userAuthorized.value = false
    ElMessage.error('登入失敗')
  } finally {
    authenticationLoading.value = false
    permissionsLoading.value = false
  }
  */
  
  // 如果跨功能查詢已鎖定，設定年份為 'all'
  if (crossFunctionalLocked.value) {
    selectedYear.value = 'all'
  }
})

// 清理認證監聽器
onUnmounted(() => {
  destroyAuth()
  // 清理會話監控
  stopSessionMonitoring()
  // 清理事件監聽器
  removeGlobalAuthListeners()
})
</script>

<style>
/* 引入拖拽樣式 */
@import './styles/draggable.css';
</style>

<style scoped>
.el-header {
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header-content {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-wrap: nowrap; /* 防止換行 */
  min-height: 60px;
}

.el-header h1 {
  margin: 0;
  font-size: 24px;
  flex: 1;
  min-width: 0; /* 允許標題縮減 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-shrink: 0; /* 防止按鈕區域被壓縮 */
}


/* 登入提示樣式 */
.login-prompt {
  text-align: center;
  padding: 40px 20px;
}

.login-prompt h3 {
  color: #333;
  margin-bottom: 20px;
}

.login-prompt p {
  color: #666;
  margin-bottom: 30px;
  line-height: 1.6;
}

.session-login-section {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

/* 無權限樣式 */
.no-permission {
  text-align: center;
  padding: 40px 20px;
}

.no-permission h3 {
  color: #f56c6c;
  margin-bottom: 20px;
}

.no-permission p {
  color: #666;
  margin-bottom: 15px;
  line-height: 1.6;
}

.blink-button {
  animation: neon-glow 1.8s infinite;
  position: relative;
}

@keyframes neon-glow {
  0% {
    border: 2px solid #409eff;
    box-shadow: 
      0 0 5px #409eff,
      0 0 10px #409eff,
      0 0 15px #409eff,
      inset 0 0 5px rgba(64, 158, 255, 0.1);
    transform: scale(1);
  }
  50% {
    border: 2px solid #00bfff;
    box-shadow: 
      0 0 10px #00bfff,
      0 0 20px #00bfff,
      0 0 30px #00bfff,
      0 0 40px #00bfff,
      inset 0 0 10px rgba(0, 191, 255, 0.2);
    transform: scale(1.08);
  }
  100% {
    border: 2px solid #409eff;
    box-shadow: 
      0 0 5px #409eff,
      0 0 10px #409eff,
      0 0 15px #409eff,
      inset 0 0 5px rgba(64, 158, 255, 0.1);
    transform: scale(1);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-main {
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.year-selector-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 0;
  border-top: 1px solid #ebeef5;
}

.year-selector-label {
  font-weight: 500;
  color: #606266;
}

.year-lock-notice {
  font-size: 12px;
  color: #e6a23c;
  margin-left: 10px;
  font-weight: 500;
}

.dashboard-loading-container {
  min-height: 600px;
  position: relative;
}

/* 自定義 loading 樣式 */
:deep(.el-loading-mask) {
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.8) !important;
}

:deep(.el-loading-spinner) {
  top: 50px !important;
  margin-top: 0 !important;
  position: absolute !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
}

:deep(.el-loading-text) {
  position: absolute !important;
  top: 100px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  margin-top: 0 !important;
  color: #333 !important;
  font-size: 16px;
  font-weight: 500;
}

/* 跨功能查詢相關樣式 */
.cross-functional-controls {
  padding: 15px 0;
  border-top: 1px solid #ebeef5;
  margin-top: 10px;
}

.selection-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selection-count {
  font-weight: 600;
  color: #409eff;
  background: #ecf5ff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 歡迎overlay樣式 */
.welcome-content {
  text-align: center;
  padding: 20px;
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.welcome-content h3 {
  color: #333;
  margin-bottom: 30px;
  font-size: 18px;
}

.permissions-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 40px 20px;
  color: #666;
}

.loading-icon {
  animation: spin 1s linear infinite;
  color: #409eff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.permissions-loading p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.function-grid {
  display: grid;
  width: 100%;
  gap: 20px;
  margin-bottom: 20px;
  padding: 10px;
  
  /* 橫屏模式（寬屏）：一行顯示所有按鈕 */
  grid-template-columns: repeat(5, 1fr);
}

/* 直屏模式或較窄螢幕：兩個兩個排列 */
@media (max-width: 1024px) {
  .function-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 非常小的螢幕：單列排列 */
@media (max-width: 600px) {
  .function-grid {
    grid-template-columns: 1fr;
  }
}

.function-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid #e4e7ed;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.function-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.function-card:hover {
  border-color: #409eff;
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(64, 158, 255, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
}

.function-card:hover::before {
  opacity: 1;
}

.function-card:active {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.4);
}

.function-header {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  position: relative;
  margin-bottom: 12px;
}

.function-icon {
  font-size: 36px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.data-status {
  position: absolute;
  top: -10px;
  right: -10px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 4px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.status-text {
  font-size: 10px;
  color: #67c23a;
  font-weight: 600;
  white-space: nowrap;
}

.function-card:hover .function-icon {
  transform: scale(1.1);
  filter: brightness(1.2);
}

.function-card h4 {
  margin: 10px 0 8px 0;
  color: #333;
  font-size: 17px;
  font-weight: 600;
  transition: color 0.3s ease;
  position: relative;
  z-index: 1;
}

.function-card:hover h4 {
  color: #409eff;
}

.function-card p {
  margin: 0;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
  transition: color 0.3s ease;
  position: relative;
  z-index: 1;
  padding: 0 15px;
}

.function-card:hover p {
  color: #5a5e66;
}

/* 載入中的功能卡片樣式 */
.loading-card {
  pointer-events: none;
  opacity: 0.8;
}

.loading-card:hover {
  transform: none !important;
  box-shadow: none !important;
  border-color: #e4e7ed !important;
}

/* 登入區域樣式修正 */
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.session-login-section {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px;
  width: 100%;
}

.session-login-section > * {
  text-align: center;
}

.initial-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
}

.initial-loading p {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.no-permission {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}


.debug-info {
  font-size: 12px;
  color: #999;
  text-align: center;
  display: flex !important;
  flex-direction: column !important;
  align-items: center;
  gap: 2px;
}

.debug-info p {
  margin: 0;
  width: 100%;
}

/* 底部連結樣式 */
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #f8f9fa;
  border-top: 1px solid #e9ecef;
  padding: 10px 0;
  z-index: 999;
}

.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.footer-separator {
  color: #909399;
}

.el-main {
  padding-bottom: 50px; /* 為底部footer留出空間 */
}

/* 歡迎畫面樣式 */
.welcome-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.welcome-header {
  margin-bottom: 40px;
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: 20px;
  line-height: 1;
}

.welcome-content h1 {
  font-size: 2rem;
  color: #303133;
  margin: 0 0 15px 0;
  font-weight: 600;
}

.welcome-subtitle {
  font-size: 1.1rem;
  color: #606266;
  margin: 0;
  line-height: 1.5;
}

.loading-section, .auth-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.loading-section p, .auth-prompt p {
  color: #909399;
  margin: 0;
}

.auth-prompt .el-button {
  padding: 12px 30px;
  font-size: 16px;
}

/* 跨功能查詢對話框樣式 */
:deep(.cross-functional-dialog) {
  animation: slideUpFromBottom 0.3s ease-out;
}

@keyframes slideUpFromBottom {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.cross-functional-content {
  max-height: 70vh;
}

.cross-functional-content .el-table {
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.cross-functional-content .el-pagination {
  justify-content: center;
}
</style>