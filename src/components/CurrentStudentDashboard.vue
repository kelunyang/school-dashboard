<template>
  <div v-loading="loading">
    <!-- 年份-學期選擇器 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="24">
        <div class="section-container">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <h3 class="section-title" style="margin-bottom: 0;">年份學期選擇</h3>
              <el-select
                v-model="selectedYearSemester"
                placeholder="選擇年份-學期"
                style="width: 300px;"
                @change="handleYearSemesterChange"
              >
                <el-option
                  v-for="option in yearSemesterOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-button 
                type="primary" 
                @click="handleYearSemesterChange(selectedYearSemester)"
                :loading="loading"
              >
                手動刷新
              </el-button>
              <el-button 
                type="info" 
                @click="$emit('show-last-modified')"
              >
                查看資料更新時間
              </el-button>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 學生名單 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <div class="section-container">
          <div class="section-header">
            <h3 class="section-title">學生名單</h3>
            <div class="button-group">
              <el-button 
                type="warning" 
                @click="toggleCrossFunctionalFilter"
                size="small"
                :disabled="crossFunctionalUIDs.length === 0"
              >
                {{ crossFunctionalFilterActive ? '顯示全部' : `跨功能篩選 (${crossFunctionalUIDs.length})` }}
              </el-button>
              <el-button 
                type="primary" 
                @click="showSearchDialog"
                :icon="Search"
                size="small"
              >
                多重條件搜尋器
              </el-button>
              <el-button 
                type="danger" 
                @click="clearAllFilters"
                size="small"
              >
                清除過濾器
              </el-button>
            </div>
          </div>
          
          <!-- 簡易過濾器 -->
          <el-row :gutter="20" style="margin: 20px 0;">
            <el-col :xs="24" :sm="12" :md="4">
              <div class="filter-item">
                <label>班級：</label>
                <el-select 
                  v-model="selectedClass" 
                  placeholder="全部"
                  clearable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  style="width: 100%"
                  @change="handleFilterChange"
                >
                  <el-option
                    v-for="cls in classList"
                    :key="cls"
                    :label="cls"
                    :value="cls"
                  />
                </el-select>
              </div>
            </el-col>
            
            <el-col :xs="24" :sm="12" :md="4">
              <div class="filter-item">
                <label>特殊生：</label>
                <el-select 
                  v-model="selectedSpecialEducation" 
                  placeholder="全部"
                  clearable
                  style="width: 100%"
                  @change="handleFilterChange"
                >
                  <el-option label="全部" value="" />
                  <el-option label="是" :value="true" />
                  <el-option label="否" :value="false" />
                </el-select>
              </div>
            </el-col>
            
            <el-col :xs="24" :sm="12" :md="4">
              <div class="filter-item">
                <label>原住民：</label>
                <el-select 
                  v-model="selectedIndigenous" 
                  placeholder="全部"
                  clearable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  style="width: 100%"
                  @change="handleFilterChange"
                >
                  <el-option
                    v-for="type in indigenousList"
                    :key="type"
                    :label="type || '無'"
                    :value="type"
                  />
                </el-select>
              </div>
            </el-col>
            
            <el-col :xs="24" :sm="12" :md="4">
              <div class="filter-item">
                <label>性別：</label>
                <el-select 
                  v-model="selectedGender" 
                  placeholder="全部"
                  clearable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  style="width: 100%"
                  @change="handleFilterChange"
                >
                  <el-option label="男" value="男" />
                  <el-option label="女" value="女" />
                </el-select>
              </div>
            </el-col>
            
            <el-col :xs="24" :sm="12" :md="4">
              <div class="filter-item">
                <label>中低收：</label>
                <el-select 
                  v-model="selectedLowIncome" 
                  placeholder="全部"
                  clearable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  style="width: 100%"
                  @change="handleFilterChange"
                >
                  <el-option
                    v-for="type in lowIncomeList"
                    :key="type"
                    :label="type || '無'"
                    :value="type"
                  />
                </el-select>
              </div>
            </el-col>
          </el-row>
          
          <!-- 跨年份資料提示 -->
          <el-alert
            v-if="hasCrossYearData && crossFunctionalFilterActive"
            title="在本功能的資料表中找到你鎖定的跨功能資料，已強制顯示並以紅底標記"
            type="success"
            :closable="false"
            show-icon
            style="margin-bottom: 15px;"
          >
            <template #default>
              <div style="font-size: 13px; color: #67C23A;">
                找到 ${crossYearData.length} 筆跨年份資料，年份和UID已放至表格最前面方便查看
                <br>來源年份/學期：{{ crossYearData.map(d => d._originalYearSemester).filter((v, i, a) => a.indexOf(v) === i).join('、') }}
              </div>
            </template>
          </el-alert>
          
          <CurrentStudentList 
            :students="finalFilteredStudents"
            :loading="loading"
            @filter-change="handleFilterChange"
          />
        </div>
      </el-col>
    </el-row>

    <!-- 學生類別統計圖表 -->
    <el-row :gutter="20" style="margin-top: 20px;" v-if="finalFilteredStudents.length > 0">
      <el-col :span="24">
        <div class="section-container">
          <h3 class="section-title">學生類別分佈</h3>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <div class="chart-container">
                <div class="chart-header">
                  <h4 class="chart-title">一般生 / 特教生</h4>
                  <div class="chart-controls">
                    <div class="chart-switch">
                      <span>絕對數字</span>
                      <el-switch 
                        v-model="chartDisplayModes.specialEducation"
                        size="small"
                        style="margin: 0 8px;"
                      />
                      <span>百分比</span>
                    </div>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="showTableDialog('specialEducation')"
                    >
                      文字版
                    </el-button>
                  </div>
                </div>
                <div id="special-education-chart" style="width: 100%; height: 270px;"></div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12">
              <div class="chart-container">
                <div class="chart-header">
                  <h4 class="chart-title">一般生 / 原住民</h4>
                  <div class="chart-controls">
                    <div class="chart-switch">
                      <span>絕對數字</span>
                      <el-switch 
                        v-model="chartDisplayModes.indigenous"
                        size="small"
                        style="margin: 0 8px;"
                      />
                      <span>百分比</span>
                    </div>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="showTableDialog('indigenous')"
                    >
                      文字版
                    </el-button>
                  </div>
                </div>
                <div id="indigenous-chart" style="width: 100%; height: 270px;"></div>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 20px;">
            <el-col :xs="24" :sm="12">
              <div class="chart-container">
                <div class="chart-header">
                  <h4 class="chart-title">一般生 / 低收 / 中低收</h4>
                  <div class="chart-controls">
                    <div class="chart-switch">
                      <span>絕對數字</span>
                      <el-switch 
                        v-model="chartDisplayModes.lowIncome"
                        size="small"
                        style="margin: 0 8px;"
                      />
                      <span>百分比</span>
                    </div>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="showTableDialog('lowIncome')"
                    >
                      文字版
                    </el-button>
                  </div>
                </div>
                <div id="low-income-chart" style="width: 100%; height: 270px;"></div>
              </div>
            </el-col>
            <el-col :xs="24" :sm="12">
              <div class="chart-container">
                <div class="chart-header">
                  <h4 class="chart-title">一般生 / 自學生</h4>
                  <div class="chart-controls">
                    <div class="chart-switch">
                      <span>絕對數字</span>
                      <el-switch 
                        v-model="chartDisplayModes.selfStudy"
                        size="small"
                        style="margin: 0 8px;"
                      />
                      <span>百分比</span>
                    </div>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="showTableDialog('selfStudy')"
                    >
                      文字版
                    </el-button>
                  </div>
                </div>
                <div id="self-study-chart" style="width: 100%; height: 270px;"></div>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 20px;">
            <el-col :xs="24" :sm="12">
              <div class="chart-container">
                <div class="chart-header">
                  <h4 class="chart-title">年齡分布</h4>
                  <div class="chart-controls">
                    <div class="chart-switch">
                      <span>絕對數字</span>
                      <el-switch 
                        v-model="chartDisplayModes.age"
                        size="small"
                        style="margin: 0 8px;"
                      />
                      <span>百分比</span>
                    </div>
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="showTableDialog('age')"
                    >
                      文字版
                    </el-button>
                  </div>
                </div>
                <div id="age-chart" style="width: 100%; height: 270px;"></div>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-col>
    </el-row>

    
    <!-- 多重條件搜尋對話框 -->
    <AdvancedSearchDialog
      v-model:visible="showAdvancedDialog"
      :available-fields="getAvailableFields(currentStudentData)"
      storage-key="currentStudentAdvancedFilters"
      @apply-filters="handleApplyFilters"
    />

    <!-- 圖表文字版抽屜 -->
    <el-drawer
      v-model="tableDialogVisible"
      :title="`${currentTableTitle} - 文字版`"
      direction="ttb"
      size="70%"
      :show-close="true"
    >
      <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
        <el-button 
          type="success" 
          @click="downloadCSV"
          size="small"
          :icon="Download"
        >
          下載 CSV
        </el-button>
        <el-radio-group v-model="displayMode">
          <el-radio value="count">絕對數字</el-radio>
          <el-radio value="percentage">百分比</el-radio>
        </el-radio-group>
      </div>
      
      <el-table 
        :data="currentTableData" 
        style="width: 100%"
        :show-header="true"
        border
      >
        <el-table-column 
          prop="category" 
          label="類別" 
          align="center"
          width="200"
        />
        <el-table-column 
          prop="count" 
          label="人數" 
          align="center"
          v-if="displayMode === 'count'"
        />
        <el-table-column 
          prop="percentage" 
          label="百分比" 
          align="center"
          v-if="displayMode === 'percentage'"
        />
      </el-table>
      
      <div style="margin-top: 15px; text-align: center; color: #666;">
        總計：{{ currentTableTotal }} 人
      </div>
      
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="tableDialogVisible = false">關閉</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Download } from '@element-plus/icons-vue'
import CurrentStudentList from './CurrentStudentList.vue'
import AdvancedSearchDialog from './AdvancedSearchDialog.vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'
import { apiService } from '../services/apiService'
import { getStudentUID } from '../utils/uidFactory'
import * as d3 from 'd3'

const props = defineProps({
  selectedYear: {
    type: [String, Number],
    default: 'latest'
  },
  dataPackage: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['loading-change', 'data-loaded', 'show-last-modified'])

const loading = ref(false)
const dataLoaded = ref(false) // 追蹤資料是否已載入
const selectedYearSemester = ref('')
const yearSemesterOptions = ref([])
const currentStudentData = ref([])

// 追蹤是否是第一次載入資料
const isFirstDataLoad = ref(true)

// 簡易過濾器狀態 - 除了特教生外，其他都改為多選
const selectedClass = ref([])
const selectedSpecialEducation = ref('')
const selectedIndigenous = ref([])
const selectedGender = ref([])
const selectedLowIncome = ref([])

// 過濾選項列表
const classList = ref([])
const indigenousList = ref([])
const lowIncomeList = ref([])

const filters = ref({
  indigenous: '',
  specialEducation: '',
  lowIncome: ''
})
const crossFunctionalFilterActive = ref(false)

// 跨年份資料狀態
const crossYearData = ref([])
const hasCrossYearData = ref(false)

// D3.js 圖表實例
const chartInstances = ref({})

// 表格對話框狀態
const tableDialogVisible = ref(false)
const displayMode = ref('count') // 'count' 或 'percentage'
const currentTableData = ref([])
const currentTableTitle = ref('')
const currentTableTotal = ref(0)

// 圖表顯示模式（false: 絕對數字, true: 百分比）
const chartDisplayModes = ref({
  specialEducation: false,
  indigenous: false,
  lowIncome: false,
  selfStudy: false,
  age: false
})

// Inject cross-functional query functions
const crossFunctionalUIDs = inject('crossFunctionalUIDs', ref([]))
const isCrossFunctionalSelected = inject('isCrossFunctionalSelected', () => false)

// 多重條件搜尋功能
const {
  advancedConditions,
  showAdvancedDialog,
  applyAdvancedFilters,
  getAvailableFields,
  handleApplyFilters,
  showSearchDialog
} = useAdvancedSearch()

// 根據過濾條件篩選學生
const filteredStudents = computed(() => {
  if (!currentStudentData.value.length) return []
  
  return currentStudentData.value.filter(student => {
    // 原住民篩選
    if (filters.value.indigenous && filters.value.indigenous !== 'all') {
      if (filters.value.indigenous === 'none' && student.原住民) return false
      if (filters.value.indigenous === 'has' && !student.原住民) return false
      if (filters.value.indigenous !== 'has' && filters.value.indigenous !== 'none' && student.原住民 !== filters.value.indigenous) return false
    }
    
    // 特教生篩選
    if (filters.value.specialEducation && filters.value.specialEducation !== 'all') {
      const isSpecialEducation = student.特教生 && student.特教生 !== '' && student.特教生 !== '否'
      if (filters.value.specialEducation === 'true' && !isSpecialEducation) return false
      if (filters.value.specialEducation === 'false' && isSpecialEducation) return false
    }
    
    // 中低收篩選
    if (filters.value.lowIncome && filters.value.lowIncome !== 'all') {
      if (filters.value.lowIncome === 'none' && student.中低收) return false
      if (filters.value.lowIncome === 'has' && !student.中低收) return false
      if (filters.value.lowIncome !== 'has' && filters.value.lowIncome !== 'none' && student.中低收 !== filters.value.lowIncome) return false
    }
    
    return true
  })
})

// 經過多重條件篩選後的最終資料
const finalFilteredStudents = computed(() => {
  let data = filteredStudents.value
  
  // 套用簡易過濾器
  if (selectedClass.value && selectedClass.value.length > 0) {
    data = data.filter(student => {
      const studentClass = student.年班 || student.class
      return selectedClass.value.includes(studentClass)
    })
  }
  
  if (selectedSpecialEducation.value !== '') {
    data = data.filter(student => {
      const isSpecial = student.特教生 && student.特教生 !== '' && student.特教生 !== '否'
      return isSpecial === selectedSpecialEducation.value
    })
  }
  
  if (selectedIndigenous.value && selectedIndigenous.value.length > 0) {
    data = data.filter(student => {
      const indigenous = student.原住民 || student.indigenous
      return selectedIndigenous.value.includes(indigenous)
    })
  }
  
  if (selectedGender.value && selectedGender.value.length > 0) {
    data = data.filter(student => {
      const gender = student.性別 || student.gender
      return selectedGender.value.includes(gender)
    })
  }
  
  if (selectedLowIncome.value && selectedLowIncome.value.length > 0) {
    data = data.filter(student => {
      const lowIncomeValue = student.中低收 || student.lowIncome || ''
      return selectedLowIncome.value.includes(lowIncomeValue)
    })
  }
  
  // 套用多重條件篩選
  if (advancedConditions.value.length > 0) {
    data = applyAdvancedFilters(data)
  }
  
  // 套用跨功能查詢篩選 - 忽略所有過濾器，直接搜尋整個當學期名單資料表
  if (crossFunctionalFilterActive.value && crossFunctionalUIDs.value.length > 0) {
    console.log('當學期名單 - 跨功能篩選啟動，忽略所有過濾器搜尋整個資料表')
    const uidSet = new Set(crossFunctionalUIDs.value.map(item => item.uid))
    
    // 從完整的當學期資料中搜尋，忽略所有其他過濾器包括年份選擇器
    const completeCurrentData = props.dataPackage?.currentStudents?.data || []
    const matchedStudents = completeCurrentData.filter(student => {
      const uid = getStudentUID(student, 'currentStudent')
      const match = uid && uidSet.has(uid)
      return match
    })
    
    // 合併找到的學生和跨年份資料，並標記跨年份資料
    const crossYearStudentsMarked = crossYearData.value.map(student => ({
      ...student,
      _isCrossYear: true
    }))
    
    data = [...matchedStudents, ...crossYearStudentsMarked]
    console.log(`當學期名單 - 跨功能篩選：從完整資料表 ${completeCurrentData.length} 筆中找到 ${matchedStudents.length} 筆匹配，跨年份 ${crossYearStudentsMarked.length} 筆`)
    
    // 直接返回結果，不套用其他任何篩選器
    return data
  }
  
  return data
})

// 清除所有過濾器
const clearAllFilters = () => {
  // 清除簡易過濾器 - 多選改為空陣列
  selectedClass.value = []
  selectedSpecialEducation.value = ''
  selectedIndigenous.value = []
  selectedGender.value = []
  selectedLowIncome.value = []
  
  // 清除舊的過濾器
  filters.value = {
    indigenous: '',
    specialEducation: '',
    lowIncome: ''
  }
  
  // 清除跨功能查詢
  crossFunctionalFilterActive.value = false
  
  // 清除高級搜尋條件
  advancedConditions.value = []
  
  ElMessage.success('已清除所有過濾器')
}

// 切換跨功能查詢過濾器
const toggleCrossFunctionalFilter = () => {
  crossFunctionalFilterActive.value = !crossFunctionalFilterActive.value
  
  if (crossFunctionalFilterActive.value) {
    ElMessage.success(`已啟用跨功能篩選，顯示 ${crossFunctionalUIDs.value.length} 位學生`)
    // 觸發跨年份搜尋
    searchCrossYearData()
  } else {
    ElMessage.success('已關閉跨功能篩選，顯示全部學生')
    // 清除跨年份資料
    crossYearData.value = []
    hasCrossYearData.value = false
  }
}

// 計算學生類別統計
const calculateStudentCategoryStats = () => {
  if (!finalFilteredStudents.value.length) return {}
  
  const stats = {
    specialEducation: { regular: 0, special: 0 },
    indigenous: { regular: 0, indigenous: 0 },
    lowIncome: { regular: 0, lowIncome: 0, midLowIncome: 0 },
    selfStudy: { regular: 0, selfStudy: 0 },
    age: {}, // 動態年齡統計
    comprehensive: { regular: 0, special: 0, indigenous: 0, selfStudy: 0, lowIncome: 0 }
  }
  
  // 按班級分組的統計
  const statsByClass = {}
  
  finalFilteredStudents.value.forEach(student => {
    // 檢查各類別字段 - 簡化判斷邏輯
    const isSpecialEducation = student.特教生 && student.特教生 !== '' && student.特教生 !== '否'
    const isIndigenous = student.原住民 && student.原住民 !== '否' && student.原住民 !== ''
    const isSelfStudy = student.自學 && student.自學 !== '否' && student.自學 !== ''
    // 中低收分類：使用regex判斷
    const lowIncomeValue = student.中低收 || ''
    const isLowIncome = /^低收/.test(lowIncomeValue)  // 開頭是「低收」
    const isMidLowIncome = /^中低收/.test(lowIncomeValue)  // 開頭是「中低收」
    const hasAnyLowIncomeStatus = isLowIncome || isMidLowIncome
    
    // 獲取班級資訊（需要在年齡計算前定義）
    const studentClass = student.年班 || student.class || '未分班'
    
    // 初始化班級統計（必須在年齡計算前初始化）
    if (!statsByClass[studentClass]) {
      statsByClass[studentClass] = {
        regular: 0,
        special: 0,
        indigenous: 0,
        selfStudy: 0,
        lowIncome: 0,
        midLowIncome: 0,
        total: 0
      }
    }
    
    // 年齡計算 - 不預設分組，按實際年齡統計
    const birthDate = student.出生年月日 || student.birthDate
    let age = null
    if (birthDate) {
      try {
        // 將數字轉換為字串
        let birthDateStr = String(birthDate).trim()
        
        // 確保是純數字格式
        if (!/^\d+$/.test(birthDateStr)) {
          throw new Error('非數字格式')
        }
        
        // 如果是數字且少於6位，前面補零到6位
        if (birthDateStr.length < 6) {
          birthDateStr = birthDateStr.padStart(6, '0')
        }
        
        let rocYear, month, day, birthYear
        
        // 處理不同長度的ROC年月日格式
        if (birthDateStr.length === 6) {
          // 6位數格式: YYMMDD (如 "970713" = 民國97年7月13日)
          rocYear = parseInt(birthDateStr.substring(0, 2))
          month = parseInt(birthDateStr.substring(2, 4))
          day = parseInt(birthDateStr.substring(4, 6))
        } else if (birthDateStr.length === 7) {
          // 7位數格式: YYYMMDD (如 "1000101" = 民國100年01月01日)
          rocYear = parseInt(birthDateStr.substring(0, 3))
          month = parseInt(birthDateStr.substring(3, 5))
          day = parseInt(birthDateStr.substring(5, 7))
        } else {
          // 其他長度，嘗試智能解析
          if (birthDateStr.length >= 8) {
            // 8位數或更長，可能是錯誤格式，截取前7位
            birthDateStr = birthDateStr.substring(0, 7)
            rocYear = parseInt(birthDateStr.substring(0, 3))
            month = parseInt(birthDateStr.substring(3, 5))
            day = parseInt(birthDateStr.substring(5, 7))
          } else {
            throw new Error('無法解析的日期格式')
          }
        }
        
        // 驗證月日的合理性
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          throw new Error('月日數值不合理')
        }
        
        birthYear = rocYear + 1911
        
        // 計算年齡（簡化版，使用當前年份減去出生年）
        const currentYear = new Date().getFullYear()
        age = currentYear - birthYear
        
        // 初始化統計物件中的年齡欄位
        const ageKey = `${age}歲`
        if (!stats.age[ageKey]) stats.age[ageKey] = 0
        if (!statsByClass[studentClass][ageKey]) statsByClass[studentClass][ageKey] = 0
        
        // 除錯：記錄年齡計算  
        if (Math.random() < 0.1) { // 只記錄10%的資料避免過多log
          console.log('年齡計算:', { 
            原始資料: birthDate,
            處理後: birthDateStr, 
            ROC年: rocYear, 
            西元年: birthYear, 
            計算年齡: age, 
            年齡鍵: ageKey, 
            班級: studentClass 
          })
        }
      } catch (error) {
        console.warn('年齡計算錯誤:', birthDate)
      }
    }
    
    // 一般生判定：所有特殊類別都為空或否
    const isRegular = !isSpecialEducation && !isIndigenous && !isSelfStudy && !hasAnyLowIncomeStatus
    
    
    // 班級統計
    statsByClass[studentClass].total++
    if (isRegular) {
      statsByClass[studentClass].regular++
    } else {
      if (isSpecialEducation) statsByClass[studentClass].special++
      if (isIndigenous) statsByClass[studentClass].indigenous++
      if (isSelfStudy) statsByClass[studentClass].selfStudy++
      if (isLowIncome) statsByClass[studentClass].lowIncome++
      if (isMidLowIncome) statsByClass[studentClass].midLowIncome++
    }
    
    // 年齡統計（對所有學生統計，不分一般生或特殊生）
    if (age !== null) {
      const ageKey = `${age}歲`
      statsByClass[studentClass][ageKey]++
    }
    
    // 特教生統計
    if (isSpecialEducation) {
      stats.specialEducation.special++
    } else {
      stats.specialEducation.regular++
    }
    
    // 原住民統計
    if (isIndigenous) {
      stats.indigenous.indigenous++
    } else {
      stats.indigenous.regular++
    }
    
    // 自學生統計
    if (isSelfStudy) {
      stats.selfStudy.selfStudy++
    } else {
      stats.selfStudy.regular++
    }
    
    // 中低收統計 - 三分類
    if (isLowIncome) {
      stats.lowIncome.lowIncome++
    } else if (isMidLowIncome) {
      stats.lowIncome.midLowIncome++
    } else {
      stats.lowIncome.regular++
    }
    
    // 年齡統計
    if (age !== null) {
      const ageKey = `${age}歲`
      stats.age[ageKey]++
    }
    
    // 綜合統計
    if (isRegular) {
      stats.comprehensive.regular++
    } else {
      if (isSpecialEducation) stats.comprehensive.special++
      if (isIndigenous) stats.comprehensive.indigenous++
      if (isSelfStudy) stats.comprehensive.selfStudy++
      if (isLowIncome || isMidLowIncome) stats.comprehensive.lowIncome++
    }
  })
  
  // 添加按班級分組的統計到返回值
  stats.byClass = statsByClass
  
  // 除錯：檢查年齡統計
  console.log('年齡統計結果:', stats.age)
  console.log('班級年齡統計:', Object.keys(statsByClass).map(cls => ({
    class: cls,
    ages: Object.keys(statsByClass[cls]).filter(key => key.endsWith('歲'))
  })))
  
  return stats
}

// 創建堆疊條形圖 (使用D3.js) - 按班級分組
const createStackedBarChart = (canvasId, categoryType, stats, isPercentage = false) => {
  const container = document.getElementById(canvasId)
  if (!container) return null
  
  // 清除現有圖表
  if (chartInstances.value[canvasId]) {
    d3.select(`#${canvasId}`).selectAll('*').remove()
  }
  
  const classCategoryData = stats.byClass || {}
  if (Object.keys(classCategoryData).length === 0) return null
  
  // 設置圖表尺寸和邊距
  const margin = { top: 20, right: 20, bottom: 60, left: 60 }
  const width = container.offsetWidth - margin.left - margin.right
  const height = container.offsetHeight - margin.top - margin.bottom
  
  // 創建SVG
  const svg = d3.select(`#${canvasId}`)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)
  
  // 根據類型準備數據
  const classes = Object.keys(classCategoryData).sort()
  let data, labels, colors
  
  switch (categoryType) {
    case 'specialEducation':
      data = classes.map(cls => [classCategoryData[cls].regular, classCategoryData[cls].special])
      labels = ['一般生', '特教生']
      colors = ['#409EFF', '#E6A23C']
      break
    case 'indigenous':
      data = classes.map(cls => [classCategoryData[cls].regular, classCategoryData[cls].indigenous])
      labels = ['一般生', '原住民']
      colors = ['#409EFF', '#67C23A']
      break
    case 'lowIncome':
      data = classes.map(cls => [classCategoryData[cls].regular, classCategoryData[cls].lowIncome, classCategoryData[cls].midLowIncome])
      labels = ['一般生', '低收', '中低收']
      colors = ['#409EFF', '#F56C6C', '#FF7F00']
      break
    case 'selfStudy':
      data = classes.map(cls => [classCategoryData[cls].regular, classCategoryData[cls].selfStudy])
      labels = ['一般生', '自學生']
      colors = ['#409EFF', '#909399']
      break
    case 'age':
      // 動態獲取所有年齡分組
      const allAges = new Set()
      Object.values(classCategoryData).forEach(classData => {
        Object.keys(classData).forEach(key => {
          if (key.endsWith('歲')) {
            allAges.add(key)
          }
        })
      })
      const sortedAges = Array.from(allAges).sort((a, b) => {
        const ageA = parseInt(a.replace('歲', ''))
        const ageB = parseInt(b.replace('歲', ''))
        return ageA - ageB
      })
      
      // 除錯：年齡圖表數據
      console.log('年齡圖表 - 所有年齡:', sortedAges)
      console.log('年齡圖表 - 班級數據:', classCategoryData)
      
      data = classes.map(cls => 
        sortedAges.map(ageKey => classCategoryData[cls][ageKey] || 0)
      )
      labels = sortedAges
      // 為不同年齡生成顏色
      const colorPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#F39C12', '#8E44AD', '#E67E22', '#2ECC71', '#E74C3C']
      colors = sortedAges.map((_, index) => colorPalette[index % colorPalette.length])
      
      console.log('年齡圖表最終數據:', { data, labels, colors })
      break
  }
  
  // 設置比例尺
  const xScale = d3.scaleBand()
    .range([0, width])
    .domain(classes)
    .padding(0.1)
  
  const yScale = d3.scaleLinear()
    .range([height, 0])
    .domain([0, isPercentage ? 100 : d3.max(data.flat())])
  
  // 創建工具提示
  const tooltip = d3.select('body').append('div')
    .attr('class', 'd3-tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'rgba(0, 0, 0, 0.8)')
    .style('color', 'white')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('z-index', '9999')
  
  // 繪製堆疊條形圖
  classes.forEach((className, classIndex) => {
    const classTotal = data[classIndex].reduce((sum, val) => sum + val, 0)
    let cumulative = 0
    
    data[classIndex].forEach((value, categoryIndex) => {
      if (value > 0) {
        const percentage = ((value / classTotal) * 100).toFixed(1)
        const displayValue = isPercentage ? parseFloat(percentage) : value
        
        g.append('rect')
          .attr('class', 'bar-segment')
          .attr('x', xScale(className))
          .attr('y', yScale(cumulative + displayValue))
          .attr('width', xScale.bandwidth())
          .attr('height', yScale(cumulative) - yScale(cumulative + displayValue))
          .attr('fill', colors[categoryIndex])
          .on('mouseover', function(event) {
            tooltip.transition()
              .duration(200)
              .style('opacity', .9)
            const tooltipText = isPercentage 
              ? `${className}<br/>${labels[categoryIndex]}: ${percentage}% (${value}人)`
              : `${className}<br/>${labels[categoryIndex]}: ${value}人 (${percentage}%)`
            tooltip.html(tooltipText)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px')
          })
          .on('mouseout', function() {
            tooltip.transition()
              .duration(500)
              .style('opacity', 0)
          })
        
        cumulative += displayValue
      }
    })
  })
  
  // 添加X軸
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .append('text')
    .attr('x', width / 2)
    .attr('y', 35)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .text('班級')
  
  // 添加Y軸
  g.append('g')
    .call(d3.axisLeft(yScale).tickFormat(isPercentage ? d => `${d}%` : d3.format('d')))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -35)
    .attr('x', -height / 2)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .text(isPercentage ? '百分比 (%)' : '學生人數')
  
  // 添加圖例
  const legend = g.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(0, ${height + 40})`)
  
  const legendItems = legend.selectAll('.legend-item')
    .data(labels.map((label, i) => ({ label, color: colors[i] })))
    .enter().append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(${i * 80}, 0)`)
  
  legendItems.append('rect')
    .attr('width', 12)
    .attr('height', 12)
    .attr('fill', d => d.color)
  
  legendItems.append('text')
    .attr('x', 16)
    .attr('y', 10)
    .style('font-size', '12px')
    .text(d => d.label)
  
  // 存儲圖表實例
  chartInstances.value[canvasId] = { svg, tooltip }
  
  return { svg, tooltip }
}


// 渲染所有圖表
const renderCharts = async () => {
  await nextTick() // 確保DOM已更新
  
  const stats = calculateStudentCategoryStats()
  if (!stats || Object.keys(stats).length === 0) return
  
  // 所有圖表都改為按班級分組，並根據顯示模式渲染
  createStackedBarChart('special-education-chart', 'specialEducation', stats, chartDisplayModes.value.specialEducation)
  createStackedBarChart('indigenous-chart', 'indigenous', stats, chartDisplayModes.value.indigenous)
  createStackedBarChart('low-income-chart', 'lowIncome', stats, chartDisplayModes.value.lowIncome)
  createStackedBarChart('self-study-chart', 'selfStudy', stats, chartDisplayModes.value.selfStudy)
  createStackedBarChart('age-chart', 'age', stats, chartDisplayModes.value.age)
}

// 銷毀所有圖表
const destroyCharts = () => {
  Object.keys(chartInstances.value).forEach(canvasId => {
    const chart = chartInstances.value[canvasId]
    if (chart) {
      // 移除SVG元素
      d3.select(`#${canvasId}`).selectAll('*').remove()
      // 移除工具提示
      if (chart.tooltip) {
        chart.tooltip.remove()
      }
    }
  })
  chartInstances.value = {}
}

// 生成基於班級的表格數據
const generateClassBasedTableData = (classCategoryData, categories, categoryLabels) => {
  const tableData = []
  
  Object.keys(classCategoryData).sort().forEach(className => {
    const classData = classCategoryData[className]
    const classTotal = classData.total
    
    categories.forEach((category, index) => {
      const count = classData[category] || 0
      if (count > 0) {
        tableData.push({
          category: `${className} - ${categoryLabels[index]}`,
          count: count,
          percentage: `${((count / classTotal) * 100).toFixed(1)}%`
        })
      }
    })
  })
  
  return tableData
}

// 顯示表格對話框
const showTableDialog = (chartType) => {
  const stats = calculateStudentCategoryStats()
  if (!stats || Object.keys(stats).length === 0) return
  
  let tableData = []
  let title = ''
  
  switch (chartType) {
    case 'specialEducation':
      title = '一般生 / 特教生（按班級分組）'
      tableData = generateClassBasedTableData(stats.byClass, ['regular', 'special'], ['一般生', '特教生'])
      currentTableTotal.value = Object.values(stats.byClass).reduce((sum, classData) => sum + classData.total, 0)
      break
      
    case 'indigenous':
      title = '一般生 / 原住民（按班級分組）'
      tableData = generateClassBasedTableData(stats.byClass, ['regular', 'indigenous'], ['一般生', '原住民'])
      currentTableTotal.value = Object.values(stats.byClass).reduce((sum, classData) => sum + classData.total, 0)
      break
      
    case 'lowIncome':
      title = '一般生 / 低收 / 中低收（按班級分組）'
      tableData = generateClassBasedTableData(stats.byClass, ['regular', 'lowIncome', 'midLowIncome'], ['一般生', '低收', '中低收'])
      currentTableTotal.value = Object.values(stats.byClass).reduce((sum, classData) => sum + classData.total, 0)
      break
      
    case 'selfStudy':
      title = '一般生 / 自學生（按班級分組）'
      tableData = generateClassBasedTableData(stats.byClass, ['regular', 'selfStudy'], ['一般生', '自學生'])
      currentTableTotal.value = Object.values(stats.byClass).reduce((sum, classData) => sum + classData.total, 0)
      break
      
    case 'age':
      title = '年齡分布（按班級分組）'
      // 動態獲取所有年齡分組
      const allAgeGroups = new Set()
      Object.values(stats.byClass).forEach(classData => {
        Object.keys(classData).forEach(key => {
          if (key.endsWith('歲')) {
            allAgeGroups.add(key)
          }
        })
      })
      const sortedAgeGroups = Array.from(allAgeGroups).sort((a, b) => {
        const ageA = parseInt(a.replace('歲', ''))
        const ageB = parseInt(b.replace('歲', ''))
        return ageA - ageB
      })
      
      tableData = generateClassBasedTableData(stats.byClass, sortedAgeGroups, sortedAgeGroups)
      currentTableTotal.value = Object.values(stats.byClass).reduce((sum, classData) => sum + classData.total, 0)
      break
  }
  
  currentTableData.value = tableData
  currentTableTitle.value = title
  tableDialogVisible.value = true
}

// 下載CSV文件
const downloadCSV = () => {
  if (!currentTableData.value.length) return
  
  const headers = ['類別', '人數', '百分比']
  const csvContent = [
    headers.join(','),
    ...currentTableData.value.map(row => [
      `"${row.category}"`,
      row.count,
      `"${row.percentage}"`
    ].join(','))
  ].join('\n')
  
  // 添加BOM以支持中文顯示
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${currentTableTitle.value}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// 搜尋跨年份資料
const searchCrossYearData = async () => {
  if (!crossFunctionalUIDs.value.length) return
  
  const uidSet = new Set(crossFunctionalUIDs.value.map(item => item.uid))
  
  // 找出所有已載入資料（包含所有年份）中沒有的 UID
  const allCurrentData = props.dataPackage?.currentStudents?.data || []
  const foundUIDs = new Set()
  allCurrentData.forEach(student => {
    const uid = student.身分證字號 || student.學號 || student.studentId || student.nationalId || student.身分證統一編號
    if (uid && uidSet.has(uid)) foundUIDs.add(uid)
  })
  
  const missingUIDs = [...uidSet].filter(uid => !foundUIDs.has(uid))
  
  if (missingUIDs.length === 0) {
    crossYearData.value = []
    hasCrossYearData.value = false
    return
  }
  
  try {
    loading.value = true
    console.log('搜尋跨年份資料:', missingUIDs)
    
    const result = await apiService.searchCrossYearCurrentStudents({
      uids: missingUIDs,
      currentYearSemester: selectedYearSemester.value
    })
    
    if (result.success && result.students) {
      crossYearData.value = result.students.map(student => ({
        ...student,
        _isCrossYear: true, // 標記為跨年份資料
        _originalYearSemester: student.資料年份 && student.資料學期 ? 
          `${student.資料年份}第${student.資料學期 === 1 ? '一' : '二'}學期` : '未知年份'
      }))
      
      hasCrossYearData.value = crossYearData.value.length > 0
      
      if (crossYearData.value.length > 0) {
        ElMessage.success(`找到 ${crossYearData.value.length} 筆跨年份資料`)
      }
    } else {
      crossYearData.value = []
      hasCrossYearData.value = false
    }
  } catch (error) {
    console.error('搜尋跨年份資料失敗:', error)
    ElMessage.warning('搜尋跨年份資料失敗')
    crossYearData.value = []
    hasCrossYearData.value = false
  } finally {
    loading.value = false
  }
}

// 處理年份學期變更
const handleYearSemesterChange = (value) => {
  console.log('選擇年份學期:', value)
  // 切換年份學期時重置第一次載入標記，這樣會再次顯示最後更新時間
  isFirstDataLoad.value = true
  loadCurrentStudentData(value)
}

// 處理篩選變更
const handleFilterChange = (newFilters) => {
  filters.value = { ...newFilters }
}

// 載入學生名單總表數據
const loadCurrentStudentData = async (yearSemesterKey = null, forceReload = false) => {
  // 智能載入：如果已有資料且非強制重載，則跳過
  if (dataLoaded.value && !forceReload && !yearSemesterKey) {
    console.log('📦 CurrentStudentDashboard: 資料已載入，跳過重複載入')
    return
  }
  try {
    console.log('=== loadCurrentStudentData 呼叫 ===')
    console.log('yearSemesterKey:', yearSemesterKey)
    console.log('props.dataPackage 存在:', !!props.dataPackage)
    console.log('props.dataPackage.currentStudents 存在:', !!props.dataPackage?.currentStudents)
    
    loading.value = true
    emit('loading-change', true)
    
    // 如果選擇了特定學期且不是 'all'，則向後端請求該學期的數據
    if (yearSemesterKey && yearSemesterKey !== 'all') {
      console.log(`🔄 向後端請求 ${yearSemesterKey} 學期的數據...`)
      
      try {
        const result = await apiService.getCurrentStudentList(yearSemesterKey)
        
        if (result.success && result.data) {
          currentStudentData.value = result.data
          console.log(`✅ 成功載入 ${yearSemesterKey} 學期數據，學生數量:`, result.data.length)
          generateFilterOptions()
        } else {
          console.error('載入學期數據失敗:', result.error)
          ElMessage.error(`載入 ${yearSemesterKey} 學期數據失敗`)
          currentStudentData.value = []
        }
      } catch (error) {
        console.error('請求學期數據失敗:', error)
        ElMessage.error('請求失敗，請稍後再試')
        currentStudentData.value = []
      }
      
      return // 不繼續執行下面的邏輯
    }
    
    if (props.dataPackage && props.dataPackage.currentStudents) {
      console.log('=== 使用數據包中的學生名單總表數據 ===')
      console.log('currentStudents 結構:', {
        dataLength: props.dataPackage.currentStudents.data?.length,
        byYearSemesterKeys: Object.keys(props.dataPackage.currentStudents.byYearSemester || {}),
        count: props.dataPackage.currentStudents.count
      })
      
      if (yearSemesterKey && yearSemesterKey !== 'all') {
        // 根據選擇的年份-學期過濾數據
        const byYearSemester = props.dataPackage.currentStudents.byYearSemester
        console.log('過濾年份學期:', yearSemesterKey)
        console.log('可用的年份學期:', Object.keys(byYearSemester))
        
        const yearSemesterData = byYearSemester[yearSemesterKey]
        console.log(`byYearSemester[${yearSemesterKey}] 結構:`, yearSemesterData)
        console.log('結構包含的屬性:', yearSemesterData ? Object.keys(yearSemesterData) : 'undefined')
        
        if (yearSemesterData && typeof yearSemesterData === 'object' && Object.keys(yearSemesterData).length > 0) {
          // 後端返回的結構是: { [yearSemester]: byGrade }
          // 其中 byGrade 是按年級分類的物件: { '1': [...], '2': [...], '3': [...] }
          const allStudents = []
          Object.keys(yearSemesterData).forEach(grade => {
            if (Array.isArray(yearSemesterData[grade])) {
              allStudents.push(...yearSemesterData[grade])
            }
          })
          currentStudentData.value = allStudents
          console.log(`載入指定年份學期數據，年級: ${Object.keys(yearSemesterData).join(', ')}，學生總數量:`, allStudents.length)
          generateFilterOptions()
        } else {
          // 如果 byYearSemester 中沒有對應的數據，但我們知道是單一學期的數據
          // 直接使用全部數據
          console.log('指定年份學期在 byYearSemester 中不存在或為空，使用全部數據')
          currentStudentData.value = props.dataPackage.currentStudents.data || []
          console.log('從全部數據載入學期數據，學生數量:', currentStudentData.value.length)
          generateFilterOptions()
        }
      } else {
        // 顯示所有數據
        currentStudentData.value = props.dataPackage.currentStudents.data || []
        console.log('載入全部數據，學生總數量:', currentStudentData.value.length)
        generateFilterOptions()
        
        // 調試：檢查學生數據結構
        if (currentStudentData.value.length > 0) {
          console.log('前3筆學生數據範例:');
          currentStudentData.value.slice(0, 3).forEach((student, index) => {
            console.log(`學生 ${index + 1}:`, student);
            console.log(`學生 ${index + 1} 欄位:`, Object.keys(student));
          });
        }
      }
      
      // 生成年份學期選項
      generateYearSemesterOptions()
      
      // 標記資料已載入
      if (!yearSemesterKey) {
        dataLoaded.value = true
      }
    } else {
      console.log('=== 數據包中沒有學生名單總表數據 ===')
      if (props.dataPackage) {
        console.log('數據包存在但缺少 currentStudents，數據包包含:', Object.keys(props.dataPackage))
      } else {
        console.log('數據包完全不存在')
      }
      currentStudentData.value = []
      yearSemesterOptions.value = []
    }
  } catch (error) {
    console.error('載入學生名單總表數據失敗:', error)
    ElMessage.error('載入學生名單總表數據失敗')
    currentStudentData.value = []
  } finally {
    loading.value = false
    emit('loading-change', false)
    if (currentStudentData.value.length > 0) {
      emit('data-loaded')
      // 渲染圖表
      setTimeout(() => {
        renderCharts()
        // 只在第一次載入資料時顯示最後更新時間
        if (isFirstDataLoad.value) {
          setTimeout(() => {
            emit('show-last-modified')
            isFirstDataLoad.value = false
          }, 500)
        }
      }, 500)
    }
  }
}

// 生成過濾器選項
const generateFilterOptions = () => {
  if (!currentStudentData.value.length) return
  
  // 提取班級選項
  const classSet = new Set()
  const indigenousSet = new Set()
  const lowIncomeSet = new Set()
  
  currentStudentData.value.forEach(student => {
    // 班級
    const studentClass = student.年班 || student.class
    if (studentClass) {
      classSet.add(studentClass)
    }
    
    // 原住民
    const indigenous = student.原住民 || student.indigenous
    if (indigenous) {
      indigenousSet.add(indigenous)
    }
    
    // 中低收
    const lowIncome = student.中低收 || student.lowIncome
    if (lowIncome) {
      lowIncomeSet.add(lowIncome)
    }
  })
  
  classList.value = Array.from(classSet).sort()
  indigenousList.value = Array.from(indigenousSet).sort()
  lowIncomeList.value = Array.from(lowIncomeSet).sort()
  
  console.log('生成過濾器選項:', {
    班級數: classList.value.length,
    原住民類型: indigenousList.value.length,
    中低收類型: lowIncomeList.value.length
  })
}

// 生成年份學期選項
const generateYearSemesterOptions = () => {
  if (!props.dataPackage || !props.dataPackage.currentStudents) return
  
  const options = [
    { label: '所有年份學期', value: 'all' }
  ]
  
  // 使用從後端傳來的 availableYears 資訊
  const availableYears = props.dataPackage.currentStudents.availableYears
  if (availableYears && Array.isArray(availableYears) && availableYears.length > 0) {
    availableYears.forEach(yearInfo => {
      if (yearInfo && yearInfo.label && yearInfo.value) {
        options.push({
          label: yearInfo.label, // 使用轉換後的顯示標籤 (e.g., "2025第一學期")
          value: yearInfo.value  // 使用原始格式 (e.g., "114-1")
        })
      }
    })
    console.log('使用後端提供的年份資訊:', availableYears)
  }
  
  // 備用方案：從 byYearSemester 中提取（當 availableYears 無效時）
  const byYearSemester = props.dataPackage.currentStudents.byYearSemester
  if (byYearSemester && typeof byYearSemester === 'object') {
    const hasValidAvailableYears = availableYears && Array.isArray(availableYears) && availableYears.length > 0
    
    if (!hasValidAvailableYears) {
      console.log('後端 availableYears 無效，使用備用方案從 byYearSemester 提取')
      Object.keys(byYearSemester)
        .sort((a, b) => {
          const [yearA, semesterA] = a.split('-').map(Number)
          const [yearB, semesterB] = b.split('-').map(Number)
          if (yearB !== yearA) return yearB - yearA
          return semesterB - semesterA
        })
        .forEach(key => {
          const [year, semester] = key.split('-')
          const gregorianYear = parseInt(year) + 1911
          const semesterText = semester === '1' ? '第一學期' : '第二學期'
          options.push({
            label: `${gregorianYear}${semesterText}`,
            value: key
          })
        })
    }
  }
  
  console.log('終最生成的年份選項:', options)
  
  yearSemesterOptions.value = options
  
  // 預設選擇最新的年份學期
  if (options.length > 1 && !selectedYearSemester.value) {
    selectedYearSemester.value = options[1].value
    handleYearSemesterChange(options[1].value)
  }
}

// 監聽數據包變化
watch(() => props.dataPackage, (newDataPackage) => {
  console.log('=== props.dataPackage 變化 ===')
  console.log('新數據包存在:', !!newDataPackage)
  console.log('新數據包包含 currentStudents:', !!newDataPackage?.currentStudents)
  
  if (newDataPackage && newDataPackage.currentStudents) {
    console.log('數據包更新，重新載入學生名單總表數據')
    dataLoaded.value = false // 重置載入狀態
    loadCurrentStudentData()
  }
}, { deep: true })

// 監聽跨功能查詢條件變化
watch(crossFunctionalUIDs, () => {
  if (crossFunctionalFilterActive.value) {
    searchCrossYearData()
  }
}, { deep: true })

// 監聽過濾結果變化，更新圖表
watch(finalFilteredStudents, () => {
  if (finalFilteredStudents.value.length > 0) {
    setTimeout(() => renderCharts(), 100)
  } else {
    destroyCharts()
  }
}, { deep: true })

// 監聽跨功能篩選狀態變化，更新圖表
watch(crossFunctionalFilterActive, () => {
  setTimeout(() => renderCharts(), 100)
})

// 監聽圖表顯示模式變化，重新渲染圖表
watch(chartDisplayModes, () => {
  setTimeout(() => renderCharts(), 100)
}, { deep: true })

// 組件掛載時載入數據
onMounted(() => {
  console.log('=== CurrentStudentDashboard onMounted ===')
  console.log('掛載時 props.dataPackage 存在:', !!props.dataPackage)
  console.log('掛載時 props.dataPackage.currentStudents 存在:', !!props.dataPackage?.currentStudents)
  
  if (props.dataPackage && props.dataPackage.currentStudents) {
    console.log('掛載時開始載入數據')
    loadCurrentStudentData()
  } else {
    console.log('掛載時沒有可用的數據包，等待數據包載入')
  }
})

// 組件卸載時清理圖表
onUnmounted(() => {
  destroyCharts()
})
</script>

<style scoped>
.section-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.section-title {
  margin-bottom: 16px;
  color: #303133;
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.button-group {
  display: flex;
  gap: 10px;
}

.filter-item {
  margin-bottom: 10px;
}

.filter-item label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #606266;
  font-size: 14px;
}

.chart-container {
  padding: 15px;
  border-radius: 8px;
  background-color: #f9f9f9;
  height: 350px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.chart-title {
  margin: 0;
  color: #303133;
  font-weight: 600;
  font-size: 14px;
  flex: 1;
  text-align: left;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chart-switch {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.chart-switch span {
  white-space: nowrap;
}

/* D3.js 圖表樣式 */
.bar-segment {
  cursor: pointer;
  transition: opacity 0.2s;
}

.bar-segment:hover {
  opacity: 0.8;
}

.d3-tooltip {
  font-family: Arial, sans-serif;
}

.legend text {
  fill: #333;
  font-family: Arial, sans-serif;
}

.drawer-footer {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  margin: 0 -16px -16px -16px;
}
</style>