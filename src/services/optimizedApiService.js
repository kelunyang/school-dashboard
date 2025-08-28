// 優化版 API 服務 - 最少化 Firestore 查詢
// 目標：從每日 1000+ 次查詢降低到 < 50 次查詢

import { apiService } from './apiService.js'

class OptimizedApiService {
  constructor() {
    // 數據快取
    this.dataCache = {
      availableYears: null,
      currentDataPackage: null,
      currentYear: null,
      loadTime: null
    }
    
    // 快取持續時間（30分鐘）
    this.CACHE_DURATION = 30 * 60 * 1000
    
    console.log('🚀 OptimizedApiService 初始化完成')
  }

  /**
   * 步驟 1: 獲取所有可用年份
   * 只查詢一次，快取很久（年份很少變動）
   */
  async getAvailableYears() {
    if (this.dataCache.availableYears) {
      console.log('📋 使用快取的年份資料')
      return this.dataCache.availableYears
    }

    try {
      console.log('🔍 載入所有可用年份...')
      const result = await apiService.executeGASFunction('getAvailableYearsOptimized')
      
      if (result.success) {
        this.dataCache.availableYears = result.years
        console.log('✅ 年份資料載入完成:', result.years)
        return result.years
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('❌ 載入年份失敗:', error)
      throw error
    }
  }

  /**
   * 步驟 2: 載入完整數據包
   * 根據年份和功能類型，按需載入數據
   */
  async getCompleteDataPackage(year = 'latest', dashboardType = null) {
    // 檢查快取是否仍然有效
    if (this.isCacheValid(year, dashboardType)) {
      // 檢查是否已有對應功能的數據
      const hasRequiredData = dashboardType ? 
        this.dataCache.currentDataPackage?.[this.getDashboardDataKey(dashboardType)] : 
        true
      
      if (hasRequiredData) {
        console.log(`📦 使用快取的 ${year} 年度數據包（包含 ${dashboardType} 數據）`)
        return this.dataCache.currentDataPackage
      }
    }

    try {
      console.log(`🔄 載入數據包，功能類型: ${dashboardType}${dashboardType === 'examScore' || dashboardType === 'stScore' ? ' (所有年份)' : ` (${year} 年度)`}`)
      const startTime = Date.now()
      
      const result = await apiService.executeGASFunction('getCompleteDataPackage', { 
        dashboardType 
        // 對於 examScore 和 stScore 不再傳送 year 參數，讓後端一次載入所有年份
      })
      
      if (result.success) {
        // 更新快取
        this.dataCache.currentDataPackage = result.dataPackage
        this.dataCache.currentYear = (dashboardType === 'examScore' || dashboardType === 'stScore') ? 'all' : year
        this.dataCache.loadTime = Date.now()
        
        const loadTime = Date.now() - startTime
        console.log(`✅ 數據包載入完成！`)
        console.log(`📊 總記錄數: ${result.dataPackage.metadata.totalRecords}`)
        console.log(`⏱️  前端載入時間: ${loadTime}ms`)
        console.log(`🔍 後端查詢次數: ${result.dataPackage.metadata.queries}`)
        
        // === 新增：詳細檢查數據包結構 ===
        console.log('=== 數據包結構詳細檢查 ===')
        console.log('數據包包含的數據類型:', Object.keys(result.dataPackage))
        
        // 只在 currentStudent 相關的 dashboard 時檢查 currentStudents
        if (dashboardType === 'currentStudent') {
          console.log('currentStudents 存在:', !!result.dataPackage.currentStudents)
          
          if (result.dataPackage.currentStudents) {
            console.log('currentStudents 詳細結構:', {
              hasData: !!result.dataPackage.currentStudents.data,
              dataLength: result.dataPackage.currentStudents.data?.length,
              hasByYearSemester: !!result.dataPackage.currentStudents.byYearSemester,
              byYearSemesterKeys: Object.keys(result.dataPackage.currentStudents.byYearSemester || {}),
              count: result.dataPackage.currentStudents.count
            })
            
            // 顯示前3筆學生資料樣本
            if (result.dataPackage.currentStudents.data?.length > 0) {
              console.log('currentStudents 前3筆樣本:', result.dataPackage.currentStudents.data.slice(0, 3))
            }
          } else {
            console.log('⚠️ 數據包中缺少 currentStudents 數據！')
          }
        }
        
        return result.dataPackage
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error(`❌ 載入 ${year} 年度數據包失敗:`, error)
      throw error
    }
  }

  /**
   * 檢查快取是否有效
   */
  isCacheValid(requestedYear, dashboardType) {
    if (!this.dataCache.currentDataPackage || !this.dataCache.loadTime) {
      return false
    }
    
    // 對於 examScore 和 stScore，不需要檢查年份匹配（因為包含所有年份）
    if (dashboardType !== 'examScore' && dashboardType !== 'stScore') {
      // 檢查年份是否匹配
      if (this.dataCache.currentYear !== requestedYear) {
        return false
      }
    }
    
    // 檢查是否過期
    const now = Date.now()
    const age = now - this.dataCache.loadTime
    if (age > this.CACHE_DURATION) {
      console.log('⏰ 數據包快取已過期，需要重新載入')
      return false
    }
    
    return true
  }

  /**
   * 獲取 dashboard 對應的數據 key
   */
  getDashboardDataKey(dashboardType) {
    const keyMap = {
      'newbie': 'students',
      'graduate': 'graduates',
      'examScore': 'examScores',
      'stScore': 'stScores',
      'currentStudent': 'currentStudents'
    }
    return keyMap[dashboardType] || dashboardType
  }
  
  /**
   * 獲取當前數據包
   */
  getCurrentDataPackage() {
    return this.dataCache.currentDataPackage
  }

  /**
   * 清除快取
   */
  clearCache() {
    this.dataCache = {
      availableYears: null,
      currentDataPackage: null,
      currentYear: null,
      loadTime: null
    }
    console.log('🗑️  數據快取已清除')
  }

  /**
   * 前端計算工具 - 避免重複查詢數據庫
   */
  
  // 從數據包中獲取學生資料
  getStudentsFromPackage(filters = {}) {
    const dataPackage = this.getCurrentDataPackage()
    if (!dataPackage) {
      throw new Error('數據包尚未載入')
    }

    let students = dataPackage.students.data
    
    // 前端過濾（避免重複查詢數據庫）
    if (filters.class) {
      students = students.filter(s => s['班級'] === filters.class)
    }
    if (filters.channel) {
      students = students.filter(s => s['錄取管道'] === filters.channel)
    }
    if (filters.department) {
      students = students.filter(s => s['科別'] === filters.department)
    }
    
    return students
  }

  // 從數據包中獲取畢業生資料
  getGraduatesFromPackage(filters = {}) {
    const dataPackage = this.getCurrentDataPackage()
    if (!dataPackage) {
      throw new Error('數據包尚未載入')
    }
    
    if (!dataPackage.graduates || !dataPackage.graduates.data) {
      console.warn('數據包中沒有畢業生資料')
      return []
    }

    let graduates = dataPackage.graduates.data
    
    // 前端過濾
    if (filters.school) {
      graduates = graduates.filter(g => g['錄取學校'] === filters.school)
    }
    if (filters.pathway) {
      graduates = graduates.filter(g => g['入學管道'] === filters.pathway)
    }
    
    return graduates
  }

  // 從數據包中獲取學測成績
  getExamScoresFromPackage() {
    const dataPackage = this.getCurrentDataPackage()
    if (!dataPackage) {
      throw new Error('數據包尚未載入')
    }
    
    return {
      students: dataPackage.examScores.data,
      benchmarks: dataPackage.examScores.benchmarks
    }
  }

  // 從數據包中獲取分科成績
  getSTScoresFromPackage() {
    const dataPackage = this.getCurrentDataPackage()
    if (!dataPackage) {
      throw new Error('數據包尚未載入')
    }
    
    return {
      students: dataPackage.stScores.data,
      benchmarks: dataPackage.stScores.benchmarks
    }
  }

  /**
   * 統計函數 - 前端計算，避免查詢數據庫
   */
  
  // 計算性別統計
  calculateGenderStats() {
    const students = this.getStudentsFromPackage()
    const stats = {}
    
    students.forEach(student => {
      const gender = student['性別'] || '未知'
      stats[gender] = (stats[gender] || 0) + 1
    })
    
    return stats
  }

  // 計算管道統計
  calculateChannelStats() {
    const students = this.getStudentsFromPackage()
    const stats = {}
    
    students.forEach(student => {
      const channel = student['錄取管道'] || '未知'
      stats[channel] = (stats[channel] || 0) + 1
    })
    
    return stats
  }

  // 計算學校統計
  calculateSchoolStats() {
    const graduates = this.getGraduatesFromPackage()
    const stats = {}
    
    graduates.forEach(graduate => {
      const school = graduate['錄取學校'] || '未知'
      stats[school] = (stats[school] || 0) + 1
    })
    
    return stats
  }

  /**
   * 效能監控
   */
  getPerformanceStats() {
    const dataPackage = this.getCurrentDataPackage()
    if (!dataPackage) {
      return null
    }
    
    return {
      year: this.dataCache.currentYear,
      loadTime: this.dataCache.loadTime,
      cacheAge: Date.now() - this.dataCache.loadTime,
      totalRecords: dataPackage.metadata.totalRecords,
      backendQueries: dataPackage.metadata.queries,
      estimatedFirestoreQueries: dataPackage.metadata.queries
    }
  }
}

// 建立全域實例
export const optimizedApiService = new OptimizedApiService()

// 兼容性包裝函數
export const getOptimizedData = {
  async availableYears() {
    return await optimizedApiService.getAvailableYears()
  },
  
  async completePackage(year) {
    return await optimizedApiService.getCompleteDataPackage(year)
  },
  
  students(filters) {
    return optimizedApiService.getStudentsFromPackage(filters)
  },
  
  graduates(filters) {
    return optimizedApiService.getGraduatesFromPackage(filters)
  },
  
  examScores() {
    return optimizedApiService.getExamScoresFromPackage()
  },
  
  stScores() {
    return optimizedApiService.getSTScoresFromPackage()
  }
}