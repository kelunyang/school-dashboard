<template>
  <div>
    <!-- 統計資訊和操作按鈕 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="18">
        <el-alert
          :title="`共找到 ${students.length} 位學生`"
          type="info"
          :closable="false"
          show-icon
        />
      </el-col>
      <el-col :span="6" style="text-align: right;">
        <el-button 
          @click="showColumnSettings"
          size="small"
        >
          <el-icon><Setting /></el-icon>
          選取顯示的欄位
        </el-button>
      </el-col>
    </el-row>

    <!-- TanStack 表格 with 虛擬滾動 -->
    <div 
      class="table-container" 
      ref="tableContainer"
      @scroll="handleScroll"
    >
      <table class="tanstack-table">
        <thead>
          <tr>
            <th class="pinned-left">跨功能</th>
            <th 
              v-for="key in orderedVisibleColumnKeys" 
              :key="key"
              :style="{ width: getColumnWidth(key) + 'px' }"
              :draggable="!isFixedColumn(key)"
              @click="() => handleSort(key)"
              @dragstart="handleDragStart($event, key)"
              @dragend="handleDragEnd"
              @dragover="handleDragOver($event)"
              @drop="handleDrop($event, key)"
              class="sortable draggable-header"
              :class="{ 
                'pinned-column': isFixedColumn(key),
                'dragging': draggedColumn === key
              }"
            >
              {{ key }}
              <span v-if="sortConfig.key === key" class="sort-indicator">
                {{ sortConfig.order === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- 虛擬滾動的可視區域 -->
          <tr 
            v-for="(item, index) in visibleItems" 
            :key="item._isSkeleton ? `skeleton-${virtualStart + index}` : (item.id || virtualStart + index)"
            :class="{ 
              'cross-year-row': item._isCrossYear && !item._isSkeleton,
              'skeleton-row': item._isSkeleton
            }"
          >
            <td class="pinned-left">
              <el-skeleton-item 
                v-if="item._isSkeleton" 
                variant="button" 
                style="width: 24px; height: 24px;" 
              />
              <el-checkbox
                v-else
                :model-value="isCrossFunctionalSelected(getUID(item))"
                @update:model-value="(value) => handleCrossFunctionalChange(item, value)"
              />
            </td>
            <td v-for="key in orderedVisibleColumnKeys" :key="key">
              <template v-if="item._isSkeleton">
                <el-skeleton-item variant="text" />
              </template>
              <template v-else-if="key === '照片連結' || key === 'photoLink'">
                <el-button
                  v-if="item[key] && typeof item[key] === 'string'"
                  size="small"
                  type="primary"
                  @click="openPhotoDirectly(item[key])"
                >
                  開啟照片
                </el-button>
                <span v-else>無照片</span>
              </template>
              <template v-else>
                {{ formatCellValue(item[key]) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- 虛擬滾動的佔位符，用於維持正確的滾動條高度 -->
      <div 
        :style="{ 
          height: (totalHeight - visibleHeight) + 'px',
          width: '1px',
          position: 'absolute',
          top: visibleHeight + 'px',
          left: '0px',
          pointerEvents: 'none'
        }"
      ></div>
    </div>
    
    <!-- 欄位設定抽屜 -->
    <el-drawer
      v-model="columnSettingsVisible"
      title="選取顯示的欄位"
      direction="ttb"
      size="60%"
    >
      <div class="column-settings">
        <el-transfer
          v-model="tempVisibleColumnIds"
          :data="transferData"
          :titles="['隱藏的欄位', '顯示的欄位']"
          :button-texts="['隱藏', '顯示']"
          :format="{
            noChecked: '${total}',
            hasChecked: '${checked}/${total}'
          }"
          @change="handleTransferChange"
          filterable
          :filter-placeholder="'搜尋欄位'"
        >
          <template #default="{ option }">
            <span>{{ option.label }}</span>
          </template>
        </el-transfer>
        <el-alert
          title="注意：「身分證字號」、「資料年份」、「學期」為必要欄位，無法隱藏"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 10px;"
        />
      </div>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="cancelColumnSettings">取消</el-button>
          <el-button type="primary" @click="applyColumnSettings">確定</el-button>
        </div>
      </template>
    </el-drawer>
    
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, onMounted, nextTick } from 'vue'
import { getStudentUID } from '../utils/uidFactory'
import { Setting } from '@element-plus/icons-vue'
import { ElCheckbox, ElButton, ElSkeletonItem } from 'element-plus'

const props = defineProps({
  students: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Inject cross-functional query functions
const addToCrossFunctionalUIDs = inject('addToCrossFunctionalUIDs', () => {})
const removeFromCrossFunctionalUIDs = inject('removeFromCrossFunctionalUIDs', () => {})
const isCrossFunctionalSelected = inject('isCrossFunctionalSelected', () => false)

// 表格相關
const tableContainer = ref(null)

// 排序設定
const sortConfig = ref({ key: null, order: 'asc' })

// 虛擬滾動相關
const itemHeight = ref(50) // 每行的高度
const containerHeight = ref(600) // 容器高度
const virtualStart = ref(0) // 虛擬滾動開始索引
const visibleCount = ref(20) // 可見行數
const bufferSize = ref(5) // 緩衝區大小

// 欄位設定
const columnSettingsVisible = ref(false)
const visibleColumnIds = ref([])
const tempVisibleColumnIds = ref([])

// 拖曳相關
const draggedColumn = ref(null)
const columnOrder = ref([])

// 所有欄位（從資料動態提取）
const allColumnKeys = computed(() => {
  const realStudents = props.students.filter(s => !s._isSkeleton)
  if (!realStudents.length) return []
  
  const firstRecord = realStudents[0]
  
  return Object.keys(firstRecord).filter(key => {
    // 排除不需要的欄位
    if (key === 'uid' || key === '_isCrossYear' || key === 'id') return false
    
    // 檢查多筆資料中這個欄位的值
    const sampleValues = realStudents.slice(0, 5).map(student => student[key])
    
    // 如果所有樣本值都是物件（且不是照片相關欄位），排除此欄位
    const allObjects = sampleValues.every(value => 
      value !== null && 
      value !== undefined && 
      typeof value === 'object'
    )
    
    if (allObjects && !key.includes('照片') && !key.includes('photo')) {
      console.log(`排除物件欄位: ${key}`)
      return false
    }
    
    // 檢查是否有有意義的值
    const meaningfulValues = sampleValues.filter(value => 
      value !== null && 
      value !== undefined && 
      value !== '' && 
      !(typeof value === 'object')
    )
    
    // 如果超過80%的值都是空的，可能不需要顯示這個欄位
    if (meaningfulValues.length / sampleValues.length < 0.2) {
      console.log(`排除大多為空的欄位: ${key}`)
      return false
    }
    
    return true
  })
})

// 可見欄位
const visibleColumnKeys = computed(() => {
  if (visibleColumnIds.value.length === 0) {
    // 如果沒有設定，顯示所有欄位
    return allColumnKeys.value
  }
  // 確保固定欄位始終顯示
  const fixedColumns = ['身分證字號', '資料年份', '學期']
  const result = [...visibleColumnIds.value]
  fixedColumns.forEach(col => {
    if (allColumnKeys.value.includes(col) && !result.includes(col)) {
      result.push(col)
    }
  })
  return result.filter(key => allColumnKeys.value.includes(key))
})

// 根據拖曳順序排列的可見欄位
const orderedVisibleColumnKeys = computed(() => {
  const visible = visibleColumnKeys.value
  if (columnOrder.value.length === 0) {
    return visible
  }
  
  // 按照 columnOrder 排列
  const ordered = []
  
  // 先加入已排序的欄位
  columnOrder.value.forEach(key => {
    if (visible.includes(key)) {
      ordered.push(key)
    }
  })
  
  // 再加入未在排序中但可見的欄位
  visible.forEach(key => {
    if (!ordered.includes(key)) {
      ordered.push(key)
    }
  })
  
  return ordered
})

// 排序處理
const sortedData = computed(() => {
  if (!sortConfig.value.key) return props.students
  
  const key = sortConfig.value.key
  const order = sortConfig.value.order
  
  return [...props.students].sort((a, b) => {
    let valueA = a[key]
    let valueB = b[key]
    
    // 處理空值
    if (valueA == null) valueA = ''
    if (valueB == null) valueB = ''
    
    // 嘗試數字排序
    const numA = Number(valueA)
    const numB = Number(valueB)
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return order === 'asc' ? numA - numB : numB - numA
    }
    
    // 字串排序
    const strA = String(valueA).toLowerCase()
    const strB = String(valueB).toLowerCase()
    
    if (order === 'asc') {
      return strA.localeCompare(strB)
    } else {
      return strB.localeCompare(strA)
    }
  })
})

// 虛擬滾動相關計算
const totalHeight = computed(() => sortedData.value.length * itemHeight.value)
const visibleHeight = computed(() => visibleCount.value * itemHeight.value)

// 可見項目（包含skeleton）
const visibleItems = computed(() => {
  const start = virtualStart.value
  const end = Math.min(start + visibleCount.value + bufferSize.value * 2, sortedData.value.length)
  
  const items = []
  
  for (let i = start; i < end; i++) {
    if (i < sortedData.value.length) {
      // 真實數據
      items.push(sortedData.value[i])
    } else {
      // 如果loading且沒有數據，顯示skeleton
      if (props.loading && sortedData.value.length === 0) {
        items.push({
          id: `skeleton-${i}`,
          _isSkeleton: true
        })
      }
    }
  }
  
  // 如果正在loading且有數據，在滾動到底部時顯示skeleton
  if (props.loading && sortedData.value.length > 0 && start + visibleCount.value >= sortedData.value.length - bufferSize.value) {
    for (let i = 0; i < bufferSize.value; i++) {
      items.push({
        id: `loading-skeleton-${i}`,
        _isSkeleton: true
      })
    }
  }
  
  return items
})

// 滾動處理
const handleScroll = (event) => {
  const scrollTop = event.target.scrollTop
  const newStart = Math.floor(scrollTop / itemHeight.value)
  
  // 添加緩衝區，減少頻繁更新
  const bufferStart = Math.max(0, newStart - bufferSize.value)
  
  if (Math.abs(virtualStart.value - bufferStart) > bufferSize.value) {
    virtualStart.value = bufferStart
  }
}

// 獲取學生UID
const getUID = (student) => {
  return getStudentUID(student, 'currentStudent')
}

// 跨功能選擇處理
const handleCrossFunctionalChange = (student, checked) => {
  const uid = getUID(student)
  if (!uid) return
  
  if (checked) {
    addToCrossFunctionalUIDs(uid, 'currentStudent')
  } else {
    removeFromCrossFunctionalUIDs(uid)
  }
}

// 照片處理
const openPhotoDirectly = (photoUrl) => {
  if (!photoUrl) return
  window.open(photoUrl, '_blank')
}

// 獲取欄位寬度
const getColumnWidth = (key) => {
  const widthMap = {
    '身分證字號': 150,
    '姓名': 100,
    '班級': 80,
    '座號': 60,
    '性別': 60,
    '資料年份': 100,
    '學期': 80,
    '照片連結': 80,
    'photoLink': 80
  }
  return widthMap[key] || 120
}

// 格式化單元格值
const formatCellValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return ''
  if (typeof value === 'string' && value.trim() === '') return ''
  return String(value)
}

// 判斷是否為固定欄位
const isFixedColumn = (key) => {
  return ['身分證字號', '資料年份', '學期'].includes(key)
}

// 排序處理
const handleSort = (key) => {
  if (sortConfig.value.key === key) {
    // 切換排序順序
    sortConfig.value.order = sortConfig.value.order === 'asc' ? 'desc' : 'asc'
  } else {
    // 設定新的排序欄位
    sortConfig.value.key = key
    sortConfig.value.order = 'asc'
  }
}

// 拖曳處理
const handleDragStart = (e, key) => {
  if (isFixedColumn(key)) {
    e.preventDefault()
    return
  }
  draggedColumn.value = key
  e.dataTransfer.effectAllowed = 'move'
}

const handleDragEnd = () => {
  draggedColumn.value = null
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = (e, targetKey) => {
  e.preventDefault()
  
  if (!draggedColumn.value || draggedColumn.value === targetKey) return
  if (isFixedColumn(targetKey) || isFixedColumn(draggedColumn.value)) return
  
  const currentOrder = columnOrder.value.length ? [...columnOrder.value] : [...allColumnKeys.value]
  const draggedIndex = currentOrder.indexOf(draggedColumn.value)
  const targetIndex = currentOrder.indexOf(targetKey)
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    currentOrder.splice(draggedIndex, 1)
    currentOrder.splice(targetIndex, 0, draggedColumn.value)
    columnOrder.value = currentOrder
    
    // 儲存到 localStorage
    localStorage.setItem('currentStudentListColumnOrder', JSON.stringify(columnOrder.value))
  }
}

// Transfer 元件的資料
const transferData = computed(() => {
  return allColumnKeys.value
    .filter(key => !isFixedColumn(key)) // 排除固定欄位
    .map(key => ({
      key,
      label: key,
      disabled: false
    }))
})

// 顯示欄位設定對話框
const showColumnSettings = () => {
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = true
}

// 應用欄位設定
const applyColumnSettings = () => {
  visibleColumnIds.value = [...tempVisibleColumnIds.value]
  columnSettingsVisible.value = false
  
  // 儲存到 localStorage
  localStorage.setItem('currentStudentListVisibleColumns', JSON.stringify(visibleColumnIds.value))
}

// 取消欄位設定
const cancelColumnSettings = () => {
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = false
}

// Transfer 變更處理
const handleTransferChange = () => {
  // el-transfer 的 v-model 會自動更新 tempVisibleColumnIds
}

// 初始化虛擬滾動設定
const initVirtualScroll = () => {
  nextTick(() => {
    if (tableContainer.value) {
      const rect = tableContainer.value.getBoundingClientRect()
      containerHeight.value = rect.height || 600
      visibleCount.value = Math.ceil(containerHeight.value / itemHeight.value) + bufferSize.value
    }
  })
}

// 載入儲存的設定
onMounted(() => {
  // 載入可見欄位設定
  const savedVisibleColumns = localStorage.getItem('currentStudentListVisibleColumns')
  if (savedVisibleColumns) {
    try {
      visibleColumnIds.value = JSON.parse(savedVisibleColumns)
    } catch (e) {
      console.warn('無法載入儲存的欄位設定:', e)
    }
  }
  
  // 載入欄位順序設定
  const savedColumnOrder = localStorage.getItem('currentStudentListColumnOrder')
  if (savedColumnOrder) {
    try {
      columnOrder.value = JSON.parse(savedColumnOrder)
    } catch (e) {
      console.warn('無法載入儲存的欄位順序:', e)
    }
  }
  
  // 初始化虛擬滾動
  initVirtualScroll()
})

</script>

<style scoped>
.table-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 600px;
  position: relative;
}

.tanstack-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.tanstack-table th,
.tanstack-table td {
  border-bottom: 1px solid #ebeef5;
  border-right: 1px solid #ebeef5;
  padding: 12px 8px;
  text-align: left;
  height: 50px; /* 固定行高，配合虛擬滾動 */
  box-sizing: border-box;
}

.tanstack-table th {
  background-color: #fafafa;
  font-weight: 600;
  user-select: none;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tanstack-table th.sortable {
  cursor: pointer;
}

.tanstack-table th.sortable:hover {
  background-color: #f0f9ff;
}

.tanstack-table th.draggable-header {
  cursor: grab;
}

.tanstack-table th.draggable-header:active {
  cursor: grabbing;
}

.tanstack-table th.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
}

.tanstack-table th.pinned-left,
.tanstack-table td.pinned-left {
  position: sticky;
  left: 0;
  background-color: white;
  z-index: 2;
  border-right: 2px solid #dcdfe6;
}

.tanstack-table th.pinned-left {
  background-color: #fafafa;
  z-index: 12;
}

.tanstack-table th.pinned-column {
  cursor: not-allowed !important;
}

.sort-indicator {
  margin-left: 4px;
  font-size: 12px;
  color: #409eff;
}

.tanstack-table tbody tr:hover {
  background-color: #f5f7fa;
}

.cross-year-row {
  background-color: #fef0f0;
}

.cross-year-row:hover {
  background-color: #fde2e2;
}

.skeleton-row {
  background-color: #fafafa;
}

.skeleton-row:hover {
  background-color: #f0f0f0;
}

.column-settings {
  padding: 20px 0;
  max-height: 400px;
  overflow-y: auto;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  margin: 0 -16px -16px -16px;
}

:deep(.el-transfer) {
  text-align: center;
}

:deep(.el-transfer-panel) {
  width: 45%;
}
</style>