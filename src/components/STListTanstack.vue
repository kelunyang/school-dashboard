<template>
  <div v-loading="loading">

    <!-- 表格區域 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分科測驗成績列表（{{ rawData.length }} 筆）</span>
          <div class="header-actions">
            <el-button @click="showColumnSettings">
              <el-icon><Setting /></el-icon>
              選取顯示的欄位
            </el-button>
            <el-button 
              type="primary" 
              @click="generateReport"
              :loading="downloading"
            >
              <el-icon><Download /></el-icon>
              輸出名單
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 虛擬滾動表格容器 -->
      <div 
        class="table-container" 
        ref="tableContainer"
        @scroll="handleScroll"
      >
        <table class="tanstack-table">
          <thead>
            <tr>
              <th class="pinned-left draggable-header">跨功能</th>
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
                class="draggable-header sorting"
                :class="{ 
                  'pinned-column': isFixedColumn(key),
                  'dragging': draggedColumn === key
                }"
              >
                {{ getColumnLabel(key) }}
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
              :key="item._isSkeleton ? `skeleton-${virtualStart + index}` : (item.idNumber || virtualStart + index)"
              :class="{ 
                'cross-year-row': item._isCrossYear && !item._isSkeleton,
                'skeleton-row': item._isSkeleton,
                'selected': !item._isSkeleton && isStudentSelected(item)
              }"
            >
              <!-- 跨功能選擇 -->
              <td class="pinned-left">
                <el-skeleton-item 
                  v-if="item._isSkeleton" 
                  variant="button" 
                  style="width: 24px; height: 24px;" 
                />
                <el-checkbox
                  v-else
                  :model-value="isCrossFunctionalSelected(getStudentUID(item, 'stScore'))"
                  @update:model-value="(value) => handleCrossFunctionalChange(item, value)"
                />
              </td>
              
              <!-- 其他欄位 -->
              <td v-for="key in orderedVisibleColumnKeys" :key="key">
                <template v-if="item._isSkeleton">
                  <el-skeleton-item variant="text" />
                </template>
                <template v-else>
                  <template v-if="getColumnConfig(key).isScore && item[key] !== null && item[key] !== undefined">
                    <el-tag :type="getScoreType(item[key])" size="small">{{ item[key] }}</el-tag>
                  </template>
                  <template v-else-if="key === 'class'">
                    {{ item.registrationNumber ? String(item.registrationNumber).substring(3, 6) : '-' }}
                  </template>
                  <template v-else-if="key === 'examYear'">
                    <span 
                      :style="item._isCrossYear ? 'font-weight: bold; color: #E6A23C;' : ''"
                    >
                      {{ item[key] || '-' }}
                    </span>
                  </template>
                  <template v-else-if="key === 'idNumber'">
                    <span 
                      :style="'font-family: monospace;' + (item._isCrossYear ? ' font-weight: bold; color: #E6A23C;' : '')"
                    >
                      {{ item[key] || '-' }}
                    </span>
                  </template>
                  <template v-else>
                    {{ item[key] || '-' }}
                  </template>
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
    </el-card>

    <!-- 列設定抽屜 -->
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
import { ref, onMounted, computed, watch, inject, nextTick } from 'vue'
import { getStudentUID } from '../utils/uidFactory'
import { ElMessage, ElCheckbox, ElTag, ElSkeletonItem } from 'element-plus'
import { Setting, Download } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'

const props = defineProps({
  selectedYear: {
    type: [String, Number],
    default: 'all'
  },
  students: {
    type: Array,
    default: null
  }
})

const emit = defineEmits(['filter-change'])

// Inject lockedStudents for cross-functional queries
const lockedStudents = inject('lockedStudents', ref([]))
const selectedStudents = inject('selectedStudents', ref(new Map()))
const handleStudentSelection = inject('handleStudentSelection', () => {})

// 新的跨功能查詢 UID 系統
const crossFunctionalUIDs = inject('crossFunctionalUIDs', ref([]))
const addToCrossFunctionalUIDs = inject('addToCrossFunctionalUIDs', () => {})
const removeFromCrossFunctionalUIDs = inject('removeFromCrossFunctionalUIDs', () => {})
const isCrossFunctionalSelected = inject('isCrossFunctionalSelected', () => false)

// 載入狀態
const loading = ref(false)
const downloading = ref(false)

// 虛擬滾動相關
const tableContainer = ref(null)
const itemHeight = ref(50) // 每行的高度
const containerHeight = ref(600) // 容器高度
const virtualStart = ref(0) // 虛擬滾動開始索引
const visibleCount = ref(20) // 可見行數
const bufferSize = ref(5) // 緩衝區大小

// 資料
const rawData = ref([])
const allColumns = ref([])
const visibleColumnIds = ref([])
const availableExamYears = ref([])
const benchmarks = ref({})
const backendHeaders = ref([])

// 排序設定
const sortConfig = ref({ key: 'examYear', order: 'desc' })

// 列設定對話框
const columnSettingsVisible = ref(false)
const tempVisibleColumnIds = ref([])

// 拖曳相關
const draggedColumn = ref(null)
const columnOrder = ref([])

// 列顯示名稱映射
const columnDisplayNames = {
  'checkbox': '選擇',
  'registrationNumber': '報名序號',
  'name': '姓名',
  'idNumber': '身分證號（加密）',
  '原始身分證字號': '原始身分證字號',
  'examNumber': '應試號碼',
  'examYear': '考試年分',
  'class': '班級'
}

// 獲取欄位標籤
const getColumnLabel = (key) => {
  if (columnDisplayNames[key]) {
    return columnDisplayNames[key]
  }
  return key
}

// 獲取分數類型
const getScoreType = (score) => {
  if (score >= 50) return 'success'
  if (score >= 40) return 'primary'  
  if (score >= 30) return 'warning'
  if (score >= 20) return 'info'
  return 'danger'
}

// 基本欄位配置
const columnConfigs = {
  'checkbox': { width: 60, enableHiding: false, enableSorting: false },
  'registrationNumber': { width: 120, enableHiding: false },
  'name': { width: 100, enableHiding: false },
  'idNumber': { width: 280 },
  'examNumber': { width: 120 },
  'examYear': { width: 100, align: 'center' },
  'class': { width: 80, align: 'center' }
}

// 動態判斷欄位配置
const getColumnConfig = (key) => {
  if (columnConfigs[key]) {
    return columnConfigs[key]
  }
  
  if (key.includes('級分')) {
    return { 
      width: key.includes('公民與社會') ? 130 : 110, 
      align: 'center', 
      isScore: true 
    }
  }
  
  return { width: 120 }
}

// 獲取欄位寬度
const getColumnWidth = (key) => {
  return getColumnConfig(key).width || 120
}

// 判斷是否為固定欄位
const isFixedColumn = (key) => {
  return ['examYear', 'idNumber'].includes(key)
}

// 所有欄位（從資料動態提取）
const allColumnKeys = computed(() => {
  const realStudents = rawData.value.filter(s => !s._isSkeleton)
  if (!realStudents.length) return []
  
  let completeHeaders = []
  if (backendHeaders.value && backendHeaders.value.length > 0) {
    completeHeaders = backendHeaders.value
  } else {
    const allHeaders = new Set()
    realStudents.forEach(student => {
      Object.keys(student).forEach(key => allHeaders.add(key))
    })
    completeHeaders = Array.from(allHeaders)
  }
  
  return completeHeaders.filter(key => {
    // 排除敏感和無用的欄位
    if (['hasGeoInfo', 'lng', 'lat', 'coordinates'].includes(key)) return false
    return true
  })
})

// 可見欄位
const visibleColumnKeys = computed(() => {
  if (visibleColumnIds.value.length === 0) {
    // 預設顯示：基本欄位 + 所有級分欄位
    const defaultColumns = ['examYear', 'idNumber', 'registrationNumber', 'name', 'examNumber']
    allColumnKeys.value.forEach(key => {
      if (key.includes('級分')) {
        defaultColumns.push(key)
      }
    })
    return defaultColumns.filter(key => allColumnKeys.value.includes(key))
  }
  
  // 確保固定欄位始終顯示
  const fixedColumns = ['examYear', 'idNumber']
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
  
  const ordered = []
  columnOrder.value.forEach(key => {
    if (visible.includes(key)) {
      ordered.push(key)
    }
  })
  
  visible.forEach(key => {
    if (!ordered.includes(key)) {
      ordered.push(key)
    }
  })
  
  return ordered
})

// 排序處理
const sortedData = computed(() => {
  if (!sortConfig.value.key) return rawData.value
  
  const key = sortConfig.value.key
  const order = sortConfig.value.order
  
  return [...rawData.value].sort((a, b) => {
    let valueA = a[key]
    let valueB = b[key]
    
    if (valueA == null) valueA = ''
    if (valueB == null) valueB = ''
    
    const numA = Number(valueA)
    const numB = Number(valueB)
    
    if (!isNaN(numA) && !isNaN(numB)) {
      return order === 'asc' ? numA - numB : numB - numA
    }
    
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
      items.push(sortedData.value[i])
    } else {
      if (loading.value && sortedData.value.length === 0) {
        items.push({
          id: `skeleton-${i}`,
          _isSkeleton: true
        })
      }
    }
  }
  
  // 如果正在loading且有數據，在滾動到底部時顯示skeleton
  if (loading.value && sortedData.value.length > 0 && start + visibleCount.value >= sortedData.value.length - bufferSize.value) {
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
  
  const bufferStart = Math.max(0, newStart - bufferSize.value)
  
  if (Math.abs(virtualStart.value - bufferStart) > bufferSize.value) {
    virtualStart.value = bufferStart
  }
}

// 排序處理
const handleSort = (key) => {
  if (sortConfig.value.key === key) {
    sortConfig.value.order = sortConfig.value.order === 'asc' ? 'desc' : 'asc'
  } else {
    sortConfig.value.key = key
    sortConfig.value.order = 'asc'
  }
}

// 跨功能選擇處理
const handleCrossFunctionalChange = (student, checked) => {
  const uid = getStudentUID(student, 'stScore')
  if (!uid) return
  
  if (checked) {
    addToCrossFunctionalUIDs(uid, 'stScore')
  } else {
    removeFromCrossFunctionalUIDs(uid)
  }
}

// 學生選擇狀態
const isStudentSelected = (student) => {
  return selectedStudents.value.has(student.idNumber)
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
    
    localStorage.setItem('stListTanstackColumnOrder', JSON.stringify(columnOrder.value))
  }
}

// Transfer 元件的資料
const transferData = computed(() => {
  return allColumnKeys.value
    .filter(key => !['examYear', 'idNumber'].includes(key)) // 排除固定欄位
    .map(key => ({
      key,
      label: getColumnLabel(key),
      disabled: false
    }))
})

// 顯示列設定
const showColumnSettings = () => {
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = true
}

// 應用列設定
const applyColumnSettings = () => {
  visibleColumnIds.value = [...tempVisibleColumnIds.value]
  columnSettingsVisible.value = false
  
  localStorage.setItem('stListTanstackVisibleColumns', JSON.stringify(visibleColumnIds.value))
}

const handleTransferChange = () => {
  // el-transfer 的 v-model 會自動更新 tempVisibleColumnIds
}

const cancelColumnSettings = () => {
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = false
}

// 載入資料
const loadData = async () => {
  loading.value = true
  try {
    if (props.students !== null) {
      rawData.value = props.students
      initializeColumns()
      return
    }
    
    let result
    
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      result = await apiService.getCrossFunctionalSTScores(lockedStudents.value)
    } else {
      result = await apiService.getSTScores(props.selectedYear)
    }
    
    if (result.success) {
      rawData.value = result.students || []
      benchmarks.value = result.benchmarks || {}
      backendHeaders.value = result.headers || []
      
      if (result.students && result.students.length > 0) {
        const examYears = [...new Set(result.students.map(s => s.examYear).filter(Boolean))]
        availableExamYears.value = examYears.sort((a, b) => b - a)
      }
      
      if (result.students && result.students.length > 0) {
        initializeColumns()
      }
    } else {
      ElMessage.error('載入分科測驗成績失敗：' + result.error)
    }
  } catch (error) {
    ElMessage.error('載入分科測驗成績失敗')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 初始化列配置
const initializeColumns = () => {
  const savedVisible = localStorage.getItem('stListTanstackVisibleColumns')
  if (savedVisible) {
    try {
      visibleColumnIds.value = JSON.parse(savedVisible)
    } catch (e) {
      console.warn('無法載入儲存的欄位設定:', e)
    }
  }
  
  const savedOrder = localStorage.getItem('stListTanstackColumnOrder')
  if (savedOrder) {
    try {
      columnOrder.value = JSON.parse(savedOrder)
    } catch (e) {
      console.warn('無法載入儲存的欄位順序:', e)
    }
  }
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

// 輸出名單功能
const generateReport = async () => {
  downloading.value = true
  
  try {
    const filters = {
      selectedYear: props.selectedYear,
      reportType: 'stScore'
    }
    
    const result = await apiService.generateSTScoreReport(filters)
    
    if (result.success) {
      ElMessage.success(`已生成報表：${result.fileName}`)
      if (result.shareUrl) {
        window.open(result.shareUrl, '_blank')
      }
    } else {
      ElMessage.error('生成報表失敗：' + result.error)
    }
  } catch (error) {
    console.error('生成報表錯誤:', error)
    ElMessage.error('生成報表失敗')
  } finally {
    downloading.value = false
  }
}

// 監聽變化
watch(() => props.students, () => {
  if (props.students !== null) {
    loadData()
  }
}, { deep: true })

watch(lockedStudents, () => {
  if (props.students === null) {
    loadData()
  }
}, { deep: true })

watch(() => props.selectedYear, () => {
  if (props.students === null && (!lockedStudents.value || lockedStudents.value.length === 0)) {
    loadData()
  }
})

onMounted(() => {
  loadData()
  initVirtualScroll()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 40px;
  flex-wrap: nowrap;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
  align-items: center;
}

.card-header > span {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table-container {
  width: 100%;
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
  border: 1px solid #CCC;
  padding: 8px 12px;
  text-align: left;
  height: 50px;
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

.tanstack-table th.draggable-header {
  cursor: grab;
  transition: background-color 0.2s ease;
}

.tanstack-table th.draggable-header:active {
  cursor: grabbing;
}

.tanstack-table th.draggable-header.dragging {
  opacity: 0.5;
  background-color: #e6f7ff !important;
  cursor: grabbing !important;
}

.tanstack-table th.draggable-header:not(.pinned-left):hover {
  background-color: #f0f9ff;
  cursor: grab;
}

.tanstack-table th.pinned-left.draggable-header {
  cursor: not-allowed !important;
}

.tanstack-table th.draggable-header:not(.pinned-left)::before {
  content: "⋮⋮";
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tanstack-table th.draggable-header:not(.pinned-left):hover::before {
  opacity: 1;
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

.tanstack-table th.sorting {
  cursor: pointer;
}

.tanstack-table tbody tr:hover {
  background-color: #f5f7fa;
}

.tanstack-table tbody tr.selected {
  background-color: #ecf5ff;
}

.tanstack-table tbody tr.cross-year-row {
  background-color: #fef0f0 !important;
}

.tanstack-table tbody tr.cross-year-row:hover {
  background-color: #fde2e2 !important;
}

.skeleton-row {
  background-color: #fafafa;
}

.skeleton-row:hover {
  background-color: #f0f0f0;
}

.column-settings {
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
</style>