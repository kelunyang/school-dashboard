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
          <span>學生列表 ({{ filteredData.length }} 筆)</span>
          <div class="header-actions">
            <el-button @click="showColumnSettings">
              <el-icon><Setting /></el-icon>
              自定義列
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="table-container">
        <el-table
          :data="paginatedData"
          style="width: 100%"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
          border
          stripe
        >
          <el-table-column
            type="selection"
            width="55"
            fixed="left"
          />
          
          <el-table-column
            v-for="column in visibleColumns"
            :key="column.prop"
            :prop="column.prop"
            :label="column.label"
            :width="column.width"
            :sortable="column.sortable"
            :fixed="column.fixed"
            show-overflow-tooltip
          >
            <template #default="scope">
              {{ scope.row[column.prop] }}
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 分頁 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200, 500]"
            :total="filteredData.length"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </el-card>

    <!-- 列設定對話框 -->
    <el-dialog
      v-model="columnSettingsVisible"
      title="自定義列顯示"
      width="600px"
    >
      <div class="column-settings">
        <el-checkbox-group v-model="selectedColumnIds">
          <div
            v-for="column in allColumns"
            :key="column.prop"
            class="column-item"
          >
            <el-checkbox :label="column.prop">
              {{ column.label }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="columnSettingsVisible = false">取消</el-button>
          <el-button type="primary" @click="applyColumnSettings">確定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject } from 'vue'
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

// 載入狀態
const loading = ref(false)

// 資料
const rawData = ref([])
const selectedRows = ref([])

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

// 列設定
const columnSettingsVisible = ref(false)
const selectedColumnIds = ref([])

// 排序
const sortColumn = ref('')
const sortOrder = ref('')

// 所有可用列
const allColumns = ref([
  { prop: 'idNumber', label: '身分證字號', width: 120, sortable: true, fixed: 'left' },
  { prop: '姓名', label: '姓名', width: 100, sortable: true },
  { prop: '性別', label: '性別', width: 80, sortable: true },
  { prop: '班級', label: '班級', width: 100, sortable: true },
  { prop: '座號', label: '座號', width: 80, sortable: true },
  { prop: '學號', label: '學號', width: 120, sortable: true },
  { prop: '會考總積分', label: '會考總積分', width: 120, sortable: true },
  { prop: '錄取管道', label: '錄取管道', width: 150, sortable: true },
  { prop: '畢業國中名稱', label: '畢業國中名稱', width: 200, sortable: true },
  { prop: '畢業國中代碼', label: '畢業國中代碼', width: 120, sortable: true },
  { prop: '學生身分別', label: '學生身分別', width: 120, sortable: true },
  { prop: '錄取身分別', label: '錄取身分別', width: 120, sortable: true },
  { prop: '入學年分', label: '入學年分', width: 100, sortable: true }
])

// 預設顯示的列
const defaultVisibleColumns = ['idNumber', '姓名', '性別', '班級', '座號', '學號', '會考總積分', '錄取管道', '學生身分別', '入學年分']

// 計算顯示的列
const visibleColumns = computed(() => {
  return allColumns.value.filter(col => selectedColumnIds.value.includes(col.prop))
})

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
  
  // 排序
  if (sortColumn.value && sortOrder.value) {
    data = [...data].sort((a, b) => {
      const aVal = a[sortColumn.value]
      const bVal = b[sortColumn.value]
      
      if (sortOrder.value === 'ascending') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }
  
  return data
})

// 計算分頁資料
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredData.value.slice(start, end)
})

// 載入資料
const loadData = async () => {
  loading.value = true
  try {
    const response = await apiService.getStudentList('all')
    if (response.success) {
      rawData.value = response.data || []
      updateFilterOptions()
    } else {
      ElMessage.error(response.error || '載入資料失敗')
    }
  } catch (error) {
    console.error('載入學生資料錯誤:', error)
    ElMessage.error('載入資料失敗')
  } finally {
    loading.value = false
  }
}

// 更新過濾器選項
const updateFilterOptions = () => {
  const data = rawData.value
  
  availableChannels.value = [...new Set(data.map(item => item['錄取管道']).filter(Boolean))]
  availableStudentTypes.value = [...new Set(data.map(item => item['學生身分別']).filter(Boolean))]
  availableAdmissionTypes.value = [...new Set(data.map(item => item['錄取身分別']).filter(Boolean))]
  
  const classes = [...new Set(data.map(item => item['班級']).filter(Boolean))]
  const hasUnassigned = data.some(item => !item['班級'] || item['班級'] === '')
  availableClasses.value = hasUnassigned ? ['未編班', ...classes] : classes
}

// 顯示列設定
const showColumnSettings = () => {
  columnSettingsVisible.value = true
}

// 應用列設定
const applyColumnSettings = () => {
  columnSettingsVisible.value = false
}

// 處理選擇變更
const handleSelectionChange = (selection) => {
  selectedRows.value = selection
  emit('filter-change', {
    filteredData: filteredData.value,
    selectedRows: selection
  })
}

// 處理排序變更
const handleSortChange = ({ column, prop, order }) => {
  sortColumn.value = prop
  sortOrder.value = order
}

// 處理分頁大小變更
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

// 處理當前頁變更
const handleCurrentChange = (val) => {
  currentPage.value = val
}

// 監聽過濾器變化
watch([selectedChannel, selectedStudentType, selectedAdmissionType, selectedClass], () => {
  currentPage.value = 1
  emit('filter-change', {
    filteredData: filteredData.value,
    selectedRows: selectedRows.value
  })
})

// 監聽年份變化
watch(() => props.selectedYear, () => {
  currentPage.value = 1
  emit('filter-change', {
    filteredData: filteredData.value,
    selectedRows: selectedRows.value
  })
})

// 初始化
onMounted(() => {
  selectedColumnIds.value = [...defaultVisibleColumns]
  loadData()
})
</script>

<style scoped>
.filter-item {
  margin-bottom: 10px;
}

.filter-item label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #606266;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.table-container {
  width: 100%;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.column-settings {
  max-height: 400px;
  overflow-y: auto;
}

.column-item {
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.column-item:hover {
  background-color: #f5f7fa;
}
</style>