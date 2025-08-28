// API 服務層 - Firestore 優化版本
// 簡化 API 調用，支援前端直接生成 CSV

const isDevelopment = import.meta.env.DEV

// GAS API Execute Mode 配置
const GAS_SCRIPT_ID = window.APP_CONFIG?.GAS_SCRIPT_ID || import.meta.env.VITE_GAS_SCRIPT_ID || ''
const GAS_API_BASE_URL = GAS_SCRIPT_ID ? `https://script.googleapis.com/v1/scripts/${GAS_SCRIPT_ID}:run` : ''

// CSV 生成工具函數
function generateCSV(data, columns) {
  if (!data || data.length === 0) return ''
  
  // BOM for UTF-8
  const BOM = '\uFEFF'
  
  // 標題行
  const headers = columns.map(col => col.label).join(',')
  
  // 數據行
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.prop] ?? ''
      // 如果值包含逗號或換行符，需要用引號包裹
      if (String(value).includes(',') || String(value).includes('\n') || String(value).includes('"')) {
        return `"${String(value).replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  })
  
  return BOM + headers + '\n' + rows.join('\n')
}

// 下載 CSV 檔案
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

class ApiService {
  constructor() {
    this.isDevelopment = isDevelopment
    this.accessToken = null
    this.mode = window.APP_CONFIG?.MODE || 'API_EXECUTE'
    this.sessionId = this.generateSessionId()
    // 開發模式下的認證狀態
    this.mockAuthStatus = false
    // API 請求佇列
    this.requestQueue = []
    this.isReauthenticating = false
    // 時間管理
    this.lastApiAccessTime = null
    this.activeTime = null // 以秒為單位
    this.sessionStartTime = null // 會話開始時間（用於前端倒數顯示）
  }
  
  // 生成唯一的 sessionId
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // 設定 OAuth Access Token
  setAccessToken(token) {
    this.accessToken = token
  }
  
  // 處理需要認證的情況
  handleAuthRequired() {
    if (this.isReauthenticating) {
      return // 已經在重新認證中
    }
    
    this.isReauthenticating = true
    
    // 觸發全域認證事件
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth-required', {
        detail: {
          onAuthSuccess: async () => {
            // 認證成功後重新執行佇列中的請求
            await this.executeQueuedRequests()
            this.isReauthenticating = false
          },
          onAuthCancel: () => {
            // 認證被取消時清空佇列
            this.clearQueue()
            this.isReauthenticating = false
          }
        }
      }))
    }
  }
  
  // ========== 認證相關 API ==========
  
  async verifyPassKey(passKey) {
    return await this.executeGASFunction('verifyPassKey', { passKey, sessionId: this.sessionId })
  }
  
  async getAuthStatus() {
    return await this.executeGASFunction('getAuthStatus', { sessionId: this.sessionId })
  }
  
  async logout() {
    const result = await this.executeGASFunction('logout', { sessionId: this.sessionId })
    // 清除本地時間資訊
    this.lastApiAccessTime = null
    this.activeTime = null
    this.sessionStartTime = null
    this.requestQueue = []
    return result
  }
  
  async renewSession() {
    const result = await this.executeGASFunction('renewSession', { sessionId: this.sessionId })
    if (result.success && result.accessTime && result.activeTime) {
      // 刷新會話時重置倒數計時器
      this.resetSessionTimer(result.accessTime, result.activeTime)
    }
    return result
  }
  
  // 重置會話計時器（用於 renewSession 或重新認證）
  resetSessionTimer(accessTime, activeTime) {
    this.lastApiAccessTime = accessTime
    this.sessionStartTime = accessTime // 重置倒數起點
    this.activeTime = activeTime
    console.log('會話計時器已重置:', {
      accessTime: accessTime,
      activeTime: activeTime
    })
  }
  
  // 取得剩餘時間（以秒為單位）——用於前端顯示倒數
  getRemainingTime() {
    if (!this.sessionStartTime || !this.activeTime) {
      return 0
    }
    const currentTime = Math.floor(Date.now() / 1000)
    const elapsed = currentTime - this.sessionStartTime
    return Math.max(0, this.activeTime - elapsed)
  }
  
  // 取得從上次 API 調用以來的剩餘時間——用於後端驗證
  getRemainingTimeFromLastAPI() {
    if (!this.lastApiAccessTime || !this.activeTime) {
      return 0
    }
    const currentTime = Math.floor(Date.now() / 1000)
    const elapsed = currentTime - this.lastApiAccessTime
    return Math.max(0, this.activeTime - elapsed)
  }
  
  // 更新 API 存取時間
  updateApiAccessTime() {
    this.lastApiAccessTime = Math.floor(Date.now() / 1000)
    // 但不更新 sessionStartTime，保持前端倒數的連續性
  }
  
  // 設定會話資訊
  setSessionInfo(accessTime, activeTime) {
    this.lastApiAccessTime = accessTime
    this.activeTime = activeTime
    // 只有當 sessionStartTime 未設定或重新認證時才更新
    if (!this.sessionStartTime) {
      this.sessionStartTime = accessTime
    }
  }
  
  // 加入請求佇列
  addToQueue(action, params, resolve, reject) {
    this.requestQueue.push({ action, params, resolve, reject })
  }
  
  // 清空請求佇列
  clearQueue() {
    this.requestQueue.forEach(item => {
      item.reject(new Error('請求已被取消'))
    })
    this.requestQueue = []
  }
  
  // 重新執行佇列中的請求
  async executeQueuedRequests() {
    const queue = [...this.requestQueue]
    this.requestQueue = []
    
    for (const item of queue) {
      try {
        const result = await this.executeGASFunction(item.action, item.params)
        item.resolve(result)
      } catch (error) {
        item.reject(error)
      }
    }
  }

  // 呼叫 GAS API (支援兩種模式)
  async executeGASFunction(action, params = {}) {
    // 認證相關的 API 不需要檢查時間
    const authExemptActions = ['verifyPassKey', 'getAuthStatus', 'logout', 'renewSession']
    
    // 在開發模式下，對於權限相關的 API，仍然調用真實的 GAS API 但使用固定 email
    if (this.isDevelopment && action === 'getUserTabPermissions') {
      console.log('Development mode: Testing real getUserTabPermissions with fixed email')
      // 強制使用固定的 email 進行測試
      params = { ...params, userEmail: 'lksh202@app.lksh.ntpc.edu.tw' }
      // 繼續執行真實的 API 調用，不返回 mock 資料
    } else if (this.isDevelopment) {
      console.warn('Development mode: Using mock data for', action)
      return this.getMockData(action, params)
    }
    
    // 如果正在重新認證且不是認證相關 API，加入佇列
    if (this.isReauthenticating && !authExemptActions.includes(action)) {
      return new Promise((resolve, reject) => {
        this.addToQueue(action, params, resolve, reject)
      })
    }

    // GAS Webapp 模式 - 使用內嵌腳本
    if (this.mode === 'GAS_WEBAPP') {
      return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.script && google.script.run) {
          google.script.run
            .withSuccessHandler((result) => {
              // 處理認證相關的回應
              if (result.needAuth) {
                this.handleAuthRequired()
              }
              resolve(result)
            })
            .withFailureHandler((error) => {
              console.error('GAS Webapp error:', error)
              resolve({ success: false, error: error.toString() })
            })
            .handleAPIRequest(action, { ...params, sessionId: this.sessionId })
        } else {
          console.error('Google Script API 不可用')
          resolve({ success: false, error: 'Google Script API 不可用' })
        }
      })
    }

    // API Execute 模式 - 使用 OAuth
    if (!this.accessToken) {
      return { success: false, error: '缺少 OAuth access token' }
    }

    if (!GAS_SCRIPT_ID) {
      return { success: false, error: '缺少 GAS Script ID' }
    }

    try {
      const response = await fetch(GAS_API_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: 'executeAPI',
          parameters: [{ action, params: { ...params, sessionId: this.sessionId } }]
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error.message || 'GAS execution error')
      }

      const apiResult = result.response.result || { success: false, error: 'No result returned' }
      
      // 處理認證相關的回應
      if (apiResult.needAuth) {
        // 如果是認證相關 API，直接返回
        if (authExemptActions.includes(action)) {
          return apiResult
        }
        
        // 非認證 API 遇到認證失敗，加入佇列並試圖重新認證
        return new Promise((resolve, reject) => {
          this.addToQueue(action, params, resolve, reject)
          this.handleAuthRequired()
        })
      }
      
      // 成功的 API 呼叫更新時間
      if (apiResult.success && !authExemptActions.includes(action)) {
        this.updateApiAccessTime()
      }
      
      // 更新會話資訊
      if (action === 'getAuthStatus' && apiResult.success && apiResult.authenticated) {
        this.setSessionInfo(apiResult.apiAccessTime, apiResult.activeTime)
      } else if ((action === 'verifyPassKey' || action === 'renewSession') && apiResult.success) {
        if (apiResult.accessTime && apiResult.activeTime) {
          this.setSessionInfo(apiResult.accessTime, apiResult.activeTime)
        }
      }
      
      return apiResult
    } catch (error) {
      console.error('GAS API Execute error:', error)
      return { success: false, error: error.message }
    }
  }

  // 系統設定
  async getSystemConfig() {
    return await this.executeGASFunction('getSystemConfig')
  }

  // ========== 學生資料相關 ==========
  
  async getAvailableYears() {
    return await this.executeGASFunction('getStudentListYears')
  }

  async getStudentList(year = 'all') {
    return await this.executeGASFunction('getStudentList', { year })
  }

  async getCrossFunctionalStudentList(selectedStudentData) {
    return await this.executeGASFunction('getCrossFunctionalStudentList', { selectedStudentData })
  }

  async getJuniorHighSchoolGeoInfo() {
    return await this.executeGASFunction('getJuniorHighSchoolGeoInfo')
  }

  async getAllStudentData() {
    return await this.executeGASFunction('getAllStudentData')
  }

  async getAllStudentCoordinates() {
    return await this.executeGASFunction('getAllStudentCoordinates')
  }

  async getAllExamScores() {
    return await this.executeGASFunction('getAllExamScores')
  }

  async getAllSTScores() {
    return await this.executeGASFunction('getAllSTScores')
  }

  async getAllCurrentStudentData() {
    return await this.executeGASFunction('getAllCurrentStudentData')
  }

  async getUniversityRankings() {
    return await this.executeGASFunction('getUniversityRankings')
  }

  async getUniversityCoordinates() {
    return await this.executeGASFunction('getUniversityCoordinates')
  }

  async getUniversityList() {
    return await this.executeGASFunction('getUniversityList')
  }

  async getIdNumberMapping() {
    return await this.executeGASFunction('getIdNumberMapping')
  }

  // 生成學生報表 - 前端直接生成 CSV
  async generateFilteredReport(filters, columns) {
    const result = await this.getStudentList(filters.year || 'all')
    
    if (!result.success) {
      return result
    }
    
    // 應用過濾條件
    let filteredData = result.data
    
    if (filters.channel) {
      filteredData = filteredData.filter(s => s['admissionChannel'] === filters.channel)
    }
    if (filters.studentType) {
      filteredData = filteredData.filter(s => s['studentType'] === filters.studentType)
    }
    if (filters.admissionType) {
      filteredData = filteredData.filter(s => s['admissionType'] === filters.admissionType)
    }
    if (filters.class) {
      filteredData = filteredData.filter(s => s['class'] === parseInt(filters.class))
    }
    
    // 生成 CSV
    const csvContent = generateCSV(filteredData, columns)
    const filename = `學生名單_${new Date().toISOString().slice(0, 10)}.csv`
    
    downloadCSV(csvContent, filename)
    
    return {
      success: true,
      recordCount: filteredData.length,
      fileName: filename
    }
  }

  // ========== 畢業生資料相關 ==========
  
  async getGraduateYears() {
    return await this.executeGASFunction('getGraduateListYears')
  }
  
  async getGraduateList(year = 'all') {
    return await this.executeGASFunction('getGraduateList', { year })
  }
  
  async getAllGraduateData() {
    return await this.executeGASFunction('getAllGraduateData')
  }
  
  async getCrossFunctionalGraduateList(selectedStudentData) {
    return await this.executeGASFunction('getCrossFunctionalGraduateList', { selectedStudentData })
  }
  
  // 生成畢業生報表 - 前端直接生成 CSV
  async generateGraduateReport(filters, columns) {
    const result = await this.getGraduateList(filters.year || 'all')
    
    if (!result.success) {
      return result
    }
    
    // 應用過濾條件
    let filteredData = result.data
    
    if (filters.class) {
      filteredData = filteredData.filter(g => g['class'] === parseInt(filters.class))
    }
    if (filters.school) {
      filteredData = filteredData.filter(g => g['admissionSchool'] === filters.school)
    }
    if (filters.pathway) {
      filteredData = filteredData.filter(g => g['admissionChannel'] === filters.pathway)
    }
    
    // 按權值排序（如果有）
    if (filters.sortByRanking) {
      filteredData.sort((a, b) => {
        if (!a.ranking && !b.ranking) return 0
        if (!a.ranking) return 1
        if (!b.ranking) return -1
        return b.ranking['fullWeight'] - a.ranking['fullWeight']
      })
    }
    
    // 生成 CSV
    const csvContent = generateCSV(filteredData, columns)
    const filename = `畢業生流向_${new Date().toISOString().slice(0, 10)}.csv`
    
    downloadCSV(csvContent, filename)
    
    return {
      success: true,
      recordCount: filteredData.length,
      fileName: filename
    }
  }

  // ========== 學測成績相關 ==========
  
  async getExamScoreYears() {
    return await this.executeGASFunction('getExamScoreYears')
  }
  
  async getExamScores(year = 'all') {
    return await this.executeGASFunction('getExamScores', { year })
  }

  async getCrossFunctionalExamScores(selectedStudentData) {
    return await this.executeGASFunction('getCrossFunctionalExamScores', { selectedStudentData })
  }

  // 生成學測成績報表 - 前端直接生成 CSV
  async generateExamScoreReport(filters, columns) {
    const result = await this.getExamScores(filters.year || 'all')
    
    if (!result.success) {
      return result
    }
    
    // 生成 CSV
    const csvContent = generateCSV(result.students, columns)
    const filename = `學測成績_${new Date().toISOString().slice(0, 10)}.csv`
    
    downloadCSV(csvContent, filename)
    
    return {
      success: true,
      recordCount: result.students.length,
      fileName: filename
    }
  }

  // ========== 分科成績相關 ==========
  
  async getSTScoreYears() {
    return await this.executeGASFunction('getSTScoreYears')
  }
  
  // ========== 當前學生資料相關 ==========
  
  async getCurrentStudentList(yearSemester) {
    return await this.executeGASFunction('getCurrentStudentList', { yearSemester })
  }
  
  async getSTScores(year = 'all') {
    return await this.executeGASFunction('getSTScores', { year })
  }

  async getCrossFunctionalSTScores(selectedStudentData) {
    return await this.executeGASFunction('getCrossFunctionalSTScores', { selectedStudentData })
  }

  // 生成分科成績報表 - 前端直接生成 CSV
  async generateSTScoreReport(filters, columns) {
    const result = await this.getSTScores(filters.year || 'all')
    
    if (!result.success) {
      return result
    }
    
    // 生成 CSV
    const csvContent = generateCSV(result.students, columns)
    const filename = `分科成績_${new Date().toISOString().slice(0, 10)}.csv`
    
    downloadCSV(csvContent, filename)
    
    return {
      success: true,
      recordCount: result.students.length,
      fileName: filename
    }
  }

  // ========== 跨功能查詢 ==========
  
  async getCrossFunctionalData(selectedStudentData) {
    return await this.executeGASFunction('getCrossFunctionalData', { selectedStudentData })
  }

  async searchIdMapping(query) {
    return await this.executeGASFunction('searchIdMapping', { query })
  }

  // 搜尋跨年份當學期名單資料
  async searchCrossYearCurrentStudents({ uids, currentYearSemester }) {
    return await this.executeGASFunction('searchCrossYearCurrentStudents', {
      uids,
      currentYearSemester
    })
  }

  // 搜尋跨年份學測成績資料
  async searchCrossYearExamScores({ uids, currentYear }) {
    return await this.executeGASFunction('searchCrossYearExamScores', {
      uids,
      currentYear
    })
  }

  // 搜尋跨年份分科成績資料
  async searchCrossYearSTScores({ uids, currentYear }) {
    return await this.executeGASFunction('searchCrossYearSTScores', {
      uids,
      currentYear
    })
  }

  // 搜尋跨年份畢業生資料
  async searchCrossYearGraduates({ uids, currentYear }) {
    return await this.executeGASFunction('searchCrossYearGraduates', {
      uids,
      currentYear
    })
  }

  // 搜尋跨年份新生資料
  async searchCrossYearNewbies({ uids, currentYear }) {
    return await this.executeGASFunction('searchCrossYearNewbies', {
      uids,
      currentYear
    })
  }

  // ========== 資料表元資訊 ==========
  
  async getSheetLastModified(functionName) {
    return await this.executeGASFunction('getSheetLastModified', { functionName })
  }

  // ========== 使用者權限 ==========
  
  async getUserTabPermissions(userEmail = null) {
    return await this.executeGASFunction('getUserTabPermissions', { userEmail })
  }

  // ========== 開發模式 Mock 資料 ==========
  
  getMockData(action, params) {
    switch (action) {
      case 'getSystemConfig':
        return {
          success: true,
          config: {
            manualDebug: false  // 開發模式預設為 false，顯示 console 輸出
          }
        }
      
      case 'getStudentListYears':
        return {
          success: true,
          years: [2025, 2024, 2023, 2022, 2021]
        }
      
      case 'getCrossFunctionalStudentList':
        return {
          success: true,
          data: [
            {
              'nationalId': 'A123456789',
              'satRegistrationNumber': 26831216,
              'admissionYear': 2024,
              'class': 301,
              'seatNumber': 15,
              'admissionChannel': '繁星推薦'
            }
          ]
        }

      case 'getStudentList':
        return {
          success: true,
          data: [
            {
              'nationalId': 'A123456789',
              'name': '王小明',
              'gender': '男',
              'admissionYear': 2025,
              'admissionChannel': '優先免試',
              'studentType': '一般生',
              'admissionType': '一般生',
              'capTotalScore': 25,
              'graduateSchoolName': '新北市立板橋國民中學',
              'class': 301,
              'seatNumber': 1,
              idNumber: 'A123456789'
            },
            {
              'nationalId': 'B234567890',
              'name': '李小華',
              'gender': '女',
              'admissionYear': 2025,
              'admissionChannel': '直升',
              'studentType': '低收入戶',
              'admissionType': '低收入戶',
              'capTotalScore': 28,
              'graduateSchoolName': '新北市立林口國民中學',
              'class': 301,
              'seatNumber': 2,
              idNumber: 'B234567890'
            }
          ],
          filters: {
            channels: ['優先免試', '直升', '會考分發', '特色招生'],
            studentTypes: ['一般生', '低收入戶', '原住民'],
            admissionTypes: ['一般生', '低收入戶', '原住民'],
            classes: [301, 302, 303, 304, 305]
          }
        }
      
      case 'getGraduateListYears':
        return {
          success: true,
          years: [2025, 2024, 2023, 2022, 2021]
        }
      
      case 'getAllGraduateData':
        return {
          success: true,
          data: [
            {
              '學測報名序號': 26831216,
              '榜單年分': 2024,
              '班級': 301,
              '錄取學校': '臺灣大學',
              '入學管道': '個人申請',
              '公私立': '公立',
              '經度': 121.5354,
              '緯度': 25.0175
            },
            {
              '學測報名序號': 26831217,
              '榜單年分': 2024,
              '班級': 302,
              '錄取學校': '成功大學',
              '入學管道': '繁星推薦',
              '公私立': '公立',
              '經度': 120.2094,
              '緯度': 22.9998
            }
          ]
        }
      
      case 'getCrossFunctionalGraduateList':
        return {
          success: true,
          data: [
            {
              '學測報名序號': 26831216,
              '榜單年分': 2024,
              '班級': 301,
              '錄取學校': '臺灣大學',
              '入學管道': '個人申請',
              '公私立': '公立',
              '經度': 121.5354,
              '緯度': 25.0175
            }
          ]
        }
      
      case 'getGraduateList':
        return {
          success: true,
          data: [
            {
              '學測報名序號': 26831216,
              '姓名': '沈育宏',
              '班級': 312,
              '座號': 16,
              '入學管道': '繁星推薦',
              '錄取學校': '國立臺灣大學',
              '公私立': '公立',
              '錄取系所': '資訊工程學系',
              '榜單年分': 2025,
              idNumber: 'A123456789',
              fullName: '國立臺灣大學資訊工程學系',
              ranking: {
                '名稱': '國立臺灣大學',
                '完整權值': 100,
                '整數權值': 100,
                '小數權值': 0
              }
            },
            {
              '學測報名序號': 26831217,
              '姓名': '徐梓翔',
              '班級': 312,
              '座號': 17,
              '入學管道': '繁星推薦',
              '錄取學校': '國立臺灣師範大學',
              '公私立': '公立',
              '錄取系所': '機電工程學系',
              '榜單年分': 2025,
              idNumber: 'B234567890',
              fullName: '國立臺灣師範大學機電工程學系',
              ranking: {
                '名稱': '國立臺灣師範大學',
                '完整權值': 95,
                '整數權值': 95,
                '小數權值': 0
              }
            }
          ],
          filters: {
            classes: [309, 312],
            schools: ['國立臺灣大學', '國立臺灣師範大學', '國立中興大學'],
            pathways: ['繁星推薦', '個人申請']
          }
        }
      
      case 'getExamScoreYears':
        return {
          success: true,
          years: [2025, 2024, 2023, 2022, 2021]
        }
      
      case 'getCrossFunctionalExamScores':
        return {
          success: true,
          students: [
            {
              registrationNumber: 26831216,
              name: '王小明',
              examNumber: 10076336,
              chinese: 12,
              english: 10,
              mathA: 8,
              mathB: null,
              social: 11,
              science: 9,
              examYear: 2024,
              idNumber: 'A123456789'
            }
          ]
        }

      case 'getExamScores':
        return {
          success: true,
          students: [
            {
              registrationNumber: 26830101,
              name: '郭芷綺',
              examNumber: 10076335,
              chinese: 9,
              english: 6,
              mathA: null,
              mathB: 4,
              social: 11,
              science: null,
              examYear: 2022,
              idNumber: 'A123456789'
            }
          ],
          benchmarks: {
            2022: {
              '國文': { top: 13, front: 12, average: 10, back: 8, bottom: 6 },
              '英文': { top: 13, front: 11, average: 8, back: 5, bottom: 3 },
              '數學A': { top: 12, front: 10, average: 7, back: 4, bottom: 2 },
              '數學B': { top: 13, front: 11, average: 8, back: 5, bottom: 3 },
              '社會': { top: 14, front: 13, average: 11, back: 8, bottom: 6 },
              '自然': { top: 13, front: 11, average: 8, back: 5, bottom: 3 }
            }
          }
        }
      
      case 'getUserTabPermissions':
        return {
          success: true,
          userEmail: 'lksh202@app.lksh.ntpc.edu.tw',
          permissions: {
            '歷年新生統計': true,
            '畢業生流向統計': true,
            '學測分數統計': true,
            '分科成績統計': true,
            '跨功能查詢名單': true
          },
          groups: ['行政人員']
        }
      
      case 'getSTScoreYears':
        return {
          success: true,
          years: [2025, 2024, 2023, 2022, 2021]
        }

      case 'getCrossFunctionalSTScores':
        return {
          success: true,
          students: [
            {
              registrationNumber: 26831216,
              name: '王小明',
              physics: 85,
              chemistry: 90,
              biology: 78,
              earth: null,
              history: null,
              geography: null,
              civics: null,
              examYear: 2024,
              idNumber: 'A123456789'
            }
          ]
        }

      case 'getSTScores':
        return {
          success: true,
          students: [
            {
              registrationNumber: 26830101,
              name: '郭芷綺',
              physics: 75,
              chemistry: 82,
              biology: 68,
              earth: null,
              history: 88,
              geography: 79,
              civics: 85,
              examYear: 2022,
              idNumber: 'B123456789'
            }
          ]
        }

      case 'getIdNumberMapping':
        return {
          success: true,
          data: [
            {
              '報名序號': 26831216,
              '考試年份': 2024,
              '身分證字號': 'A123456789'
            },
            {
              '報名序號': 26831217,
              '考試年份': 2024,
              '身分證字號': 'B234567890'
            },
            {
              '報名序號': 26830101,
              '考試年份': 2022,
              '身分證字號': 'C345678901'
            }
          ]
        }

      case 'getSheetLastModified':
        return {
          success: true,
          functionName: params.functionName,
          sheetName: '測試工作表',
          lastModified: new Date().toISOString(),
          modifiedBy: 'mock.user@test.com'
        }

      // 認證相關 API
      case 'verifyPassKey':
        // 在開發模式下，模擬 passKey 驗證
        // 簡單的驗證邏輯：passKey 需要是 "dev" 或長度大於 3
        if (params.passKey === 'dev' || (params.passKey && params.passKey.length > 3)) {
          this.mockAuthStatus = true
          return {
            success: true,
            message: '驗證成功'
          }
        } else {
          return {
            success: false,
            error: '開發模式：請輸入 "dev" 或任何長度大於3的字串'
          }
        }
      
      case 'getAuthStatus':
        // 在開發模式下，返回當前的認證狀態
        return {
          success: true,
          authenticated: this.mockAuthStatus,
          sessionId: params.sessionId
        }
      
      case 'logout':
        this.mockAuthStatus = false
        return {
          success: true,
          message: '已登出'
        }

      default:
        return {
          success: false,
          error: `Mock data not available for action: ${action}`
        }
    }
  }
}

export const apiService = new ApiService()