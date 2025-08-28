import { ref, computed } from 'vue'

export function useAdvancedSearch(initialData = []) {
  const advancedConditions = ref([])
  const showAdvancedDialog = ref(false)
  
  // 套用進階篩選條件
  const applyAdvancedFilters = (data, conditions = advancedConditions.value) => {
    if (!conditions.length) return data
    
    const validConditions = conditions.filter(condition => 
      condition.field && condition.patterns.trim()
    )
    
    if (!validConditions.length) return data
    
    // 使用 AND 邏輯：逐層過濾，每個條件都必須滿足
    let filteredData = data
    
    validConditions.forEach((condition, index) => {
      console.log(`🔍 應用條件 ${index + 1}: ${condition.field}`)
      
      filteredData = filteredData.filter(record => {
        const fieldValue = String(record[condition.field] || '')
        const patterns = condition.patterns
          .split('\n')
          .map(p => p.trim())
          .filter(p => p)
        
        // 該條件的任一模式匹配即通過該條件（條件內部是 OR）
        const conditionPassed = patterns.some(pattern => {
          try {
            // 自動轉換用戶輸入為模糊搜尋格式
            let processedPattern = pattern
            
            // 檢查是否已經是regex格式（包含特殊字符）
            const isAlreadyRegex = /[\[\](){}.*+?^$|\\]/.test(pattern)
            
            if (!isAlreadyRegex) {
              // 如果不是regex，自動添加 ^ 和 .* 實現模糊搜尋
              processedPattern = `^${pattern}.*`
            }
            
            const regex = new RegExp(processedPattern, 'i') // 不區分大小寫
            return regex.test(fieldValue)
          } catch (error) {
            console.warn('無效的正規表達式:', pattern, error)
            return false
          }
        })
        
        return conditionPassed
      })
      
      console.log(`🔍 條件 ${index + 1} 篩選後剩餘 ${filteredData.length} 筆資料`)
    })
    
    return filteredData
  }
  
  // 獲取可用欄位
  const getAvailableFields = (data) => {
    if (!data.length) return []
    
    const sampleRecord = data[0]
    return Object.keys(sampleRecord)
      .filter(key => {
        // 排除敏感和無用欄位
        return key !== 'uid' && 
               key !== '住址經度' && 
               key !== '住址緯度' && 
               key !== '經度' && 
               key !== '緯度'
      })
      .map(key => ({
        value: key,
        label: key // 直接使用中文欄位名稱
      }))
  }
  
  // 處理篩選條件套用
  const handleApplyFilters = (conditions) => {
    advancedConditions.value = conditions
    showAdvancedDialog.value = false
  }
  
  // 顯示搜尋對話框
  const showSearchDialog = () => {
    showAdvancedDialog.value = true
  }
  
  // 清除所有條件
  const clearConditions = () => {
    advancedConditions.value = []
  }
  
  // 計算篩選後的數據
  const createFilteredData = (baseData) => {
    return computed(() => {
      return applyAdvancedFilters(baseData.value)
    })
  }
  
  return {
    advancedConditions,
    showAdvancedDialog,
    applyAdvancedFilters,
    getAvailableFields,
    handleApplyFilters,
    showSearchDialog,
    clearConditions,
    createFilteredData
  }
}