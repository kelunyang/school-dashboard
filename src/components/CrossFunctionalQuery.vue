<template>
  <div>
    <!-- 功能說明提示 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="24">
        <el-alert
          title="跨功能查詢說明"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <p>在名單前方勾選可以查看該生不同資料庫中的數據</p>
          </template>
        </el-alert>
      </el-col>
    </el-row>
    <!-- 搜尋功能區 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>學生姓名-報名序號搜尋</span>
            </div>
          </template>
          
          <el-row :gutter="20">
            <el-col :span="16">
              <el-input
                v-model="searchQuery"
                placeholder="輸入姓名或報名序號進行搜尋（支援部分匹配）"
                clearable
                @input="handleSearch"
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </el-col>
            <el-col :span="8">
              <el-button 
                type="primary" 
                @click="handleSearch"
                :loading="searchLoading"
                :icon="Search"
              >
                搜尋
              </el-button>
            </el-col>
          </el-row>
          
          <!-- 搜尋結果 -->
          <div v-if="searchResults.length > 0" style="margin-top: 20px;">
            <el-divider content-position="left">搜尋結果 ({{ searchResults.length }} 筆)</el-divider>
            <el-table
              :data="searchResults"
              @selection-change="handleSearchSelectionChange"
              style="width: 100%"
              max-height="300"
            >
              <el-table-column
                type="selection"
                width="55"
              />
              <el-table-column
                prop="registrationNumber"
                label="報名序號"
                width="120"
              />
              <el-table-column
                prop="name"
                label="姓名"
                width="100"
              />
              <el-table-column
                prop="idNumber"
                label="身分證號（加密）"
                width="280"
              />
              <el-table-column
                prop="originalIdNumber"
                label="原始身分證字號"
                width="150"
                v-if="showOriginalId"
              />
              <el-table-column
                prop="year"
                label="年度"
                width="80"
              />
            </el-table>
            
            <div style="margin-top: 10px; text-align: right;">
              <el-button 
                type="success" 
                @click="addSelectedToLockList"
                :disabled="selectedSearchResults.length === 0"
                :icon="Plus"
              >
                加入鎖定名單 ({{ selectedSearchResults.length }})
              </el-button>
            </div>
          </div>
          
          <div v-else-if="searchQuery && !searchLoading" style="margin-top: 20px;">
            <el-empty description="未找到匹配的結果" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 已選擇學生列表 -->
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>跨功能查詢名單</span>
              <div class="header-actions">
                <el-button 
                  type="default" 
                  @click="showColumnSelector = true"
                  :icon="Setting"
                  size="small"
                >
                  選擇欄位
                </el-button>
                <el-button 
                  type="warning" 
                  @click="removeSelectedFromLockList"
                  :disabled="!hasSelectedInTable"
                  :icon="Remove"
                  size="small"
                >
                  移出名單
                </el-button>
                <el-button 
                  type="danger" 
                  @click="clearAllSelected"
                  :disabled="!selectedStudents || selectedStudents.size === 0"
                  :icon="Delete"
                  size="small"
                >
                  清空選擇
                </el-button>
                <span class="student-count">共 {{ selectedList.length }} 位學生</span>
              </div>
            </div>
          </template>
          
          <el-table
            ref="tableRef"
            :data="paginatedData"
            v-loading="loading"
            stripe
            style="width: 100%"
            height="600"
            @selection-change="handleSelectionChange"
          >
            <el-table-column
              type="selection"
              width="55"
              fixed
              :selectable="checkSelectable"
            />
            
            <el-table-column
              v-for="column in visibleColumns"
              :key="column.prop"
              :prop="column.prop"
              :label="column.label"
              :width="column.width"
              :align="column.align"
              :fixed="column.fixed"
            />
          </el-table>
          
          <!-- 分頁 -->
          <div style="margin-top: 20px; text-align: center;">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[50, 100, 200, 500]"
              layout="total, sizes, prev, pager, next, jumper"
              :total="selectedList.length"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 欄位選擇器對話框 -->
    <el-dialog
      v-model="showColumnSelector"
      title="選擇顯示欄位"
      width="500px"
    >
      <div class="column-selector">
        <el-checkbox-group v-model="selectedColumns">
          <div class="column-grid">
            <el-checkbox 
              v-for="column in allColumns" 
              :key="column.prop"
              :label="column.prop"
              :disabled="column.required"
            >
              {{ column.label }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showColumnSelector = false">取消</el-button>
          <el-button type="primary" @click="updateVisibleColumns">確定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch, nextTick } from 'vue'
import { Search, Plus, Setting, Remove, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { apiService } from '../services/apiService'

// 注入跨功能選擇相關功能
const selectedStudents = inject('selectedStudents')
const lockedStudents = inject('lockedStudents')
const handleStudentSelection = inject('handleStudentSelection')
const addStudentsToLockedList = inject('addStudentsToLockedList')
const removeStudentsFromLockedList = inject('removeStudentsFromLockedList')

const loading = ref(false)
const searchLoading = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const selectedSearchResults = ref([])
const showOriginalId = ref(false)
const showColumnSelector = ref(false)
const selectedColumns = ref([])
const tableRef = ref()

// 分頁相關
const currentPage = ref(1)
const pageSize = ref(100)
const tableSelectedRows = ref([])

// 基本欄位配置
const columnConfigs = {
  'registrationNumber': { label: '報名序號', width: 120, fixed: true, required: true },
  'name': { label: '姓名', width: 100, fixed: true, required: true },
  'idNumber': { label: '身分證號（加密）', width: 280 },
  'originalIdNumber': { label: '原始身分證字號', width: 150 }
}

// 定義所有可用的欄位
const allColumns = ref([])

// 預設顯示的欄位
const defaultColumns = ['registrationNumber', 'name', 'idNumber']

// 計算可見的欄位
const visibleColumns = computed(() => {
  return allColumns.value.filter(column => 
    selectedColumns.value.includes(column.prop)
  )
})

// 獲取已選擇學生的詳細資料
const selectedList = ref([])

// 分頁資料
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return selectedList.value.slice(start, end)
})

// 檢查表格中是否有選中的行
const hasSelectedInTable = computed(() => {
  return tableSelectedRows.value.length > 0
})

// 載入系統配置
onMounted(async () => {
  try {
    const configResult = await apiService.getSystemConfig()
    if (configResult.success) {
      showOriginalId.value = configResult.config.manualDebug
    }
  } catch (error) {
    console.error('Failed to load system config:', error)
  }
  
  // 初始化欄位配置
  updateColumnList()
  
  // 載入儲存的欄位設定
  const savedColumns = localStorage.getItem('crossFunctionalColumns')
  if (savedColumns) {
    try {
      selectedColumns.value = JSON.parse(savedColumns)
    } catch (e) {
      selectedColumns.value = [...defaultColumns]
    }
  } else {
    selectedColumns.value = [...defaultColumns]
  }
  
  // 載入已選擇學生的詳細資料
  loadSelectedStudentDetails()
})

// 更新欄位列表
const updateColumnList = () => {
  const baseColumns = Object.keys(columnConfigs)
    .filter(key => {
      // 原始身分證字號只在 manualDebug 開啟時顯示
      if (key === 'originalIdNumber' && !showOriginalId.value) return false
      return true
    })
    .map(key => ({
      prop: key,
      ...columnConfigs[key]
    }))
  
  allColumns.value = baseColumns
}

// 更新可見欄位
const updateVisibleColumns = () => {
  showColumnSelector.value = false
  localStorage.setItem('crossFunctionalColumns', JSON.stringify(selectedColumns.value))
}

// 搜尋功能
const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  
  searchLoading.value = true
  try {
    const result = await apiService.searchIdMapping(searchQuery.value.trim())
    if (result.success) {
      searchResults.value = result.data
    } else {
      ElMessage.error('搜尋失敗：' + result.error)
      searchResults.value = []
    }
  } catch (error) {
    console.error('Search error:', error)
    ElMessage.error('搜尋過程發生錯誤')
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

// 搜尋結果選擇變更
const handleSearchSelectionChange = (selection) => {
  selectedSearchResults.value = selection
}

// 添加搜尋結果到鎖定名單
const addSelectedToLockList = () => {
  if (selectedSearchResults.value.length === 0) {
    return
  }
  
  if (!addStudentsToLockedList) {
    ElMessage.error('無法獲取添加功能')
    return
  }
  
  // 準備完整的學生資料
  const newStudentDataArray = selectedSearchResults.value
    .filter(student => student.idNumber)
    .map(student => ({
      idNumber: student.idNumber,
      name: student.name,
      registrationNumber: student.registrationNumber,
      originalIdNumber: student.originalIdNumber,
      year: student.year
    }))
  
  // 調用父組件的添加函數（追加模式）
  const totalCount = addStudentsToLockedList(newStudentDataArray)
  
  ElMessage.success(`已添加 ${newStudentDataArray.length} 位學生到鎖定名單，目前共 ${totalCount} 位學生`)
  selectedSearchResults.value = []
  
  // 重新載入學生詳細資料
  loadSelectedStudentDetails()
}

// 載入已選擇學生的詳細資料
const loadSelectedStudentDetails = () => {
  // 檢查是否有選中的學生或已鎖定的學生
  const hasSelectedStudents = selectedStudents.value && selectedStudents.value.size > 0
  const hasLockedStudents = lockedStudents?.value && lockedStudents.value.length > 0
  
  console.log('CrossFunctionalQuery loadSelectedStudentDetails - hasSelectedStudents:', hasSelectedStudents)
  console.log('CrossFunctionalQuery loadSelectedStudentDetails - hasLockedStudents:', hasLockedStudents)
  console.log('CrossFunctionalQuery loadSelectedStudentDetails - lockedStudents.value:', lockedStudents?.value)
  
  if (!hasSelectedStudents && !hasLockedStudents) {
    selectedList.value = []
    return
  }
  
  // 直接使用前端已有的資料，不需要向後端查詢
  const studentDataList = []
  
  // 從selectedStudents Map中獲取資料
  if (hasSelectedStudents) {
    selectedStudents.value.forEach((studentData, idNumber) => {
      studentDataList.push({
        ...studentData
      })
    })
  }
  
  // 從lockedStudents陣列中獲取資料
  if (hasLockedStudents) {
    lockedStudents.value.forEach(studentData => {
      // 避免重複添加
      if (!studentDataList.find(s => s.idNumber === studentData.idNumber)) {
        studentDataList.push({
          ...studentData
        })
      }
    })
  }
  
  selectedList.value = studentDataList
}

// 清空所有選擇
const clearAllSelected = () => {
  if (selectedStudents.value) {
    // 清空整個Map
    selectedStudents.value.clear()
  }
  selectedList.value = []
  ElMessage.success('已清空所有選擇')
}

// 從鎖定名單中移除選中的學生
const removeSelectedFromLockList = () => {
  if (tableSelectedRows.value.length === 0) {
    ElMessage.warning('請先選擇要移除的學生')
    return
  }
  
  if (!removeStudentsFromLockedList) {
    ElMessage.error('無法獲取移除功能')
    return
  }
  
  // 提取要移除的學生ID
  const studentIdsToRemove = tableSelectedRows.value
    .filter(student => student.idNumber)
    .map(student => student.idNumber)
  
  if (studentIdsToRemove.length === 0) {
    ElMessage.warning('選中的學生中沒有有效的ID')
    return
  }
  
  // 調用父組件的移除函數
  const remainingCount = removeStudentsFromLockedList(studentIdsToRemove)
  
  ElMessage.success(`已移除 ${studentIdsToRemove.length} 位學生，剩餘 ${remainingCount} 位學生`)
  
  // 清空表格選擇
  tableSelectedRows.value = []
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
  
  // 重新載入學生詳細資料
  loadSelectedStudentDetails()
}

// checkbox選擇相關函數
const checkSelectable = (row) => {
  return row.idNumber ? true : false
}

const handleSelectionChange = (selection) => {
  // 更新表格選中行的記錄
  tableSelectedRows.value = selection
}

// 監聽selectedStudents變化，重新載入學生詳細資料
watch(() => selectedStudents.value, () => {
  loadSelectedStudentDetails()
}, { immediate: true, deep: true })


// 監聽lockedStudents變化，重新載入學生資料
watch(() => lockedStudents?.value, () => {
  console.log('CrossFunctionalQuery - lockedStudents changed:', lockedStudents?.value)
  loadSelectedStudentDetails()
}, { immediate: true, deep: true })
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.student-count {
  color: #909399;
  font-size: 14px;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background-color: #f5f7fa;
}

.column-selector {
  max-height: 400px;
  overflow-y: auto;
}

.column-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.column-grid .el-checkbox {
  margin-right: 0;
}
</style>