// 跨年份搜尋功能混合
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiService } from '../services/apiService'

export function useCrossYearSearch(functionType, getCurrentData, getCurrentYearValue) {
  // 跨年份資料狀態
  const crossYearData = ref([])
  const hasCrossYearData = ref(false)
  
  // API 方法映射
  const apiMethods = {
    currentStudent: 'searchCrossYearCurrentStudents',
    examScore: 'searchCrossYearExamScores',
    stScore: 'searchCrossYearSTScores',
    graduate: 'searchCrossYearGraduates',
    newbie: 'searchCrossYearNewbies'
  }
  
  // 搜尋跨年份資料
  const searchCrossYearData = async (crossFunctionalUIDs) => {
    if (!crossFunctionalUIDs.length) {
      crossYearData.value = []
      hasCrossYearData.value = false
      return
    }
    
    const currentData = getCurrentData()
    if (!currentData.length) return
    
    const uidSet = new Set(crossFunctionalUIDs.map(item => item.uid))
    
    // 找出當前年份沒有的 UID
    const foundUIDs = new Set()
    currentData.forEach(item => {
      // 根據功能類型獲取不同的UID字段
      let uid
      switch (functionType) {
        case 'currentStudent':
          uid = item.身分證字號 || item.學號 || item.studentId || item.nationalId || item.身分證統一編號
          break
        case 'examScore':
        case 'stScore':
          uid = item.idNumber || item.registrationNumber
          break
        case 'graduate':
          uid = item.idNumber || item['身分證號（加密）']
          break
        case 'newbie':
          uid = item.身分證統一編號 || item.身分證字號 || item.nationalId
          break
        default:
          uid = item.uid || item.id
      }
      
      if (uid && uidSet.has(uid)) foundUIDs.add(uid)
    })
    
    const missingUIDs = [...uidSet].filter(uid => !foundUIDs.has(uid))
    
    if (missingUIDs.length === 0) {
      crossYearData.value = []
      hasCrossYearData.value = false
      return
    }
    
    try {
      console.log(`搜尋${functionType}跨年份資料:`, missingUIDs)
      
      const apiMethod = apiMethods[functionType]
      if (!apiMethod || !apiService[apiMethod]) {
        console.warn(`未找到${functionType}的跨年份搜尋API方法`)
        return
      }
      
      const result = await apiService[apiMethod]({
        uids: missingUIDs,
        currentYear: getCurrentYearValue()
      })
      
      if (result.success && result.data) {
        crossYearData.value = result.data.map(item => ({
          ...item,
          _isCrossYear: true,
          _originalYear: item.year || item.examYear || item.資料年份 || '未知年份'
        }))
        
        hasCrossYearData.value = crossYearData.value.length > 0
        
        if (crossYearData.value.length > 0) {
          ElMessage.success(`找到 ${crossYearData.value.length} 筆跨年份資料`)
        }
      } else {
        crossYearData.value = []
        hasCrossYearData.value = false
      }
    } catch (error) {
      console.error(`搜尋${functionType}跨年份資料失敗:`, error)
      ElMessage.warning(`搜尋跨年份資料失敗`)
      crossYearData.value = []
      hasCrossYearData.value = false
    }
  }
  
  // 清除跨年份資料
  const clearCrossYearData = () => {
    crossYearData.value = []
    hasCrossYearData.value = false
  }
  
  // 合併當前年份和跨年份資料
  const mergeCrossYearData = (currentData, crossFunctionalUIDs, isFilterActive) => {
    if (!isFilterActive || !crossFunctionalUIDs.length) {
      return currentData
    }
    
    const uidSet = new Set(crossFunctionalUIDs.map(item => item.uid))
    
    // 篩選當前年份資料
    const currentYearResults = currentData.filter(item => {
      let uid
      switch (functionType) {
        case 'currentStudent':
          uid = item.身分證字號 || item.學號 || item.studentId || item.nationalId || item.身分證統一編號
          break
        case 'examScore':
        case 'stScore':
          uid = item.idNumber || item.registrationNumber
          break
        case 'graduate':
          uid = item.idNumber || item['身分證號（加密）']
          break
        case 'newbie':
          uid = item.身分證統一編號 || item.身分證字號 || item.nationalId
          break
        default:
          uid = item.uid || item.id
      }
      
      return uid && uidSet.has(uid)
    })
    
    // 合併當前年份和跨年份資料
    return [...currentYearResults, ...crossYearData.value]
  }
  
  return {
    crossYearData,
    hasCrossYearData,
    searchCrossYearData,
    clearCrossYearData,
    mergeCrossYearData
  }
}