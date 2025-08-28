<template>
  <div v-loading="props.loading">
    <!-- 過濾器區域 -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>學生列表過濾器</span>
          <div class="filter-header-actions">
            <el-button 
              type="warning" 
              @click="toggleCrossFunctionalFilter"
              size="small"
              style="margin-right: 10px;"
              :disabled="crossFunctionalUIDs.length === 0"
            >
              {{ crossFunctionalFilterActive ? '顯示全部' : `跨功能篩選 (${crossFunctionalUIDs.length})` }}
            </el-button>
            <el-button 
              type="danger" 
              @click="clearAllFilters"
              size="small"
              style="margin-right: 10px;"
            >
              清除過濾器
            </el-button>
            <el-button 
              type="primary" 
              @click="showAdvancedFilter"
              :icon="Search"
              size="small"
            >
              多重條件搜尋器
            </el-button>
          </div>
        </div>
      </template>
      
      <el-row :gutter="20" style="margin-bottom: 15px;">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>錄取管道：</label>
            <el-select 
              v-model="selectedChannel" 
              placeholder="全部"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="channel in availableChannels"
                :key="channel"
                :label="channel"
                :value="channel"
              />
            </el-select>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>學生身分別：</label>
            <el-select 
              v-model="selectedStudentType" 
              placeholder="全部"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="type in availableStudentTypes"
                :key="type"
                :label="type"
                :value="type"
              />
            </el-select>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>錄取身分別：</label>
            <el-select 
              v-model="selectedAdmissionType" 
              placeholder="全部"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="type in availableAdmissionTypes"
                :key="type"
                :label="type"
                :value="type"
              />
            </el-select>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>班級：</label>
            <el-select 
              v-model="selectedClass" 
              placeholder="全部"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="cls in availableClasses"
                :key="cls"
                :label="cls"
                :value="cls"
              />
            </el-select>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 表格區域 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>學生列表（{{ filteredData.length }} 筆）</span>
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
      
      <div class="table-container" ref="tableContainer" v-if="!props.loading">
        <div class="virtual-scroll-container" @scroll="handleScroll" ref="scrollContainer">
          <div class="virtual-content" :style="{ height: virtualHeight + 'px' }">
            <table class="tanstack-table" :style="{ transform: `translateY(${offsetY}px)` }">
          <thead>
            <tr
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
            >
              <th
                v-for="header in headerGroup.headers"
                :key="header.id"
                :colSpan="header.colSpan"
                :style="{
                  width: header.getSize() + 'px',
                  position: 'relative'
                }"
                :draggable="!header.column.getIsPinned()"
                @dragstart="handleDragStart($event, header)"
                @dragend="handleDragEnd"
                @dragover="handleDragOver($event)"
                @drop="handleDrop($event, header)"
                class="draggable-header"
                :class="{
                  'pinned-left': header.column.getIsPinned() === 'left',
                  'sorting': header.column.getCanSort()
                }"
              >
                <div
                  v-if="!header.isPlaceholder"
                  :class="{
                    'cursor-pointer': header.column.getCanSort(),
                  }"
                  @click="header.column.getToggleSortingHandler()?.($event)"
                  class="header-content"
                >
                  <FlexRender
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <span v-if="header.column.getCanSort()" class="sort-indicator">
                    {{ header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : '↕' }}
                  </span>
                </div>
                
                <!-- 列寬調整把手 -->
                <div
                  v-if="header.column.getCanResize()"
                  @mousedown="header.getResizeHandler()?.($event)"
                  @touchstart="header.getResizeHandler()?.($event)"
                  class="resizer"
                  :class="{
                    'isResizing': header.column.getIsResizing()
                  }"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleRows"
              :key="row.id"
              :class="{ 
                'selected': row.getIsSelected(),
                'cross-year-row': row.original._isCrossYear
              }"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                :style="{
                  width: cell.column.getSize() + 'px'
                }"
                :class="{
                  'pinned-left': cell.column.getIsPinned() === 'left'
                }"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- 骨架屏加载状态 -->
      <div v-if="props.loading" class="skeleton-container">
        <el-skeleton :rows="10" animated />
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
        <el-alert
          title="注意：「跨功能」欄位永遠顯示，無法隱藏"
          type="info"
          :closable="false"
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

    <!-- 多重條件搜尋器抽屜 -->
    <el-drawer
      v-model="advancedFilterVisible"
      title="多重條件搜尋器"
      direction="ttb"
      size="80%"
      :close-on-click-modal="false"
    >
      <!-- 載入舊篩選器提示 -->
      <el-alert
        v-if="showLoadOldFiltersAlert"
        title="偵測到已儲存的篩選條件"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <p>發現已儲存的篩選條件，是否要載入？</p>
          <div style="margin-top: 10px;">
            <el-button size="small" type="primary" @click="loadOldFilters">載入舊條件</el-button>
            <el-button size="small" @click="dismissLoadAlert">忽略</el-button>
          </div>
        </template>
      </el-alert>

      <div class="filter-info">
        <el-alert 
          type="info" 
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <strong>篩選邏輯說明：</strong> 多個條件會依序進行 AND 篩選，即每個條件都必須滿足。每個條件內的多行正規表達式則是 OR 關係（任一匹配即可）。
          </template>
        </el-alert>
      </div>

      <div class="advanced-filter-container">
        <div 
          v-for="(condition, index) in advancedConditions" 
          :key="condition.id"
          class="filter-condition-row"
        >
          <div class="condition-left">
            <h4>條件 {{ index + 1 }} <span v-if="index > 0" class="and-label">AND</span></h4>
            <div class="field-selector">
              <label>選擇欄位：</label>
              <el-select 
                v-model="condition.field" 
                placeholder="請選擇欄位"
                style="width: 200px;"
                @change="onFieldChange(condition)"
              >
                <el-option
                  v-for="field in availableFields"
                  :key="field.value"
                  :label="field.label"
                  :value="field.value"
                />
              </el-select>
            </div>
          </div>
          
          <div class="condition-right">
            <div class="regex-input">
              <label>正規表達式 (一行一個模式，行間為 OR 關係)：</label>
              <el-input
                v-model="condition.patterns"
                type="textarea"
                :rows="6"
                placeholder="例如：&#10;^張.*&#10;.*明$&#10;李[A-Za-z]*"
                style="width: 100%;"
              />
              <div class="pattern-help">
                <small>
                  <strong>範例：</strong><br>
                  ^張.* (姓張開頭)<br>
                  .*明$ (名字以明結尾)<br>
                  李[A-Za-z]* (姓李且後面可含英文)
                </small>
              </div>
            </div>
          </div>
          
          <div class="condition-actions">
            <el-button
              type="danger"
              :icon="Delete"
              circle
              size="small"
              @click="removeCondition(index)"
              :disabled="advancedConditions.length === 1"
            />
          </div>
        </div>
        
        <div class="add-condition">
          <el-button 
            type="success" 
            :icon="Plus" 
            @click="addCondition"
            style="width: 100%;"
          >
            新增篩選條件 (AND)
          </el-button>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <el-button @click="cancelAdvancedFilter">取消</el-button>
          <el-button @click="clearAdvancedFilters">清除所有條件</el-button>
          <el-button type="primary" @click="applyAdvancedFilter">套用篩選</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject, shallowRef, h, nextTick } from 'vue'
import { getStudentUID } from '../utils/uidFactory'
import { ElMessage, ElCheckbox } from 'element-plus'
import { Setting, Download, Search, Plus, Delete } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'
import { optimizedApiService } from '../services/optimizedApiService'
// 翻譯系統已移除
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
  FlexRender
} from '@tanstack/vue-table'

const props = defineProps({
  selectedYears: {
    type: Array,
    default: () => []
  },
  studentData: {
    type: Array,
    default: () => []
  },
  filteredData: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['filter-change'])

// Inject for cross-functional queries
const lockedStudents = inject('lockedStudents', ref([]))
const selectedStudents = inject('selectedStudents', ref(new Map()))
const handleStudentSelection = inject('handleStudentSelection', () => {})
// 新的 UID 系統
const crossFunctionalUIDs = inject('crossFunctionalUIDs', ref([]))
const addToCrossFunctionalUIDs = inject('addToCrossFunctionalUIDs', () => {})
const removeFromCrossFunctionalUIDs = inject('removeFromCrossFunctionalUIDs', () => {})
const isCrossFunctionalSelected = inject('isCrossFunctionalSelected', () => false)

// 載入狀態
// loading 狀態由父組件傳入
const downloading = ref(false)

// 資料
const rawData = ref([])
const allColumns = ref([])
const visibleColumnIds = ref([])

// 過濾器狀態
const selectedChannel = ref('')
const selectedStudentType = ref('')
const selectedAdmissionType = ref('')
const selectedClass = ref('')
const crossFunctionalFilterActive = ref(false)

// 可用選項
const availableChannels = ref([])
const availableStudentTypes = ref([])
const availableAdmissionTypes = ref([])
const availableClasses = ref([])

// 虚拟滚动
const itemHeight = 40 // 每行高度
const visibleCount = ref(20) // 可见行数
const scrollTop = ref(0)
const offsetY = ref(0)
const virtualHeight = ref(0)
const scrollContainer = ref(null)

// 列設定對話框
const columnSettingsVisible = ref(false)
const tempVisibleColumnIds = ref([]) // 暫存的可見列ID，用於 transfer 組件

// 多重條件搜尋器
const advancedFilterVisible = ref(false)
const showLoadOldFiltersAlert = ref(false)
const advancedConditions = ref([])
let conditionIdCounter = 1

// 拖曳狀態
const draggedColumn = ref(null)
const tableContainer = ref(null)

// 排序狀態
// 排序狀態 - 預設按入學年分降序排列（最新的在前面）
const sorting = ref([{ id: '入學年分', desc: true }])

// 列順序
const columnOrder = ref([])

// 特殊欄位的中文顯示名稱（不在翻譯服務中的特殊欄位）
const specialColumnNames = ref({
  'checkbox': '選擇',
  'crossFunctionalCheckbox': '跨功能',
  'idNumber': '身分證號（加密）'
})

// 獲取欄位顯示名稱
const getColumnDisplayName = (columnId) => {
  // 如果是特殊欄位，使用特殊名稱
  if (specialColumnNames.value[columnId]) {
    return specialColumnNames.value[columnId]
  }
  
  // 對於中文欄位名稱，直接返回
  return columnId
}

// Transfer 組件所需的數據
const transferData = computed(() => {
  return allColumns.value
    .filter(col => col.id !== 'crossFunctionalCheckbox') // 排除跨功能查詢欄位
    .map(col => ({
      key: col.id,
      label: col.header,
      disabled: col.enableHiding === false
    }))
})

// 多重條件搜尋器可用欄位
const availableFields = computed(() => {
  if (!rawData.value.length) return []
  
  const sampleRecord = rawData.value[0]
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
      label: getColumnDisplayName(key)
    }))
})

// 基本欄位配置（使用中文欄位名稱）
const columnConfigs = {
  'checkbox': { width: 60, enableHiding: false, enableSorting: false },
  '身分證統一編號': { width: 150, enableHiding: false },
  '姓名': { width: 100 },
  '性別': { width: 80 },
  '班級': { width: 100 },
  '座號': { width: 80 },
  '學號': { width: 120 },
  '會考總積分': { width: 120 },
  '錄取管道': { width: 150 },
  '畢業國中名稱': { width: 200 },
  '畢業國中代碼': { width: 120 },
  '學生身分別': { width: 120 },
  '錄取身分別': { width: 120 },
  '入學年分': { width: 100 },
  '地址': { width: 250 },
  '電話': { width: 120 }
}

// 直接使用父組件傳入的已過濾資料，並套用多重條件篩選
const filteredData = computed(() => {
  // 使用父組件傳入的已過濾資料來顯示在表格中
  let data = props.filteredData || []
  console.log('🎯 StudentListTanstack: 使用父組件已過濾資料，筆數:', data.length)
  
  // 套用多重條件篩選
  if (advancedConditions.value.length > 0) {
    data = applyAdvancedFilters(data)
    console.log('🎯 StudentListTanstack: 套用多重條件後，筆數:', data.length)
  }
  
  return data
})

// 建立列定義
const columns = computed(() => {
  if (!rawData.value.length) {
    console.log('📋 columns: rawData 是空的，回傳空陣列')
    return []
  }
  
  const columnHelper = createColumnHelper()
  const cols = []
  
  // 跨功能查詢選擇框列 - 永遠顯示且不可隱藏，放在第一欄且固定
  cols.push(
    columnHelper.display({
      id: 'crossFunctionalCheckbox',
      header: () => '跨功能',
      cell: ({ row }) => {
        const student = row.original
        const uid = getStudentUID(student, 'newbie')
        if (!uid) return ''
        
        return h(ElCheckbox, {
          modelValue: isCrossFunctionalSelected(uid),
          'onUpdate:modelValue': (value) => {
            if (value) {
              addToCrossFunctionalUIDs(uid, 'newbie')
            } else {
              removeFromCrossFunctionalUIDs(uid)
            }
          }
        })
      },
      size: 80,
      enableHiding: false,
      enableSorting: false,
      meta: {
        pinned: 'left'
      }
    })
  )
  
  // 動態生成資料列
  const sampleRecord = rawData.value[0]
  Object.keys(sampleRecord).forEach(key => {
    // 排除敏感和無用的欄位（使用中文欄位名）
    if (key === 'uid') return
    if (key === '住址經度') return
    if (key === '住址緯度') return
    if (key === '經度') return
    if (key === '緯度') return
    
    const config = columnConfigs[key] || {}
    
    cols.push(
      columnHelper.accessor(key, {
        id: key,
        header: ({ column }) => {
          return getColumnDisplayName(key)
        },
        cell: info => info.getValue(),
        size: config.width || 120,
        enableHiding: config.enableHiding !== false,
        enableSorting: config.enableSorting !== false
      })
    )
  })
  
  return cols
})

// 跨功能查詢過濾後的數據
const crossFunctionalFilteredData = computed(() => {
  if (!crossFunctionalFilterActive.value || crossFunctionalUIDs.value.length === 0) {
    return props.filteredData
  }
  
  // 根據跨功能查詢 UIDs 過濾數據
  return props.filteredData.filter(student => {
    const uid = getStudentUID(student, 'newbie')
    return uid && crossFunctionalUIDs.value.some(item => item.uid === uid)
  })
})

// 建立表格實例
const table = computed(() => {
  return useVueTable({
    data: crossFunctionalFilteredData.value,
    columns: columns.value,
    state: {
      sorting: sorting.value,
      columnOrder: columnOrder.value,
      columnPinning: {
        left: ['crossFunctionalCheckbox'],
        right: []
      },
      columnVisibility: (() => {
        const visibility = {}
        // 確保所有列都有明確的可見性狀態
        columns.value.forEach(col => {
          // 跨功能查詢欄位永遠顯示
          if (col.id === 'crossFunctionalCheckbox') {
            visibility[col.id] = true
          } else {
            visibility[col.id] = visibleColumnIds.value.includes(col.id)
          }
        })
        console.log('📊 StudentListTanstack - 設置的 columnVisibility:', visibility)
        return visibility
      })()
    },
    onSortingChange: updater => {
      sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
    },
    onColumnOrderChange: updater => {
      columnOrder.value = typeof updater === 'function' ? updater(columnOrder.value) : updater
      saveColumnOrder()
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableRowSelection: true,
    enableHiding: true,
    getColumnCanHide: (column) => {
      const config = columnConfigs[column.id]
      return config ? config.enableHiding !== false : true
    }
  })
})

// 虚拟滚动处理
const startIndex = ref(0)
const endIndex = ref(20)

const handleScroll = (e) => {
  scrollTop.value = e.target.scrollTop
  updateVisibleRange()
}

const updateVisibleRange = () => {
  startIndex.value = Math.floor(scrollTop.value / itemHeight)
  endIndex.value = Math.min(startIndex.value + visibleCount.value, crossFunctionalFilteredData.value.length)
  
  offsetY.value = startIndex.value * itemHeight
}

// 获取可见的表格行
const visibleRows = computed(() => {
  const allRows = table.value.getRowModel().rows
  return allRows.slice(startIndex.value, endIndex.value)
})

// 计算虚拟高度
const updateVirtualHeight = () => {
  virtualHeight.value = crossFunctionalFilteredData.value.length * itemHeight
}

// 初始化虚拟滚动
const initVirtualScroll = () => {
  if (scrollContainer.value) {
    const containerHeight = scrollContainer.value.clientHeight
    visibleCount.value = Math.ceil(containerHeight / itemHeight) + 5 // 额外渲染几行
  }
  updateVirtualHeight()
  updateVisibleRange()
}

// 顯示列設定
const showColumnSettings = () => {
  // 確保 visibleColumnIds 與當前表格狀態同步
  if (table.value) {
    const currentVisibility = table.value.getState().columnVisibility
    console.log('🔧 當前列可見性狀態:', currentVisibility)
    
    // 更新 visibleColumnIds 以反映實際狀態
    visibleColumnIds.value = columns.value
      .filter(col => currentVisibility[col.id] !== false)
      .map(col => col.id)
    
    console.log('🔧 同步後的 visibleColumnIds:', visibleColumnIds.value)
  }
  
  // 設定 transfer 的初始值
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  console.log('🔧 Transfer 初始值:', tempVisibleColumnIds.value)
  
  columnSettingsVisible.value = true
}

// 應用列設定
const applyColumnSettings = () => {
  // 將 transfer 的結果應用到 visibleColumnIds
  visibleColumnIds.value = [...tempVisibleColumnIds.value]
  
  console.log('🔧 應用欄位設定:', visibleColumnIds.value)
  console.log('🔧 所有可用欄位:', allColumns.value.map(c => c.id))
  
  // 保存設定並關閉對話框
  saveVisibleColumns()
  columnSettingsVisible.value = false
  
  console.log('🔧 表格更新完成')
}

// Transfer 變更處理
const handleTransferChange = (value, direction, movedKeys) => {
  console.log('🔧 Transfer 變更:', { value, direction, movedKeys })
}

// 取消列設定
const cancelColumnSettings = () => {
  // 重置 tempVisibleColumnIds
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = false
}

// 拖曳處理
const handleDragStart = (e, header) => {
  if (header.column.getIsPinned()) return
  
  draggedColumn.value = header.column
  e.dataTransfer.effectAllowed = 'move'
  e.target.classList.add('dragging')
}

const handleDragEnd = (e) => {
  e.target.classList.remove('dragging')
  draggedColumn.value = null
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

const handleDrop = (e, header) => {
  e.preventDefault()
  
  if (!draggedColumn.value || header.column.getIsPinned()) return
  
  const draggedColumnId = draggedColumn.value.id
  const targetColumnId = header.column.id
  
  if (draggedColumnId === targetColumnId) return
  
  const newOrder = [...table.value.getState().columnOrder]
  const draggedIndex = newOrder.indexOf(draggedColumnId)
  const targetIndex = newOrder.indexOf(targetColumnId)
  
  newOrder.splice(draggedIndex, 1)
  newOrder.splice(targetIndex, 0, draggedColumnId)
  
  table.value.setColumnOrder(newOrder)
}

// 載入保存的列順序
const loadColumnOrder = () => {
  const saved = localStorage.getItem('studentListTanstackColumnOrder')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      return null
    }
  }
  return null
}

// 保存列順序
const saveColumnOrder = () => {
  localStorage.setItem('studentListTanstackColumnOrder', JSON.stringify(columnOrder.value))
}

// 載入保存的可見列
const loadVisibleColumns = () => {
  const saved = localStorage.getItem('studentListTanstackVisibleColumns')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      return null
    }
  }
  return null
}

// 保存可見列
const saveVisibleColumns = () => {
  localStorage.setItem('studentListTanstackVisibleColumns', JSON.stringify(visibleColumnIds.value))
}

// 使用傳入的學生資料，不再自己載入
const loadData = () => {
  try {
    // 跨功能查詢的情況下，資料由上層組件處理
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      console.log('🔍 StudentList: 跨功能查詢模式，等待上層組件資料')
      return
    }
    
    // 使用完整的學生資料來建立過濾器選項
    const fullData = props.studentData || []
    const displayData = props.filteredData || []
    rawData.value = fullData  // 用於建立列定義
    console.log(`✅ StudentList: 接收完整資料 ${fullData.length} 筆，顯示資料 ${displayData.length} 筆`)
    
    // 調試：檢查資料結構
    if (fullData.length > 0) {
      console.log('📋 StudentList: 第一筆資料的欄位:', Object.keys(fullData[0]))
      console.log('📋 StudentList: 第一筆資料範例:', fullData[0])
    }
    
    // 從完整資料中提取過濾器選項（這樣才能獲得所有可能的選項）
    const channels = [...new Set(fullData.map(item => item['錄取管道']).filter(Boolean))]
    const studentTypes = [...new Set(fullData.map(item => item['學生身分別']).filter(Boolean))]
    const admissionTypes = [...new Set(fullData.map(item => item['錄取身分別']).filter(Boolean))]
    const classes = [...new Set(fullData.map(item => item['班級']).filter(Boolean))]
    
    availableChannels.value = channels
    availableStudentTypes.value = studentTypes
    availableAdmissionTypes.value = admissionTypes
    availableClasses.value = classes
    
    // 初始化列配置
    if (fullData.length > 0) {
      // 設定所有列
      allColumns.value = columns.value.map(col => ({
        id: col.id,
        header: getColumnDisplayName(col.id),
        enableHiding: col.enableHiding !== false
      }))
      
      console.log('📋 設定 allColumns:', allColumns.value)
      console.log('📋 初始 visibleColumnIds:', visibleColumnIds.value)
      
      // 載入保存的可見列
      const savedVisible = loadVisibleColumns()
      
      // 確保保存的列ID仍然存在於當前的列中
      const currentColumnIds = columns.value.map(col => col.id)
      
      if (savedVisible && savedVisible.length > 0) {
        // 過濾掉不存在的列ID
        const filteredVisible = savedVisible.filter(id => currentColumnIds.includes(id))
        // 確保跨功能查詢欄位包含在內
        if (!filteredVisible.includes('crossFunctionalCheckbox')) {
          filteredVisible.unshift('crossFunctionalCheckbox')
        }
        visibleColumnIds.value = filteredVisible
      } else {
        // 預設顯示的列（使用中文欄位名）：年份優先，再是UID和基本欄位
        const defaultColumns = ['crossFunctionalCheckbox', '入學年分', '身分證統一編號', '姓名', '班級', '座號', '會考總積分', '錄取管道']
        // 確保預設列存在於當前列中
        visibleColumnIds.value = defaultColumns.filter(id => currentColumnIds.includes(id))
      }
      
      // 如果沒有任何可見列，至少顯示前幾個列
      if (visibleColumnIds.value.length === 0 && currentColumnIds.length > 0) {
        visibleColumnIds.value = currentColumnIds.slice(0, Math.min(7, currentColumnIds.length))
      }
      
      // 載入保存的列順序
      const savedOrder = loadColumnOrder()
      if (savedOrder) {
        columnOrder.value = savedOrder
      } else {
        columnOrder.value = columns.value.map(col => col.id)
      }
    }
    
    console.log('StudentList: 資料設定完成，完整資料:', fullData.length, '筆，顯示資料:', displayData.length, '筆')
    
  } catch (error) {
    console.error('❌ StudentList: 設定資料失敗:', error)
    rawData.value = []
  }
}

// 監聽過濾器變化
watch([selectedChannel, selectedStudentType, selectedAdmissionType, selectedClass], () => {
  const filters = {
    selectedChannel: selectedChannel.value,
    selectedStudentType: selectedStudentType.value,
    selectedAdmissionType: selectedAdmissionType.value,
    selectedClass: selectedClass.value
  }
  
  console.log('🎯 StudentListTanstack: 過濾器變化，發出 filter-change', filters)
  scrollTop.value = 0 // 重置滚动位置
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
  emit('filter-change', filters)
})

// 監聽鎖定學生變化
watch(lockedStudents, () => {
  loadData()
}, { deep: true })

// 監聽學生資料變化
watch([() => props.studentData, () => props.filteredData], () => {
  console.log('StudentList: 學生資料變更，重新設定')
  if (!lockedStudents.value || lockedStudents.value.length === 0) {
    loadData()
  }
}, { deep: true })

// 監聽可見欄位變化
watch(visibleColumnIds, (newIds) => {
  console.log('🔧 可見欄位變更:', newIds)
}, { deep: true })

// 輸出名單功能
const generateReport = async () => {
  downloading.value = true
  
  try {
    const filters = {
      selectedYears: props.selectedYears,
      selectedChannel: selectedChannel.value,
      selectedStudentType: selectedStudentType.value,
      selectedAdmissionType: selectedAdmissionType.value,
      selectedClass: selectedClass.value,
      reportType: 'student'
    }
    
    const result = await apiService.generateFilteredReport(filters)
    
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

// 多重條件搜尋器函數
const createEmptyCondition = () => ({
  id: conditionIdCounter++,
  field: '',
  patterns: ''
})

const showAdvancedFilter = () => {
  // 檢查是否有已儲存的篩選條件
  const savedConditions = loadAdvancedFilters()
  
  if (savedConditions && savedConditions.length > 0) {
    showLoadOldFiltersAlert.value = true
  } else {
    showLoadOldFiltersAlert.value = false
  }
  
  // 如果沒有任何條件，初始化一個空條件
  if (advancedConditions.value.length === 0) {
    advancedConditions.value = [createEmptyCondition()]
  }
  
  advancedFilterVisible.value = true
}

const loadOldFilters = () => {
  const savedConditions = loadAdvancedFilters()
  if (savedConditions && savedConditions.length > 0) {
    // 恢復 counter 到最大 id + 1
    const maxId = Math.max(...savedConditions.map(c => c.id || 0))
    conditionIdCounter = maxId + 1
    
    advancedConditions.value = savedConditions
    ElMessage.success(`已載入 ${savedConditions.length} 個篩選條件`)
  }
  showLoadOldFiltersAlert.value = false
}

const dismissLoadAlert = () => {
  showLoadOldFiltersAlert.value = false
}

const addCondition = () => {
  advancedConditions.value.push(createEmptyCondition())
}

const removeCondition = (index) => {
  if (advancedConditions.value.length > 1) {
    advancedConditions.value.splice(index, 1)
  }
}

const onFieldChange = (condition) => {
  // 可以在這裡加入欄位變更時的邏輯
  console.log('欄位變更:', condition.field)
}

const applyAdvancedFilters = (data) => {
  if (!advancedConditions.value.length) return data
  
  const validConditions = advancedConditions.value.filter(condition => 
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

const applyAdvancedFilter = () => {
  // 儲存篩選條件到 localStorage
  saveAdvancedFilters()
  
  // 關閉對話框
  advancedFilterVisible.value = false
  
  const validConditions = advancedConditions.value.filter(condition => 
    condition.field && condition.patterns.trim()
  )
  
  ElMessage.success(`已套用 ${validConditions.length} 個篩選條件`)
}

const cancelAdvancedFilter = () => {
  advancedFilterVisible.value = false
  showLoadOldFiltersAlert.value = false
}

const clearAdvancedFilters = () => {
  advancedConditions.value = [createEmptyCondition()]
  // 清除儲存的篩選條件
  localStorage.removeItem('studentListAdvancedFilters')
  ElMessage.info('已清除所有篩選條件')
}

// 清除所有過濾器（包括基本過濾器和高級過濾器）
const clearAllFilters = () => {
  // 清除基本過濾器
  selectedChannel.value = ''
  selectedStudentType.value = ''
  selectedAdmissionType.value = ''
  selectedClass.value = ''
  crossFunctionalFilterActive.value = false
  
  // 清除高級過濾器
  advancedConditions.value = [createEmptyCondition()]
  localStorage.removeItem('studentListAdvancedFilters')
  
  // 重置滚动位置
  scrollTop.value = 0
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
  
  ElMessage.success('已清除所有過濾器')
}

// 切換跨功能查詢過濾器
const toggleCrossFunctionalFilter = () => {
  crossFunctionalFilterActive.value = !crossFunctionalFilterActive.value
  scrollTop.value = 0 // 重置滚动位置
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
  
  if (crossFunctionalFilterActive.value) {
    ElMessage.success(`已啟用跨功能篩選，顯示 ${crossFunctionalUIDs.value.length} 位學生`)
  } else {
    ElMessage.success('已關閉跨功能篩選，顯示全部學生')
  }
}

// 儲存和載入篩選條件
const saveAdvancedFilters = () => {
  const validConditions = advancedConditions.value.filter(condition => 
    condition.field && condition.patterns.trim()
  )
  localStorage.setItem('studentListAdvancedFilters', JSON.stringify(validConditions))
}

const loadAdvancedFilters = () => {
  const saved = localStorage.getItem('studentListAdvancedFilters')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      console.warn('無法載入已儲存的篩選條件:', e)
      return null
    }
  }
  return null
}

onMounted(() => {
  loadData()
  nextTick(() => {
    initVirtualScroll()
  })
})

// 监听数据变化，更新虚拟高度
watch(() => crossFunctionalFilteredData.value.length, () => {
  updateVirtualHeight()
  updateVisibleRange()
})

// 监听窗口大小变化
watch(() => scrollContainer.value, (newVal) => {
  if (newVal) {
    const resizeObserver = new ResizeObserver(() => {
      initVirtualScroll()
    })
    resizeObserver.observe(newVal)
  }
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

.filter-header-actions {
  display: flex;
  align-items: center;
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

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-item label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.table-container {
  width: 100%;
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
}

.tanstack-table th {
  background-color: #fafafa;
  font-weight: 600;
  user-select: none;
}

.tanstack-table th.draggable-header {
  cursor: grab; /* 顯示抓取手勢 */
  cursor: -webkit-grab; /* Safari 相容性 */
  cursor: -moz-grab; /* Firefox 相容性 */
  user-select: none;
  transition: background-color 0.2s ease;
}

.tanstack-table th.draggable-header:active {
  cursor: grabbing; /* 拖拽時顯示抓取中手勢 */
  cursor: -webkit-grabbing; /* Safari 相容性 */
  cursor: -moz-grabbing; /* Firefox 相容性 */
}

.tanstack-table th.draggable-header.dragging {
  opacity: 0.5;
  background-color: #e6f7ff !important;
  cursor: grabbing !important;
  cursor: -webkit-grabbing !important;
  cursor: -moz-grabbing !important;
}

.tanstack-table th.draggable-header:not(.pinned-left):hover {
  background-color: #f0f9ff;
  cursor: grab;
  cursor: -webkit-grab;
  cursor: -moz-grab;
}

.tanstack-table th.pinned-left.draggable-header {
  cursor: not-allowed !important; /* 固定欄位顯示禁止圖示 */
}

/* 為了更明確的視覺提示，在可拖曳表頭上添加提示圖示 */
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
  z-index: 1;
}

.tanstack-table th.pinned-left {
  background-color: #fafafa;
  z-index: 2;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-indicator {
  font-size: 12px;
  color: #909399;
}

.tanstack-table th.sorting .header-content {
  cursor: pointer;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 5px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}

.resizer:hover {
  background-color: #409eff;
}

.resizer.isResizing {
  background-color: #409eff;
  opacity: 1;
}

.tanstack-table tbody tr:hover {
  background-color: #f5f7fa;
}

.tanstack-table tbody tr.selected {
  background-color: #ecf5ff;
}

.skeleton-container {
  margin-top: 20px;
  padding: 20px;
}

.virtual-scroll-container {
  height: 600px;
  overflow: auto;
  position: relative;
}

.virtual-content {
  position: relative;
  width: 100%;
}

.column-settings {
  padding: 20px 0;
}

:deep(.el-transfer) {
  text-align: center;
}

:deep(.el-transfer-panel) {
  width: 45%;
}

/* 多重條件搜尋器樣式 */
.advanced-filter-container {
  max-height: 500px;
  overflow-y: auto;
}

.filter-condition-row {
  display: flex;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 20px;
  padding: 20px;
  background-color: #fafafa;
  position: relative;
}

.condition-left {
  flex: 0 0 250px;
  margin-right: 20px;
}

.condition-left h4 {
  margin: 0 0 15px 0;
  color: #409eff;
  font-size: 16px;
}

.and-label {
  background-color: #67c23a;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  margin-left: 10px;
}

.field-selector {
  margin-bottom: 10px;
}

.field-selector label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #606266;
}

.condition-right {
  flex: 1;
  margin-right: 50px;
}

.regex-input label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #606266;
}

.pattern-help {
  margin-top: 8px;
  padding: 8px;
  background-color: #f0f9ff;
  border-radius: 4px;
  border: 1px solid #e1f5fe;
}

.pattern-help small {
  color: #546e7a;
  line-height: 1.4;
}

.condition-actions {
  position: absolute;
  top: 15px;
  right: 15px;
}

.add-condition {
  margin-top: 20px;
  text-align: center;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  margin: 0 -16px -16px -16px;
}

.drawer-footer .el-button {
  min-width: 80px;
}

.column-settings {
  max-height: 400px;
  overflow-y: auto;
}
</style>