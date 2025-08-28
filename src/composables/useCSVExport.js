/**
 * CSV 導出 Composable
 * 提供統一的數據導出功能
 */

import { ref } from 'vue'
import { 
  exportToCSV, 
  exportExamScores, 
  exportSTScores, 
  exportStudentList, 
  exportGraduateList,
  exportStatistics
} from '@/utils/csvExport'

export function useCSVExport() {
  const isExporting = ref(false)
  const exportStatus = ref('')
  
  /**
   * 根據篩選條件生成文件名
   */
  const generateFilteredFilename = (baseName, filterInfo, recordCount) => {
    const timestamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    let filename = baseName
    
    // 添加篩選條件到文件名
    const filters = []
    if (filterInfo.year && filterInfo.year !== 'all') {
      filters.push(`${filterInfo.year}年`)
    }
    if (filterInfo.class && filterInfo.class.length > 0) {
      filters.push(`班級${filterInfo.class.join('_')}`)
    }
    if (filterInfo.subject) {
      filters.push(`${filterInfo.subject}科`)
    }
    if (filterInfo.scoreRange) {
      filters.push(`分數${filterInfo.scoreRange}`)
    }
    if (filterInfo.department) {
      filters.push(filterInfo.department)
    }
    
    if (filters.length > 0) {
      filename += '_' + filters.join('_')
    }
    
    filename += `_${recordCount}筆_${timestamp}`
    
    return filename
  }

  /**
   * 通用導出函數
   */
  const exportData = async (data, filename, options = {}) => {
    if (!data || data.length === 0) {
      exportStatus.value = '沒有數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在準備導出...'
      
      // 模擬一點處理時間，給用戶反饋
      await new Promise(resolve => setTimeout(resolve, 100))
      
      exportToCSV(data, filename, options)
      
      exportStatus.value = `已成功導出 ${data.length} 筆數據`
      return true
    } catch (error) {
      console.error('導出失敗:', error)
      exportStatus.value = '導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      
      // 3秒後清除狀態信息
      setTimeout(() => {
        exportStatus.value = ''
      }, 3000)
    }
  }

  /**
   * 學測成績導出（導出當前篩選結果）
   */
  const exportExamData = async (filteredData, filterInfo = {}) => {
    if (!filteredData || filteredData.length === 0) {
      exportStatus.value = '當前篩選結果為空，沒有數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在導出當前篩選的學測成績...'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 根據篩選條件生成文件名
      const filename = generateFilteredFilename('學測成績', filterInfo, filteredData.length)
      exportExamScores(filteredData, filename)
      
      exportStatus.value = `已成功導出 ${filteredData.length} 筆篩選後的學測成績`
      return true
    } catch (error) {
      console.error('學測成績導出失敗:', error)
      exportStatus.value = '學測成績導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      setTimeout(() => { exportStatus.value = '' }, 3000)
    }
  }

  /**
   * 分科測驗導出（導出當前篩選結果）
   */
  const exportSTData = async (filteredData, filterInfo = {}) => {
    if (!filteredData || filteredData.length === 0) {
      exportStatus.value = '當前篩選結果為空，沒有數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在導出當前篩選的分科測驗成績...'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const filename = generateFilteredFilename('分科測驗成績', filterInfo, filteredData.length)
      exportSTScores(filteredData, filename)
      
      exportStatus.value = `已成功導出 ${filteredData.length} 筆篩選後的分科測驗成績`
      return true
    } catch (error) {
      console.error('分科測驗導出失敗:', error)
      exportStatus.value = '分科測驗導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      setTimeout(() => { exportStatus.value = '' }, 3000)
    }
  }

  /**
   * 學生名單導出（導出當前篩選結果）
   */
  const exportStudentData = async (filteredData, filterInfo = {}) => {
    if (!filteredData || filteredData.length === 0) {
      exportStatus.value = '當前篩選結果為空，沒有數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在導出當前篩選的學生名單...'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const filename = generateFilteredFilename('學生名單', filterInfo, filteredData.length)
      exportStudentList(filteredData, filename)
      
      exportStatus.value = `已成功導出 ${filteredData.length} 筆篩選後的學生資料`
      return true
    } catch (error) {
      console.error('學生名單導出失敗:', error)
      exportStatus.value = '學生名單導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      setTimeout(() => { exportStatus.value = '' }, 3000)
    }
  }

  /**
   * 畢業生名單導出（導出當前篩選結果）
   */
  const exportGraduateData = async (filteredData, filterInfo = {}) => {
    if (!filteredData || filteredData.length === 0) {
      exportStatus.value = '當前篩選結果為空，沒有數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在導出當前篩選的畢業生名單...'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const filename = generateFilteredFilename('畢業生名單', filterInfo, filteredData.length)
      exportGraduateList(filteredData, filename)
      
      exportStatus.value = `已成功導出 ${filteredData.length} 筆篩選後的畢業生資料`
      return true
    } catch (error) {
      console.error('畢業生名單導出失敗:', error)
      exportStatus.value = '畢業生名單導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      setTimeout(() => { exportStatus.value = '' }, 3000)
    }
  }

  /**
   * 統計資料導出
   */
  const exportStatsData = async (data, title) => {
    if (!data || data.length === 0) {
      exportStatus.value = '沒有統計數據可以導出'
      return false
    }

    try {
      isExporting.value = true
      exportStatus.value = '正在導出統計資料...'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      exportStatistics(data, title)
      
      exportStatus.value = `已成功導出統計資料`
      return true
    } catch (error) {
      console.error('統計資料導出失敗:', error)
      exportStatus.value = '統計資料導出失敗: ' + error.message
      return false
    } finally {
      isExporting.value = false
      setTimeout(() => { exportStatus.value = '' }, 3000)
    }
  }

  return {
    // 狀態
    isExporting,
    exportStatus,
    
    // 通用方法
    exportData,
    
    // 專用方法
    exportExamData,
    exportSTData,
    exportStudentData,
    exportGraduateData,
    exportStatsData
  }
}