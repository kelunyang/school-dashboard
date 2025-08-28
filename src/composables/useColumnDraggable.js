import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

export function useColumnDraggable(tableRef, columns, storageKey) {
  const sortableInstance = ref(null)
  const columnOrder = ref([])
  const reorderTrigger = ref(0) // 用於觸發重新排序
  const onColumnReorder = ref(null) // 回調函數
  
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
  
  // 根據順序排序列
  const sortColumns = (cols) => {
    if (!columnOrder.value.length) return cols
    
    return [...cols].sort((a, b) => {
      const aIndex = columnOrder.value.indexOf(a.prop)
      const bIndex = columnOrder.value.indexOf(b.prop)
      
      // 如果找不到，放到最後
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      
      return aIndex - bIndex
    })
  }
  
  // 初始化拖拽功能
  const initSortable = async () => {
    // 動態導入 Sortable 以避免初始化問題
    const Sortable = (await import('sortablejs')).default
    
    await nextTick()
    
    if (!tableRef.value) return
    
    const headerRow = tableRef.value.$el.querySelector('.el-table__header-wrapper tr')
    if (!headerRow) return
    
    // 如果已經有實例，先銷毀
    if (sortableInstance.value) {
      sortableInstance.value.destroy()
    }
    
    sortableInstance.value = Sortable.create(headerRow, {
      animation: 300,
      delay: 100,
      delayOnTouchOnly: true,
      handle: '.cell', // 使用單元格內容作為拖拽手柄
      filter: '.el-table-column--selection, .is-hidden, [class*="el-table-fixed"]', // 排除選擇框列和固定列
      preventOnFilter: false,
      dataIdAttr: 'data-column-key',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onStart: (evt) => {
        // 添加拖拽開始時的樣式
        document.body.classList.add('dragging-column')
      },
      onEnd: async (evt) => {
        // 移除拖拽樣式
        document.body.classList.remove('dragging-column')
        const oldIndex = evt.oldIndex
        const newIndex = evt.newIndex
        
        if (oldIndex === newIndex) return
        
        // 找出實際的列索引（需要考慮選擇框列）
        const allThs = headerRow.querySelectorAll('th')
        let hasSelectionColumn = false
        
        // 檢查是否有選擇框列
        if (allThs[0] && allThs[0].classList.contains('el-table-column--selection')) {
          hasSelectionColumn = true
        }
        
        // 調整索引
        const realOldIndex = hasSelectionColumn ? oldIndex - 1 : oldIndex
        const realNewIndex = hasSelectionColumn ? newIndex - 1 : newIndex
        
        if (realOldIndex < 0 || realNewIndex < 0) return
        
        // 更新列順序
        const newOrder = [...columnOrder.value]
        const [movedItem] = newOrder.splice(realOldIndex, 1)
        newOrder.splice(realNewIndex, 0, movedItem)
        
        columnOrder.value = newOrder
        
        // 保存到 localStorage
        localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(newOrder))
        
        // 觸發重新排序
        await nextTick()
        reorderTrigger.value++
        
        // 觸發表格重新渲染
        await nextTick()
        if (tableRef.value) {
          tableRef.value.doLayout()
        }
      }
    })
  }
  
  // 監聽表格變化，重新初始化拖拽
  watch(() => tableRef.value, async () => {
    if (tableRef.value) {
      await nextTick()
      initSortable()
    }
  })
  
  // 監聽列變化，更新順序
  watch(() => columns.value, () => {
    // 添加新列到順序中
    const currentProps = columns.value.map(col => col.prop)
    const newProps = currentProps.filter(prop => !columnOrder.value.includes(prop))
    if (newProps.length > 0) {
      columnOrder.value = [...columnOrder.value, ...newProps]
      localStorage.setItem(`${storageKey}ColumnOrder`, JSON.stringify(columnOrder.value))
    }
  }, { deep: true })
  
  onMounted(() => {
    initColumnOrder()
    initSortable()
  })
  
  onUnmounted(() => {
    if (sortableInstance.value) {
      sortableInstance.value.destroy()
    }
  })
  
  return {
    columnOrder,
    sortColumns,
    reorderTrigger
  }
}