import { ref, computed, watch } from 'vue'

export function useColumnDraggable3(columns, storageKey) {
  const columnOrder = ref([])
  const showColumnManager = ref(false)
  
  // 初始化列順序
  const initColumnOrder = () => {
    const savedOrder = localStorage.getItem(`${storageKey}ColumnOrder`)
    if (savedOrder) {
      try {
        columnOrder.value = JSON.parse(savedOrder)
      } catch (e) {
        columnOrder.value = columns.value ? columns.value.map(col => col.prop) : []
      }
    } else {
      columnOrder.value = columns.value ? columns.value.map(col => col.prop) : []
    }
  }
  
  // 排序後的列
  const sortedColumns = computed(() => {
    if (!columns.value || !columnOrder.value.length) return columns.value || []
    
    const columnMap = new Map(columns.value.map(col => [col.prop, col]))
    const sorted = []
    
    // 先添加有序的列
    columnOrder.value.forEach(prop => {
      const col = columnMap.get(prop)
      if (col) {
        sorted.push(col)
        columnMap.delete(prop)
      }
    })
    
    // 添加任何新的列
    columnMap.forEach(col => {
      sorted.push(col)
    })
    
    return sorted
  })
  
  // 更新列順序
  const updateColumnOrder = (newOrder) => {
    columnOrder.value = newOrder
    localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(newOrder))
  }
  
  // 監聽列變化，添加新列到順序中
  watch(() => columns.value, () => {
    if (!columns.value) return
    
    const currentProps = columns.value.map(col => col.prop)
    const newProps = currentProps.filter(prop => !columnOrder.value.includes(prop))
    
    if (newProps.length > 0) {
      columnOrder.value = [...columnOrder.value, ...newProps]
      localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(columnOrder.value))
    }
  }, { deep: true })
  
  // 初始化
  initColumnOrder()
  
  return {
    columnOrder,
    sortedColumns,
    showColumnManager,
    updateColumnOrder
  }
}