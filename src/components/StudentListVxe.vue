<template>
  <div v-loading="loading">
    <!-- 過濾器區域 -->
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>學生列表過濾器</span>
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
            <el-button @click="showColumnCustom">
              <el-icon><Setting /></el-icon>
              自定義列
            </el-button>
          </div>
        </div>
      </template>
      
      <vxe-table
        ref="tableRef"
        :data="paginatedData"
        :height="tableHeight"
        :column-config="{ useKey: true, resizable: true }"
        :sort-config="{ multiple: true, remote: false }"
        :checkbox-config="{ checkStrictly: true }"
        border
        stripe
        @checkbox-change="handleSelectionChange"
        @checkbox-all="handleSelectionChange"
        @column-drop-end="handleColumnDrop"
      >
        <!-- 選擇框列 -->
        <vxe-column 
          type="checkbox" 
          width="60" 
          fixed="left"
          :resizable="false"
        />
        
        <!-- 動態列 -->
        <vxe-column
          v-for="column in visibleColumns"
          :key="column.prop"
          :field="column.prop"
          :title="column.label"
          :width="column.width"
          :min-width="column.minWidth || 100"
          :fixed="column.fixed"
          :sortable="column.sortable !== false"
          show-overflow
        />
      </vxe-table>
      
      <!-- 分頁 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[50, 100, 200, 500]"
          :total="filteredData.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'

const props = defineProps({
  selectedYear: {
    type: [String, Number],
    default: 'all'
  }
})

const emit = defineEmits(['filter-change'])

// Inject lockedStudents for cross-functional queries
const lockedStudents = inject('lockedStudents', ref([]))

// 表格引用
const tableRef = ref()

// 載入狀態
const loading = ref(false)
const manualDebug = ref(false)

// 資料
const rawData = ref([])
const allColumns = ref([])
const selectedColumns = ref([])

// 過濾器狀態
const selectedChannel = ref('')
const selectedStudentType = ref('')
const selectedAdmissionType = ref('')
const selectedClass = ref('')

// 可用選項
const availableChannels = ref([])
const availableStudentTypes = ref([])
const availableAdmissionTypes = ref([])
const availableClasses = ref([])

// 分頁
const currentPage = ref(1)
const pageSize = ref(100)

// 表格高度
const tableHeight = ref(600)

// 基本欄位配置
const columnConfigs = {
  'idNumber': { width: 120, fixed: 'left', required: true, sortable: false },
  '姓名': { width: 100, sortable: true },
  '性別': { width: 80, sortable: true },
  '班級': { width: 100, sortable: true },
  '座號': { width: 80, sortable: true },
  '學號': { width: 120, sortable: true },
  '會考總積分': { width: 120, sortable: true },
  '錄取管道': { width: 150, sortable: true },
  '畢業國中名稱': { width: 200, sortable: true },
  '畢業國中代碼': { width: 120, sortable: true },
  '學生身分別': { width: 120, sortable: true },
  '錄取身分別': { width: 120, sortable: true },
  '入學年分': { width: 100, sortable: true }
}

// 計算過濾後的資料
const filteredData = computed(() => {
  let data = rawData.value
  
  // 年份過濾
  if (props.selectedYear !== 'all') {
    data = data.filter(item => item['入學年分'] === props.selectedYear)
  }
  
  // 錄取管道過濾
  if (selectedChannel.value) {
    data = data.filter(item => item['錄取管道'] === selectedChannel.value)
  }
  
  // 學生身分別過濾
  if (selectedStudentType.value) {
    data = data.filter(item => item['學生身分別'] === selectedStudentType.value)
  }
  
  // 錄取身分別過濾
  if (selectedAdmissionType.value) {
    data = data.filter(item => item['錄取身分別'] === selectedAdmissionType.value)
  }
  
  // 班級過濾
  if (selectedClass.value) {
    if (selectedClass.value === '未編班') {
      data = data.filter(item => !item['班級'] || item['班級'] === '')
    } else {
      data = data.filter(item => item['班級'] === selectedClass.value)
    }
  }
  
  return data
})

// 分頁資料
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

// 載入保存的列順序
const loadColumnOrder = () => {
  const saved = localStorage.getItem('studentListVxeColumnOrder')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      return null
    }
  }
  return null
}

// 可見的列（按保存的順序排列）
const visibleColumns = computed(() => {
  if (!allColumns.value || !selectedColumns.value.length) return []
  
  const columnMap = new Map(allColumns.value.map(col => [col.prop, col]))
  const savedOrder = loadColumnOrder()
  
  if (savedOrder && Array.isArray(savedOrder)) {
    const ordered = []
    
    // 按保存的順序添加可見列
    savedOrder.forEach(prop => {
      if (selectedColumns.value.includes(prop) && columnMap.has(prop)) {
        ordered.push(columnMap.get(prop))
      }
    })
    
    // 添加任何新的可見列
    selectedColumns.value.forEach(prop => {
      if (!savedOrder.includes(prop) && columnMap.has(prop)) {
        ordered.push(columnMap.get(prop))
      }
    })
    
    return ordered
  }
  
  // 沒有保存的順序，按原始順序返回
  return allColumns.value.filter(col => selectedColumns.value.includes(col.prop))
})

// 處理列拖曳結束
const handleColumnDrop = ({ newIndex, oldIndex }) => {
  console.log('列拖曳:', { oldIndex, newIndex })
  
  if (oldIndex === newIndex) return
  
  // 更新列順序
  const currentOrder = visibleColumns.value.map(col => col.prop)
  const [movedProp] = currentOrder.splice(oldIndex, 1)
  currentOrder.splice(newIndex, 0, movedProp)
  
  // 保存新順序
  localStorage.setItem('studentListVxeColumnOrder', JSON.stringify(currentOrder))
  
  console.log('新的列順序:', currentOrder)
}

// 處理選擇變化
const handleSelectionChange = ({ records }) => {
  console.log('選中的行:', records.length)
}

// 顯示列自定義
const showColumnCustom = async () => {
  if (tableRef.value) {
    await tableRef.value.openCustom()
  }
}

// 載入資料
const loadData = async () => {
  loading.value = true
  try {
    let result
    
    // 檢查是否有鎖定的學生
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      result = await apiService.getCrossFunctionalStudentList(lockedStudents.value)
    } else {
      result = await apiService.getStudentList()
    }
    
    if (result.success) {
      rawData.value = result.data
      availableChannels.value = result.filters.channels
      availableStudentTypes.value = result.filters.studentTypes
      availableAdmissionTypes.value = result.filters.admissionTypes
      availableClasses.value = result.filters.classes
      
      // 動態生成欄位配置
      if (result.data.length > 0) {
        const sampleRecord = result.data[0]
        allColumns.value = Object.keys(sampleRecord)
          .filter(key => {
            // 排除敏感和無用的欄位
            if (key === '身分證統一編號') return false
            if (key === '原始身分證字號' && !manualDebug.value) return false
            if (key === 'hasGeoInfo') return false
            if (key === 'lng') return false
            if (key === 'lat') return false
            if (key === 'coordinates') return false
            return true
          })
          .map(key => ({
            prop: key,
            label: key,
            ...(columnConfigs[key] || { width: 120, sortable: true })
          }))
        
        // 初始化選中的欄位
        const savedColumns = localStorage.getItem('studentListVxeSelectedColumns')
        if (savedColumns) {
          try {
            selectedColumns.value = JSON.parse(savedColumns)
          } catch (e) {
            // 使用預設欄位
            selectedColumns.value = allColumns.value
              .filter(col => col.required || ['姓名', '班級', '座號', '會考總積分', '錄取管道'].includes(col.prop))
              .map(col => col.prop)
          }
        } else {
          selectedColumns.value = allColumns.value
            .filter(col => col.required || ['姓名', '班級', '座號', '會考總積分', '錄取管道'].includes(col.prop))
            .map(col => col.prop)
        }
      }
    } else {
      ElMessage.error('載入學生資料失敗：' + result.error)
    }
  } catch (error) {
    ElMessage.error('載入學生資料失敗')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 更新表格高度
const updateTableHeight = () => {
  const windowHeight = window.innerHeight
  tableHeight.value = Math.max(400, windowHeight - 400)
}

// 監聽過濾器變化
watch([selectedChannel, selectedStudentType, selectedAdmissionType, selectedClass], () => {
  currentPage.value = 1 // 重置到第一頁
  emit('filter-change', {
    selectedChannel: selectedChannel.value,
    selectedStudentType: selectedStudentType.value,
    selectedAdmissionType: selectedAdmissionType.value,
    selectedClass: selectedClass.value
  })
})

// 監聽選中欄位變化，保存到本地
watch(selectedColumns, (val) => {
  localStorage.setItem('studentListVxeSelectedColumns', JSON.stringify(val))
})

// 監聽鎖定學生變化
watch(lockedStudents, () => {
  loadData()
}, { deep: true })

// 監聽年份變化
watch(() => props.selectedYear, () => {
  if (!lockedStudents.value || lockedStudents.value.length === 0) {
    loadData()
  }
})

onMounted(() => {
  loadData()
  updateTableHeight()
  window.addEventListener('resize', updateTableHeight)
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
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

.pagination-container {
  margin-top: 20px;
  text-align: center;
}

/* vxe-table 樣式調整 */
:deep(.vxe-table) {
  font-size: 14px;
}

:deep(.vxe-table .vxe-header--column) {
  background-color: #fafafa;
  font-weight: 600;
}

:deep(.vxe-table .vxe-body--column) {
  border-right: 1px solid #ebeef5;
}

:deep(.vxe-table .vxe-table--border-line) {
  border-color: #ebeef5;
}
</style>