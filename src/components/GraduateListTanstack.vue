<template>
  <div v-loading="loading">
    <!-- 過濾器區域 -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>畢業生榜單過濾器</span>
          <div class="filter-header-actions">
            <el-button 
              type="warning" 
              @click="toggleCrossFunctionalFilter"
              size="small"
              :disabled="crossFunctionalUIDs.length === 0"
            >
              {{ crossFunctionalFilterActive ? '顯示全部' : `跨功能篩選 (${crossFunctionalUIDs.length})` }}
            </el-button>
            <el-button 
              type="danger" 
              @click="clearAllFilters"
              size="small"
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
        <el-col :xs="24" :sm="12" :md="8">
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
        
        <el-col :xs="24" :sm="12" :md="8">
          <div class="filter-item">
            <label>錄取學校：</label>
            <el-select 
              v-model="selectedSchool" 
              placeholder="全部"
              clearable
              filterable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="school in availableSchools"
                :key="school"
                :label="school"
                :value="school"
              />
            </el-select>
          </div>
        </el-col>
        
        <el-col :xs="24" :sm="12" :md="8">
          <div class="filter-item">
            <label>入學管道：</label>
            <el-select 
              v-model="selectedPathway" 
              placeholder="全部"
              clearable
              style="width: 100%"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="pathway in availablePathways"
                :key="pathway"
                :label="pathway"
                :value="pathway"
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
          <span>畢業生列表（{{ sortedData.length }} 筆）</span>
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
              :key="item._isSkeleton ? `skeleton-${virtualStart + index}` : (item['學測報名序號'] || item.idNumber || virtualStart + index)"
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
                  :model-value="isCrossFunctionalSelected(getStudentUID(item, 'graduate'))"
                  @update:model-value="(value) => handleCrossFunctionalChange(item, value)"
                />
              </td>
              
              <!-- 其他欄位 -->
              <td v-for="key in orderedVisibleColumnKeys" :key="key">
                <template v-if="item._isSkeleton">
                  <el-skeleton-item variant="text" />
                </template>
                <template v-else>
                  <template v-if="key === '榜單年分'">
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
import { ref, onMounted, computed, watch, inject, nextTick } from 'vue'
import { getStudentUID } from '../utils/uidFactory'
import { ElMessage, ElCheckbox, ElSkeletonItem } from 'element-plus'
import { Setting, Download, Search, Plus, Delete } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'

const props = defineProps({
  selectedYears: {
    type: Array,
    default: () => []
  },
  graduateData: {
    type: Array,
    default: () => []
  },
  filteredData: {
    type: Array,
    default: () => []
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
const backendHeaders = ref([])
const manualDebug = ref(false)

// 過濾器狀態
const selectedClass = ref('')
const selectedSchool = ref('')
const selectedPathway = ref('')

// 可用選項
const availableClasses = ref([])
const availableSchools = ref([])
const availablePathways = ref([])

// 排序設定
const sortConfig = ref({ key: '榜單年分', order: 'desc' })

// 列設定對話框
const columnSettingsVisible = ref(false)
const tempVisibleColumnIds = ref([])

// 多重條件搜尋器
const advancedFilterVisible = ref(false)
const showLoadOldFiltersAlert = ref(false)
const advancedConditions = ref([])
let conditionIdCounter = 1

// 拖曳狀態
const draggedColumn = ref(null)
const columnOrder = ref([])

// 跨功能篩選狀態
const crossFunctionalFilterActive = ref(false)

// 切換跨功能篩選
const toggleCrossFunctionalFilter = () => {
  crossFunctionalFilterActive.value = !crossFunctionalFilterActive.value
  if (!crossFunctionalFilterActive.value) {
    console.log('關閉跨功能篩選，恢復正常過濾')
  } else {
    console.log(`開啟跨功能篩選，將從完整資料中搜尋 ${crossFunctionalUIDs.value.length} 個 UID`)
  }
}


// 列顯示名稱映射
const columnDisplayNames = {
  'checkbox': '選擇',
  '學測報名序號': '學測報名序號',
  'idNumber': '身分證號（加密）',
  '姓名': '姓名',
  '班級': '班級',
  '座號': '座號',
  '入學管道': '入學管道',
  '錄取學校': '錄取學校',
  '公私立': '公私立',
  '錄取系所': '錄取系所',
  '榜單年分': '榜單年分',
  '經度': '經度',
  '緯度': '緯度',
  '原始身分證字號': '原始身分證字號'
}

// 獲取欄位標籤
const getColumnLabel = (key) => {
  if (columnDisplayNames[key]) {
    return columnDisplayNames[key]
  }
  return key
}

// 基本欄位配置
const columnConfigs = {
  'checkbox': { width: 60, enableHiding: false, enableSorting: false },
  '學測報名序號': { width: 120 }, // 允許用戶控制顯示/隱藏
  'idNumber': { width: 280, enableHiding: false }, // UID 欄位不允許隱藏（但已在上面排除不生成列）
  '姓名': { width: 100 },
  '班級': { width: 80 },
  '座號': { width: 80 },
  '入學管道': { width: 120 },
  '錄取學校': { width: 180, minWidth: 180 },
  '公私立': { width: 80 },
  '錄取系所': { width: 180, minWidth: 180 },
  '榜單年分': { width: 100 },
  '經度': { width: 120 },
  '緯度': { width: 120 },
  '原始身分證字號': { width: 150 }
}

// 動態判斷欄位配置
const getColumnConfig = (key) => {
  if (columnConfigs[key]) {
    return columnConfigs[key]
  }
  return { width: 120 }
}

// 獲取欄位寬度
const getColumnWidth = (key) => {
  return getColumnConfig(key).width || 120
}

// 判斷是否為固定欄位
const isFixedColumn = (key) => {
  return ['榜單年分', 'idNumber'].includes(key)
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
    if (['hasGeoInfo', 'lng', 'lat', 'coordinates', 'uid', '身分證統一編號'].includes(key)) return false
    if (key === '原始身分證字號' && !manualDebug.value) return false
    return true
  })
})

// 可見欄位
const visibleColumnKeys = computed(() => {
  if (visibleColumnIds.value.length === 0) {
    // 預設顯示：基本欄位
    const defaultColumns = ['榜單年分', 'idNumber', '學測報名序號', '姓名', '班級', '入學管道', '錄取學校', '錄取系所']
    return defaultColumns.filter(key => allColumnKeys.value.includes(key))
  }
  
  // 確保固定欄位始終顯示
  const fixedColumns = ['榜單年分', 'idNumber']
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

// 計算過濾後的資料
// 基本篩選後的資料
const basicFilteredData = computed(() => {
  if (!rawData.value.length) return []
  
  return rawData.value.filter(graduate => {
    // 跨功能選擇過濾 - 只有在有鎖定學生時才過濾
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      const graduateId = graduate['idNumber']
      const lockedStudentIds = lockedStudents.value.map(s => s.idNumber)
      if (!graduateId || !lockedStudentIds.includes(graduateId)) {
        return false
      }
    }
    
    // 年份篩選 - 有鎖定學生時忽略年份篩選
    const yearMatch = (lockedStudents.value && lockedStudents.value.length > 0) || 
                     !props.selectedYears || props.selectedYears.length === 0 || 
                     props.selectedYears.includes(graduate['榜單年分'])
    
    // 其他篩選條件
    const classMatch = !selectedClass.value || graduate['班級'] === selectedClass.value
    const schoolMatch = !selectedSchool.value || graduate['錄取學校'] === selectedSchool.value
    const pathwayMatch = !selectedPathway.value || graduate['入學管道'] === selectedPathway.value
    
    return yearMatch && classMatch && schoolMatch && pathwayMatch
  })
})

// 最終過濾資料（包含多重條件篩選）
const filteredData = computed(() => {
  let data = basicFilteredData.value
  console.log('🎯 GraduateListTanstack: 基本過濾後資料筆數:', data.length)
  
  // 套用跨功能篩選 - 如果啟用，從完整資料搜尋
  if (crossFunctionalFilterActive.value && crossFunctionalUIDs.value.length > 0) {
    const uidSet = new Set(crossFunctionalUIDs.value.map(item => item.uid))
    
    // 從完整的資料中搜尋，忽略其他篩選器
    data = rawData.value.filter(graduate => {
      const graduateUID = graduate.uid || graduate.idNumber || graduate['身分證字號']
      return graduateUID && uidSet.has(graduateUID)
    })
    
    console.log(`🎯 GraduateListTanstack: 跨功能篩選從 ${rawData.value.length} 筆中找到 ${data.length} 筆`)
  }
  
  // 套用多重條件篩選
  if (advancedConditions.value.length > 0) {
    data = applyAdvancedFilters(data)
    console.log('🎯 GraduateListTanstack: 套用多重條件後，筆數:', data.length)
  }
  
  return data
})

// 排序處理
const sortedData = computed(() => {
  if (!sortConfig.value.key) return filteredData.value
  
  const key = sortConfig.value.key
  const order = sortConfig.value.order
  
  return [...filteredData.value].sort((a, b) => {
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
  const uid = getStudentUID(student, 'graduate')
  if (!uid) return
  
  if (checked) {
    addToCrossFunctionalUIDs(uid, 'graduate')
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
    
    localStorage.setItem('graduateListTanstackColumnOrder', JSON.stringify(columnOrder.value))
  }
}

// Transfer 元件的資料
const transferData = computed(() => {
  return allColumnKeys.value
    .filter(key => !['榜單年分', 'idNumber'].includes(key)) // 排除固定欄位
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
  
  localStorage.setItem('graduateListTanstackVisibleColumns', JSON.stringify(visibleColumnIds.value))
}

const handleTransferChange = () => {
  // el-transfer 的 v-model 會自動更新 tempVisibleColumnIds
}

const cancelColumnSettings = () => {
  tempVisibleColumnIds.value = [...visibleColumnIds.value]
  columnSettingsVisible.value = false
}


// 載入保存的列順序
const loadColumnOrder = () => {
  const saved = localStorage.getItem('graduateListTanstackColumnOrder')
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
  localStorage.setItem('graduateListTanstackColumnOrder', JSON.stringify(columnOrder.value))
}

// 載入保存的可見列
const loadVisibleColumns = () => {
  const saved = localStorage.getItem('graduateListTanstackVisibleColumns')
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
  localStorage.setItem('graduateListTanstackVisibleColumns', JSON.stringify(visibleColumnIds.value))
}

// 載入資料
const loadData = () => {
  try {
    // 跨功能查詢的情況下，資料由上層組件處理
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      console.log('🔍 GraduateList: 跨功能查詢模式，等待上層組件資料')
      return
    }
    
    // 使用完整的畢業生資料來建立過濾器選項
    const fullData = props.graduateData || []
    const displayData = props.filteredData || []
    rawData.value = fullData  // 用於建立列定義
    console.log(`✅ GraduateList: 接收完整資料 ${fullData.length} 筆，顯示資料 ${displayData.length} 筆`)
    
    // 調試：檢查資料結構
    if (fullData.length > 0) {
      console.log('📋 GraduateList: 第一筆資料的欄位:', Object.keys(fullData[0]))
      console.log('📋 GraduateList: 第一筆資料範例:', fullData[0])
    }
    
    // 從完整資料中提取過濾器選項（這樣才能獲得所有可能的選項）
    const classes = [...new Set(fullData.map(item => item['班級']).filter(Boolean))]
    const schools = [...new Set(fullData.map(item => item['錄取學校']).filter(Boolean))]
    const pathways = [...new Set(fullData.map(item => item['入學管道']).filter(Boolean))]
    
    availableClasses.value = classes
    availableSchools.value = schools
    availablePathways.value = pathways
    
    // 初始化列配置
    if (fullData.length > 0) {
      initializeColumns()
    }
    
    console.log('GraduateList: 資料設定完成，完整資料:', fullData.length, '筆，顯示資料:', displayData.length, '筆')
    
  } catch (error) {
    console.error('❌ GraduateList: 設定資料失敗:', error)
    rawData.value = []
  }
}

// 初始化列配置
const initializeColumns = () => {
  const savedVisible = localStorage.getItem('graduateListTanstackVisibleColumns')
  if (savedVisible) {
    try {
      visibleColumnIds.value = JSON.parse(savedVisible)
    } catch (e) {
      console.warn('無法載入儲存的欄位設定:', e)
    }
  }
  
  const savedOrder = localStorage.getItem('graduateListTanstackColumnOrder')
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
      label: columnDisplayNames[key] || key
    }))
})


// 清除所有過濾器（包括基本過濾器和高級過濾器）
const clearAllFilters = () => {
  // 清除基本過濾器
  selectedClass.value = ''
  selectedSchool.value = ''
  selectedPathway.value = ''
  
  // 清除高級過濾器
  advancedConditions.value = [createEmptyCondition()]
  localStorage.removeItem('graduateAdvancedFilters')
  
  ElMessage.success('已清除所有過濾器')
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
  localStorage.removeItem('graduateAdvancedFilters')
  ElMessage.info('已清除所有篩選條件')
}

// 儲存和載入篩選條件
const saveAdvancedFilters = () => {
  const validConditions = advancedConditions.value.filter(condition => 
    condition.field && condition.patterns.trim()
  )
  localStorage.setItem('graduateAdvancedFilters', JSON.stringify(validConditions))
}

const loadAdvancedFilters = () => {
  const saved = localStorage.getItem('graduateAdvancedFilters')
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

// 監聽過濾器變化
watch([selectedClass, selectedSchool, selectedPathway], () => {
  virtualStart.value = 0 // 重置滾動位置
  if (tableContainer.value) {
    tableContainer.value.scrollTop = 0
  }
  emit('filter-change', {
    selectedClass: selectedClass.value,
    selectedSchool: selectedSchool.value,
    selectedPathway: selectedPathway.value
  })
})

// 監聽鎖定學生變化
watch(lockedStudents, () => {
  loadData()
}, { deep: true })

// 監聽畢業生資料變化
watch([() => props.graduateData, () => props.filteredData], () => {
  console.log('GraduateList: 畢業生資料變更，重新設定')
  if (!lockedStudents.value || lockedStudents.value.length === 0) {
    loadData()
  }
}, { deep: true })

// 監聽selectedStudents變化，更新表格選中狀態
watch(() => selectedStudents.value, () => {
  // TanStack table會自動處理選中狀態，因為我們在checkbox cell中使用了selectedStudents
}, { deep: true })

// 輸出名單功能
const generateReport = async () => {
  downloading.value = true
  
  try {
    const filters = {
      selectedYear: props.selectedYear,
      selectedClass: selectedClass.value,
      selectedSchool: selectedSchool.value,
      selectedPathway: selectedPathway.value,
      reportType: 'graduate'
    }
    
    const result = await apiService.generateGraduateReport(filters)
    
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

onMounted(async () => {
  // 先載入系統配置
  try {
    const configResult = await apiService.getSystemConfig()
    if (configResult.success) {
      manualDebug.value = configResult.config.manualDebug
    }
  } catch (error) {
    console.error('Failed to load system config:', error)
  }
  
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

.skeleton-row {
  background-color: #fafafa;
}

.skeleton-row:hover {
  background-color: #f0f0f0;
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

/* 跨年份資料的紅色背景 */
.tanstack-table tbody tr.cross-year-row {
  background-color: #fef0f0 !important;
}

.tanstack-table tbody tr.cross-year-row:hover {
  background-color: #fde2e2 !important;
}

.tanstack-table tbody tr.cross-year-row td {
  background-color: transparent !important;
}


.column-settings {
  max-height: 400px;
  overflow-y: auto;
}

.column-settings .el-checkbox {
  display: block;
  margin-bottom: 8px;
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