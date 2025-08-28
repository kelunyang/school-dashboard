<template>
  <div>
    <!-- 班級過濾器和搜尋功能 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>分科成績統計 - {{ getYearDisplayText() }}</span>
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
                  清除篩選器
                </el-button>
                <el-button 
                  type="primary" 
                  @click="showSearchDialog"
                  :icon="Search"
                  size="small"
                >
                  多重條件搜尋器
                </el-button>
              </div>
            </div>
          </template>
          
          <!-- 過濾器區域 -->
          <el-row :gutter="20" style="margin-bottom: 20px;">
            <el-col :span="12">
              <el-select 
                v-model="selectedClass" 
                placeholder="選擇班級"
                clearable
                @change="handleClassChange"
                style="width: 100%"
              >
                <el-option label="全部班級" value="" />
                <el-option
                  v-for="cls in classList"
                  :key="cls"
                  :label="`${cls}班`"
                  :value="cls"
                />
              </el-select>
            </el-col>
            
            <el-col :span="12">
              <el-input
                v-model="searchQuery"
                placeholder="搜尋姓名、班級座號或報名序號"
                clearable
                @input="handleSearch"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </el-col>
            
          </el-row>
          
          <!-- 成績篩選器區域 -->
          <el-row style="margin-top: 16px;">
            <el-col :span="24">
              <div class="score-filters">
                <span class="filter-label">成績篩選：</span>
                <div class="filter-buttons">
                  <ScoreFilter
                    v-for="subject in stSubjects"
                    :key="subject.key"
                    :subject-name="subject.name"
                    :subject-key="subject.key"
                    :max-range="60"
                    v-model="scoreFilters[subject.key]"
                    @filter-change="handleScoreFilterChange"
                  />
                </div>
              </div>
            </el-col>
          </el-row>
          
        </el-card>
      </el-col>
    </el-row>

    <!-- 學生列表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <STList 
          :selected-year="props.selectedYear"
          :data-package="props.dataPackage"
          :students="filteredStudents"
          @filter-change="handleFilterChange"
        />
      </el-col>
    </el-row>

    <!-- 科目分數圖表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col 
        v-for="subject in stSubjects" 
        :key="subject.key"
        :xs="24" 
        :sm="24" 
        :md="12" 
        :lg="12" 
        :xl="12"
        style="margin-bottom: 20px;"
      >
        <ChartWrapper 
          :title="`分科成績統計 - ${subject.name}`" 
          :file-name="`st_score_${subject.key}`"
          :show-percentage-toggle="true"
          v-model="chartPercentageMode[subject.key]"
        >
          <STSubjectChart
            :subject-name="subject.name"
            :subject-key="subject.key"
            :scores="getSubjectScores(subject.key)"
            :benchmark="getBenchmark(subject.key)"
            :loading="loading"
            :percentage-mode="chartPercentageMode[subject.key]"
          />
        </ChartWrapper>
      </el-col>
    </el-row>
    
    <!-- 多重條件搜尋對話框 -->
    <AdvancedSearchDialog
      v-model:visible="showAdvancedDialog"
      :available-fields="getAvailableFields(students)"
      storage-key="stScoreAdvancedFilters"
      @apply-filters="handleApplyFilters"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ChartWrapper from './ChartWrapper.vue'
import STList from './STListTanstack.vue'
import STSubjectChart from './STSubjectChart.vue'
import ScoreFilter from './ScoreFilter.vue'
import AdvancedSearchDialog from './AdvancedSearchDialog.vue'
import { apiService } from '../services/apiService'
import { optimizedApiService } from '../services/optimizedApiService'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

const props = defineProps({
  selectedYear: {
    type: [String, Number, Array],  // 支援單選和多選
    default: 'latest'
  },
  dataPackage: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['loading-change', 'data-loaded', 'show-last-modified'])

const handleFilterChange = (filters) => {
  // STDashboard 目前不需要處理 filter change
  console.log('STDashboard - Filter change:', filters)
}

// 注入跨功能選擇相關功能
const selectedStudents = inject('selectedStudents')
const lockedStudents = inject('lockedStudents')

// 注入跨功能查詢 UID 系統
const crossFunctionalUIDs = inject('crossFunctionalUIDs', () => ref([]))
const crossFunctionalFilterActive = ref(false)

const stListRef = ref()
const loading = ref(true)

// 分科測驗科目定義（動態從資料中提取）
const stSubjects = ref([])

// 成績篩選器狀態
const scoreFilters = ref({})

// 圖表百分比模式狀態
const chartPercentageMode = ref({})

// 從benchmark和學生資料中提取學科欄位
const extractSubjects = (studentsData, benchmarksData) => {
  if (!studentsData || studentsData.length === 0) return []
  
  const subjects = []
  
  // 從所有學生資料中收集完整的欄位列表（避免因 null 值導致欄位遺失）
  const allHeaders = new Set()
  studentsData.forEach(student => {
    Object.keys(student).forEach(key => allHeaders.add(key))
  })
  const studentHeaders = Array.from(allHeaders)
  
  console.log('從所有學生資料收集到的完整欄位列表:', studentHeaders)
  
  // 提取所有以「級分」結尾的欄位作為分科科目
  const subjectSet = new Set()
  
  studentHeaders.forEach(header => {
    // 找出所有以「級分」結尾的欄位（分科科目）
    if (header.endsWith('級分')) {
      subjectSet.add(header)
      console.log(`找到分科級分欄位: ${header}`)
    }
  })
  
  // 從 benchmark 資料中匹配科目名稱
  if (benchmarksData && Object.keys(benchmarksData).length > 0) {
    const anyYear = Object.keys(benchmarksData)[0]
    const yearBenchmarks = benchmarksData[anyYear]
    
    if (yearBenchmarks) {
      subjectSet.forEach(header => {
        // 只去掉結尾的「級分」，提取科目名稱
        const subjectName = header.replace(/級分$/, '').trim()
        
        // 跳過空白科目名稱
        if (subjectName) {
          subjects.push({
            key: header,
            name: subjectName,
            benchmarkKey: subjectName
          })
          
          // 檢查是否有 benchmark 資料
          if (yearBenchmarks[subjectName]) {
            console.log(`分科科目（有五標）: ${subjectName} -> ${header}`)
          } else {
            console.log(`分科科目（無五標）: ${subjectName} -> ${header}`)
          }
        }
      })
    }
  } else {
    // 如果完全沒有 benchmark，直接使用所有級分科目
    subjectSet.forEach(header => {
      const subjectName = header.replace(/級分$/, '').trim()
      if (subjectName) {
        subjects.push({
          key: header,
          name: subjectName,
          benchmarkKey: subjectName
        })
        console.log(`分科科目（無五標資料）: ${subjectName} -> ${header}`)
      }
    })
  }
  
  // 如果沒有從benchmark找到科目，回退到原來的方式
  if (subjects.length === 0) {
    studentHeaders.forEach(key => {
      // 跳過非學科欄位
      if (['registrationNumber', 'name', 'examNumber', 'examYear', 'idNumber', 'class'].includes(key)) {
        return
      }
      
      // 如果是學科欄位（包含級分或者是已知的學科英文名稱）
      if (key.includes('級分') || 
          ['mathA', 'chemistry', 'physics', 'biology', 'history', 'geography', 'civics'].includes(key)) {
        const subjectName = getSubjectChineseName(key)
        subjects.push({
          key: key,
          name: subjectName,
          benchmarkKey: key // 如果沒有benchmark，使用完整欄位名稱
        })
      }
    })
  }
  
  console.log('最終提取的科目列表:', subjects)
  return subjects
}

// 學科英文轉中文對應
const getSubjectChineseName = (key) => {
  const mapping = {
    'mathA': '數學A',
    'chemistry': '化學',
    'physics': '物理', 
    'biology': '生物',
    'history': '歷史',
    'geography': '地理',
    'civics': '公民與社會'
  }
  
  // 如果包含級分，直接使用欄位名稱
  if (key.includes('級分')) {
    return key
  }
  
  return mapping[key] || key
}
const students = ref([])
const idNumberMapping = ref([])
const dataLoaded = ref(false) // 追蹤資料是否已載入
const selectedClass = ref('')
const searchQuery = ref('')
const classList = ref([])
const benchmarks = ref({})

// 多重條件搜尋功能
const {
  advancedConditions,
  showAdvancedDialog,
  applyAdvancedFilters,
  getAvailableFields,
  handleApplyFilters,
  showSearchDialog
} = useAdvancedSearch()


const filteredStudents = computed(() => {
  let result = students.value
  
  // 跨功能查詢 UID 篩選 - 優先處理，直接從完整資料搜尋並立即返回
  if (crossFunctionalFilterActive.value && crossFunctionalUIDs.value.length > 0) {
    console.log('STScore - 跨功能UID篩選啟動（跳過其他篩選），原始學生數量:', result.length, '篩選UID數量:', crossFunctionalUIDs.value.length)
    const uidSet = new Set(crossFunctionalUIDs.value.map(item => item.uid))
    result = result.filter(student => {
      const studentUID = student.idNumber || student.registrationNumber || student.身分證字號
      const match = studentUID && uidSet.has(studentUID)
      return match
    })
    console.log('STScore - UID篩選後學生數量（直接返回）:', result.length)
    return result
  }
  
  // 年份過濾（前端過濾，支援單選和多選）
  if (props.selectedYear && props.selectedYear !== 'all' && props.selectedYear !== 'latest') {
    // 處理多選年份
    if (Array.isArray(props.selectedYear) && props.selectedYear.length > 0) {
      const targetYears = props.selectedYear.map(year => parseInt(year))
      result = result.filter(student => {
        const studentYear = parseInt(student.examYear || student['考試年分'])
        return targetYears.includes(studentYear)
      })
    }
    // 處理單選年份
    else if (!Array.isArray(props.selectedYear)) {
      const targetYear = parseInt(props.selectedYear)
      result = result.filter(student => {
        const studentYear = parseInt(student.examYear || student['考試年分'])
        return studentYear === targetYear
      })
    }
  }
  
  // 跨功能選擇過濾 - 只有在有鎖定學生時才過濾
  if (lockedStudents.value && lockedStudents.value.length > 0) {
    console.log('STScore - 跨功能過濾啟動，原始學生數量:', result.length, '鎖定學生數量:', lockedStudents.value.length)
    // 建立鎖定學生的 ID Set
    const lockedStudentIds = new Set(lockedStudents.value.map(s => s.idNumber))
    result = result.filter(student => {
      const studentId = student.idNumber
      return studentId && lockedStudentIds.has(studentId)
    })
    console.log('STScore - 過濾後學生數量:', result.length)
  }
  
  // 班級過濾
  if (selectedClass.value) {
    result = result.filter(student => {
      const regNum = String(student.registrationNumber || '')
      const classNum = regNum.substring(3, 6)
      return classNum === selectedClass.value
    })
  }
  
  // 搜尋過濾
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(student => {
      const regNum = String(student.registrationNumber || '')
      return student.name.toLowerCase().includes(query) ||
             regNum.includes(query)
    })
  }
  
  // 成績篩選
  result = result.filter(student => {
    for (const subject of stSubjects.value) {
      const filter = scoreFilters.value[subject.key]
      const score = student[subject.key]
      
      // 檢查是否需要過濾空值
      if (filter.filterEmptyScores) {
        if (score === null || score === undefined || score === '' || typeof score !== 'number') {
          return false
        }
      }
      
      // 檢查分數範圍
      if (filter.min !== null || filter.max !== null) {
        if (score === null || score === undefined || typeof score !== 'number') continue
        
        if (filter.min !== null && score < filter.min) return false
        if (filter.max !== null && score > filter.max) return false
      }
    }
    return true
  })
  
  // 套用多重條件篩選
  if (advancedConditions.value.length > 0) {
    result = applyAdvancedFilters(result)
  }
  
  return result
})

const getSubjectScores = (subjectKey) => {
  return filteredStudents.value.map(student => ({
    name: student.name,
    score: student[subjectKey] || 0,
    year: student['考試年分'] || student.examYear
  }))
}

const getBenchmark = (subjectKey) => {
  // 找到對應的科目資訊
  const subject = stSubjects.value.find(s => s.key === subjectKey)
  if (!subject) return null
  
  // 使用benchmarkKey來查找五標資料
  const benchmarkKey = subject.benchmarkKey
  const result = {}
  Object.keys(benchmarks.value).forEach(year => {
    if (benchmarks.value[year] && benchmarks.value[year][benchmarkKey]) {
      result[year] = benchmarks.value[year][benchmarkKey]
    }
  })
  return Object.keys(result).length > 0 ? result : null
}

const loadSTScores = async (forceReload = false) => {
  // 智能載入：如果已有資料且非強制重載，則跳過
  if (dataLoaded.value && !forceReload) {
    console.log('📦 STDashboard: 資料已載入，跳過重複載入')
    return
  }
  
  loading.value = true
  emit('loading-change', true)
  
  try {
    let result
    
    let studentsData = []
    let benchmarksData = {}
    
    // 優化：使用數據包或優化的API - 現在載入所有年份的資料
    if (props.dataPackage && props.dataPackage.stScores) {
      console.log('🚀 STDashboard: 使用數據包中的分科成績（包含所有年份）')
      studentsData = props.dataPackage.stScores.data || []
      benchmarksData = props.dataPackage.stScores.benchmarks || {}
      console.log('從數據包載入分科成績數量（所有年份）:', studentsData.length)
      
      // 顯示年份分佈統計
      const yearStats = {}
      studentsData.forEach(student => {
        const year = student.examYear || student['考試年分']
        yearStats[year] = (yearStats[year] || 0) + 1
      })
      console.log('分科成績年份分佈:', yearStats)
    } else if (lockedStudents.value && lockedStudents.value.length > 0) {
      // 跨功能查詢仍使用原API
      console.log('🔍 STDashboard: 使用跨功能查詢')
      const result = await apiService.getCrossFunctionalSTScores(lockedStudents.value)
      if (result.success) {
        studentsData = result.students
        benchmarksData = result.benchmarks || {}
      } else {
        throw new Error(result.error)
      }
    } else {
      // 沒有數據包且不是跨功能查詢，等待數據包載入
      console.log('⚠️ STDashboard: 數據包尚未載入，等待中...')
      studentsData = []
      benchmarksData = {}
    }
    
    students.value = studentsData
    benchmarks.value = benchmarksData
    
    // 從benchmark和學生資料中提取學科列表
    const extractedSubjects = extractSubjects(studentsData, benchmarksData)
    stSubjects.value = extractedSubjects
    
    // 初始化篩選器和圖表模式
    scoreFilters.value = {}
    chartPercentageMode.value = {}
    extractedSubjects.forEach(subject => {
      scoreFilters.value[subject.key] = { min: null, max: null, filterEmptyScores: false }
      chartPercentageMode.value[subject.key] = false
    })
    
    // 提取班級列表
    const classSet = new Set()
    studentsData.forEach(student => {
      const regNum = String(student.registrationNumber || '')
      if (regNum.length >= 6) {
        const classNum = regNum.substring(3, 6)
        classSet.add(classNum)
      }
    })
    classList.value = Array.from(classSet).sort()
    
    console.log('STDashboard: 分科成績載入完成，數量:', studentsData.length)
    
    // 載入身分證對應表
    await loadIdNumberMapping()
    
    // 標記資料已載入
    dataLoaded.value = true
    
  } catch (error) {
    console.error('STDashboard: 載入分科成績失敗:', error)
    ElMessage.error('載入成績資料失敗')
    students.value = []
    benchmarks.value = {}
  } finally {
    loading.value = false
    emit('loading-change', false)
    if (students.value.length > 0) {
      emit('data-loaded')
    }
  }
}

const handleClassChange = () => {
  // 班級變更時的處理
}

const handleSearch = () => {
  // 搜尋時的處理
}

const handleScoreFilterChange = (filterData) => {
  console.log('Score filter changed:', filterData)
  console.log('Current scoreFilters:', scoreFilters.value)
  // v-model 會自動更新 scoreFilters，這裡只用於 debug
}

// 切換跨功能篩選
const toggleCrossFunctionalFilter = () => {
  crossFunctionalFilterActive.value = !crossFunctionalFilterActive.value
  console.log('STScore - 跨功能篩選狀態:', crossFunctionalFilterActive.value)
}

// 清除所有篩選器
const clearAllFilters = () => {
  // 清除基本過濾器
  selectedClass.value = ''
  searchQuery.value = ''
  
  // 清除跨功能篩選
  crossFunctionalFilterActive.value = false
  
  // 清除成績篩選器
  stSubjects.value.forEach(subject => {
    if (scoreFilters.value[subject.key]) {
      scoreFilters.value[subject.key] = { min: null, max: null, filterEmptyScores: false }
    }
  })
  
  // 清除高級過濾器
  advancedConditions.value = []
  localStorage.removeItem('stScoreAdvancedFilters')
}

// 獲取年份顯示文本
const getYearDisplayText = () => {
  if (!props.selectedYear || props.selectedYear === 'all' || props.selectedYear === 'latest') {
    return '所有年份'
  }
  
  if (Array.isArray(props.selectedYear)) {
    if (props.selectedYear.length === 0) return '所有年份'
    if (props.selectedYear.length === 1) return `${props.selectedYear[0]} 年`
    return `${props.selectedYear.join(', ')} 年`
  }
  
  return `${props.selectedYear} 年`
}


// 載入身分證對應表
const loadIdNumberMapping = async () => {
  try {
    console.log('🔑 載入身分證對應表...')
    const result = await apiService.getIdNumberMapping()
    
    if (result.success) {
      idNumberMapping.value = result.data || []
      console.log('✅ 身分證對應表載入完成:', idNumberMapping.value.length, '筆')
      
      // 處理分科成績資料，加入 UID
      processSTScoreData()
    } else {
      console.error('❌ 載入身分證對應表失敗:', result.error)
    }
  } catch (error) {
    console.error('❌ 載入身分證對應表發生錯誤:', error)
  }
}

// 處理分科成績資料，匹配身分證號碼加入 UID
const processSTScoreData = () => {
  if (!students.value.length || !idNumberMapping.value.length) {
    console.log('⚠️ 無法處理分科成績資料：缺少必要資料')
    return
  }
  
  console.log('🔧 開始處理分科成績資料，匹配身分證號碼...')
  
  // 建立對應表查詢 Map（使用報名序號+考試年份作為 key）
  const idMap = new Map()
  idNumberMapping.value.forEach(mapping => {
    const key = `${mapping['報名序號']}_${mapping['考試年份']}`
    idMap.set(key, mapping['身分證字號'])
  })
  
  // 為每個學生加入 UID
  let matchedCount = 0
  students.value.forEach(student => {
    const regNum = student.registrationNumber || student['報名序號']
    const year = student.examYear || student['考試年分']
    
    if (regNum && year) {
      const key = `${regNum}_${year}`
      const idNumber = idMap.get(key)
      
      if (idNumber) {
        student.uid = idNumber
        student.idNumber = idNumber // 保持與其他模組一致
        matchedCount++
      } else {
        student.uid = null
        student.idNumber = null
      }
    } else {
      student.uid = null
      student.idNumber = null
    }
  })
  
  console.log(`✅ 分科成績身分證匹配完成：${matchedCount}/${students.value.length} 筆成功`)
}

onMounted(() => {
  // 只有在有數據包或跨功能查詢時才載入
  if (props.dataPackage || (lockedStudents.value && lockedStudents.value.length > 0)) {
    loadSTScores()
  } else {
    console.log('📦 STDashboard: 等待數據包載入...')
  }
})

// 年份變更不再觸發後端請求，改為前端過濾
// 已在 filteredStudents computed 中實現年份過濾
console.log('STDashboard: 年份變更改為前端過濾，不再觸發後端請求')

// 監聽數據包或鎖定學生變化
watch([() => props.dataPackage, () => lockedStudents.value], () => {
  console.log('STDashboard: 數據包或鎖定學生變更，重新載入資料')
  loadSTScores()
}, { deep: true })
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.score-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-label {
  margin-right: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.filter-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 40px;
  flex-wrap: nowrap;
}

.card-header > span {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-header-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  align-items: center;
}
</style>