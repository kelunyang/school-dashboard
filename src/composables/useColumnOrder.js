import { ref, computed } from 'vue'

export function useColumnOrder(allColumns, selectedColumns, storageKey) {
  // 載入保存的列順序
  const loadColumnOrder = () => {
    const saved = localStorage.getItem(`${storageKey}ColumnOrder`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return null
      }
    }
    return null
  }
  
  // 列順序（prop 的陣列）
  const columnOrder = ref(loadColumnOrder() || [])
  
  // 保存列順序
  const saveColumnOrder = (order) => {
    columnOrder.value = order
    localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(order))
  }
  
  // 移動列
  const moveColumn = (fromIndex, toIndex) => {
    const columns = visibleColumns.value
    if (fromIndex < 0 || fromIndex >= columns.length || 
        toIndex < 0 || toIndex >= columns.length) {
      return
    }
    
    // 獲取當前可見列的順序
    const currentOrder = columns.map(col => col.prop)
    
    // 移動列
    const [movedProp] = currentOrder.splice(fromIndex, 1)
    currentOrder.splice(toIndex, 0, movedProp)
    
    // 更新完整的列順序（包括隱藏的列）
    const allProps = allColumns.value.map(col => col.prop)
    const hiddenProps = allProps.filter(prop => !currentOrder.includes(prop))
    
    // 保存新順序
    saveColumnOrder([...currentOrder, ...hiddenProps])
  }
  
  // 計算排序後的可見列
  const visibleColumns = computed(() => {
    if (!allColumns.value || !selectedColumns.value) return []
    
    // 建立列的映射
    const columnMap = new Map(allColumns.value.map(col => [col.prop, col]))
    
    // 如果有保存的順序，按順序排列
    if (columnOrder.value && columnOrder.value.length > 0) {
      const ordered = []
      
      // 按保存的順序添加可見列
      columnOrder.value.forEach(prop => {
        if (selectedColumns.value.includes(prop) && columnMap.has(prop)) {
          ordered.push(columnMap.get(prop))
        }
      })
      
      // 添加任何新的可見列（不在保存順序中的）
      selectedColumns.value.forEach(prop => {
        if (!columnOrder.value.includes(prop) && columnMap.has(prop)) {
          ordered.push(columnMap.get(prop))
        }
      })
      
      return ordered
    }
    
    // 沒有保存的順序，按選中順序返回
    return selectedColumns.value
      .map(prop => columnMap.get(prop))
      .filter(col => col)
  })
  
  return {
    visibleColumns,
    moveColumn,
    columnOrder,
    saveColumnOrder
  }
}