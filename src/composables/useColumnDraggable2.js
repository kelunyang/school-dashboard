import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'

export function useColumnDraggable2(tableRef, columns, storageKey) {
  const sortableInstance = ref(null)
  const columnOrder = ref([])
  
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
  
  // 排序後的列（這是關鍵 - 返回一個新的已排序數組）
  const sortedColumns = computed(() => {
    if (!columns.value || !columnOrder.value.length) return columns.value || []
    
    // 創建一個映射以快速查找列
    const columnMap = new Map(columns.value.map(col => [col.prop, col]))
    
    // 根據 columnOrder 排序
    const sorted = []
    
    // 先添加有序的列
    columnOrder.value.forEach(prop => {
      const col = columnMap.get(prop)
      if (col) {
        sorted.push(col)
        columnMap.delete(prop)
      }
    })
    
    // 添加任何新的列（不在順序中的）
    columnMap.forEach(col => {
      sorted.push(col)
    })
    
    return sorted
  })
  
  // 初始化拖拽功能
  const initSortable = async () => {
    // 動態導入 Sortable
    const Sortable = (await import('sortablejs')).default
    
    await nextTick()
    
    if (!tableRef.value || !tableRef.value.$el) return
    
    // 等待表格完全渲染
    await nextTick()
    
    const headerRow = tableRef.value.$el.querySelector('.el-table__header-wrapper tr')
    if (!headerRow) {
      console.warn('無法找到表格頭部行')
      return
    }
    
    // 如果已經有實例，先銷毀
    if (sortableInstance.value) {
      sortableInstance.value.destroy()
    }
    
    sortableInstance.value = Sortable.create(headerRow, {
      animation: 300,
      delay: 100,
      delayOnTouchOnly: true,
      handle: '.cell',
      filter: '.el-table-column--selection, .is-hidden',
      preventOnFilter: false,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: async (evt) => {
        const oldIndex = evt.oldIndex
        const newIndex = evt.newIndex
        
        if (oldIndex === newIndex) return
        
        // 檢查是否有選擇框列
        const allThs = headerRow.querySelectorAll('th')
        let hasSelectionColumn = false
        
        if (allThs[0] && allThs[0].classList.contains('el-table-column--selection')) {
          hasSelectionColumn = true
        }
        
        // 調整索引（考慮選擇框列）
        const realOldIndex = hasSelectionColumn ? oldIndex - 1 : oldIndex
        const realNewIndex = hasSelectionColumn ? newIndex - 1 : newIndex
        
        if (realOldIndex < 0 || realNewIndex < 0) return
        
        // 獲取當前可見列的順序
        const currentColumns = sortedColumns.value
        if (!currentColumns || realOldIndex >= currentColumns.length || realNewIndex >= currentColumns.length) {
          return
        }
        
        // 更新列順序
        const newOrder = currentColumns.map(col => col.prop)
        const [movedProp] = newOrder.splice(realOldIndex, 1)
        newOrder.splice(realNewIndex, 0, movedProp)
        
        columnOrder.value = newOrder
        
        // 保存到 localStorage
        localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(newOrder))
        
        // 強制 Vue 更新
        await nextTick()
        
        // 重新初始化拖拽（因為 DOM 已經更新）
        setTimeout(() => {
          initSortable()
        }, 100)
      }
    })
  }
  
  // 監聽表格和列的變化
  watch([tableRef, () => columns.value?.length], async () => {
    if (tableRef.value && columns.value?.length > 0) {
      await nextTick()
      setTimeout(() => {
        initSortable()
      }, 300) // 給表格足夠的時間渲染
    }
  })
  
  onMounted(() => {
    initColumnOrder()
  })
  
  onUnmounted(() => {
    if (sortableInstance.value) {
      sortableInstance.value.destroy()
    }
  })
  
  return {
    columnOrder,
    sortedColumns, // 返回計算屬性而不是函數
    initSortable // 暴露這個方法以便手動重新初始化
  }
}