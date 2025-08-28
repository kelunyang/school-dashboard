<template>
  <div v-loading="loading">
    <!-- 畢業生列表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <div class="section-container">
          <div class="chart-header">
            <h3 class="chart-title">畢業生榜單</h3>
          </div>
          <GraduateList 
            :selected-years="props.selectedYears" 
            :graduate-data="processedGraduateData"
            :filtered-data="finalFilteredData"
            @filter-change="handleFilterChange" 
          />
        </div>
      </el-col>
    </el-row>
    
    <!-- 圖表區域 - 三個橫向圖表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading">
          <ChartWrapper 
            title="入學管道分布" 
            file-name="entrance_pathway_distribution"
            :chart-data="processedData.pathwayData"
            :text-formatter="pathwayTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.pathway"
          >
            <PathwayChart :data="processedData.pathwayData" :is-percentage="chartDisplayModes.pathway" />
          </ChartWrapper>
        </div>
      </el-col>
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading" style="margin-top: 20px;">
          <ChartWrapper 
            title="錄取學校分布" 
            file-name="admitted_school_distribution"
            :chart-data="processedData.schoolData"
            :text-formatter="schoolTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.school"
          >
            <SchoolChart :data="processedData.schoolData" :is-percentage="chartDisplayModes.school" />
          </ChartWrapper>
        </div>
      </el-col>
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading" style="margin-top: 20px;">
          <ChartWrapper 
            title="公私立分布" 
            file-name="public_private_distribution"
            :chart-data="processedData.typeData"
            :text-formatter="typeTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.type"
          >
            <TypeChart :data="processedData.typeData" :is-percentage="chartDisplayModes.type" />
          </ChartWrapper>
        </div>
      </el-col>
    </el-row>
    
    <!-- 地圖區域 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <div class="map-container" v-loading="loading">
          <h3 class="chart-title">大學地理分布圖</h3>
          <UniversityMap :data="filteredUniversityData" :selected-years="props.selectedYears" />
        </div>
      </el-col>
    </el-row>
    
    <!-- 多重條件搜尋對話框 -->
    <AdvancedSearchDialog
      v-model:visible="showAdvancedDialog"
      :available-fields="processedGraduateData && processedGraduateData.length > 0 ? getAvailableFields(processedGraduateData) : []"
      storage-key="graduateAdvancedFilters"
      @apply-filters="handleApplyFilters"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { apiService } from '../services/apiService'
import { optimizedApiService } from '../services/optimizedApiService'
import ChartWrapper from './ChartWrapper.vue'
import GraduateList from './GraduateListTanstack.vue'
import PathwayChart from './PathwayChart.vue'
import SchoolChart from './SchoolChart.vue'
import TypeChart from './TypeChart.vue'
import UniversityMap from './UniversityMap.vue'
import AdvancedSearchDialog from './AdvancedSearchDialog.vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'

const props = defineProps({
  selectedYears: {
    type: Array,
    default: () => []
  },
  dataRefreshTrigger: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['loading-change', 'data-loaded', 'show-last-modified'])

// 注入跨功能查詢相關功能
const lockedStudents = inject('lockedStudents')
const crossFunctionalUIDs = inject('crossFunctionalUIDs', ref([]))
const addToCrossFunctionalUIDs = inject('addToCrossFunctionalUIDs', () => {})
const removeFromCrossFunctionalUIDs = inject('removeFromCrossFunctionalUIDs', () => {})
const isCrossFunctionalSelected = inject('isCrossFunctionalSelected', () => false)

// 跨功能篩選狀態
const crossFunctionalFilterActive = ref(false)

const loading = ref(false)
const dataLoaded = ref(false) // 追蹤資料是否已載入
const allGraduateData = ref([])
const universityRankings = ref([])
const universityCoordinates = ref([])
const universityList = ref([]) // 大學列表（包含公私立資訊）
const idNumberMapping = ref([])
const processedGraduateData = ref([])
const currentFilters = ref({
  selectedClass: '',
  selectedSchool: '',
  selectedPathway: ''
})

// 圖表顯示模式（false: 絕對數字, true: 百分比）
const chartDisplayModes = ref({
  pathway: false,
  school: false,
  type: false
})

// 多重條件搜尋功能
const {
  advancedConditions,
  showAdvancedDialog,
  applyAdvancedFilters,
  getAvailableFields,
  handleApplyFilters,
  showSearchDialog
} = useAdvancedSearch()

// 使用新的前端篩選邏輯
const filteredRawData = computed(() => {
  console.log('📊 GraduateDashboard filteredRawData: allGraduateData.length =', allGraduateData.value.length)
  console.log('📊 GraduateDashboard filteredRawData: processedGraduateData.length =', processedGraduateData.value.length)
  
  // 確保所有必要的資料都已載入
  if (!allGraduateData.value.length || !processedGraduateData.value.length) {
    console.log('📊 GraduateDashboard filteredRawData: 資料尚未準備好，回傳空陣列')
    return []
  }
  
  const result = getFilteredData()
  console.log('📊 GraduateDashboard filteredRawData: 回傳', result.length, '筆資料')
  return result
})

// 根據年份篩選資料
const getFilteredData = () => {
  if (!processedGraduateData.value.length) {
    console.log('⚠️ getFilteredData: processedGraduateData 是空的')
    return []
  }
  
  console.log(`🔍 getFilteredData: 開始篩選 ${processedGraduateData.value.length} 筆資料，選定年份: ${props.selectedYears}`)
  let filteredData = processedGraduateData.value
  
  // 年份篩選（前端處理，支持多選）
  if (props.selectedYears && props.selectedYears.length > 0) {
    filteredData = filteredData.filter(record => {
      const itemYear = record['榜單年分']
      if (!itemYear) return false
      
      // 檢查記錄的年份是否在選定的年份列表中
      return props.selectedYears.includes(itemYear)
    })
  }
  
  // 其他篩選條件
  if (currentFilters.value.selectedClass) {
    filteredData = filteredData.filter(item => item['班級'] === currentFilters.value.selectedClass)
  }
  
  if (currentFilters.value.selectedSchool) {
    filteredData = filteredData.filter(item => item['錄取學校'] === currentFilters.value.selectedSchool)
  }
  
  if (currentFilters.value.selectedPathway) {
    filteredData = filteredData.filter(item => item['入學管道'] === currentFilters.value.selectedPathway)
  }
  
  // 根據大學權值表排序（權值越高排越前面）
  if (universityRankings.value.length > 0) {
    filteredData = sortGraduatesByUniversityRanking(filteredData)
  }
  
  console.log(`✅ getFilteredData: 篩選完成，回傳 ${filteredData.length} 筆資料`)
  return filteredData
}

// 經過多重條件篩選後的最終資料
const finalFilteredData = computed(() => {
  let data = filteredRawData.value
  
  // 套用跨功能篩選 - 忽略所有其他篩選器，直接從完整資料庫搜索
  if (crossFunctionalFilterActive.value && crossFunctionalUIDs.value.length > 0) {
    const uidSet = new Set(crossFunctionalUIDs.value.map(item => item.uid))
    
    // 從完整的已載入資料中搜尋，忽略年份和其他篩選器
    const completeData = processedGraduateData.value || []
    data = completeData.filter(graduate => {
      // 使用 UID 進行匹配
      const graduateUID = graduate.uid || graduate.idNumber || graduate['身分證字號']
      return graduateUID && uidSet.has(graduateUID)
    })
    
    console.log(`跨功能篩選：從完整資料庫 ${completeData.length} 筆中找到 ${data.length} 筆匹配資料`)
  }
  
  // 套用多重條件篩選
  if (advancedConditions.value.length > 0) {
    data = applyAdvancedFilters(data)
  }
  
  return data
})

// 處理後的統計資料
const processedData = computed(() => {
  if (!filteredRawData.value.length) {
    return {
      pathwayData: [],
      schoolData: [],
      typeData: []
    }
  }

  // 入學管道統計
  const pathwayByYear = {}
  const schoolByYear = {}
  const typeByYear = {}
  
  const years = [...new Set(filteredRawData.value.map(item => item['榜單年分']))].sort()

  years.forEach(year => {
    pathwayByYear[year] = {}
    schoolByYear[year] = {}
    typeByYear[year] = {}
  })

  // 建立大學公私立查詢表
  const universityTypeMap = new Map()
  universityList.value.forEach(university => {
    universityTypeMap.set(university.名稱, university.公私立)
  })
  
  filteredRawData.value.forEach(item => {
    const year = item['榜單年分']
    const pathway = item['入學管道']
    const school = item['錄取學校']
    
    // 從大學列表中匹配公私立資訊，如果找不到則使用原始資料或標為未知
    let type = universityTypeMap.get(school) || item['公私立'] || '未知'
    
    // 入學管道統計
    if (pathway) {
      pathwayByYear[year][pathway] = (pathwayByYear[year][pathway] || 0) + 1
    }
    
    // 學校統計（按年度）
    if (school) {
      schoolByYear[year][school] = (schoolByYear[year][school] || 0) + 1
    }
    
    // 公私立統計（使用匹配的資料）
    typeByYear[year][type] = (typeByYear[year][type] || 0) + 1
  })

  // 轉換為圖表資料格式
  const pathwayData = []
  Object.entries(pathwayByYear).forEach(([year, pathways]) => {
    Object.entries(pathways).forEach(([pathway, count]) => {
      pathwayData.push({
        year: parseInt(year),
        category: pathway,
        count
      })
    })
  })

  // 先找出全年度前10名學校
  const totalSchoolCount = {}
  Object.values(schoolByYear).forEach(yearData => {
    Object.entries(yearData).forEach(([school, count]) => {
      totalSchoolCount[school] = (totalSchoolCount[school] || 0) + count
    })
  })
  
  const top10Schools = Object.entries(totalSchoolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([school]) => school)

  // 學校資料（前10名學校的年度分布）
  const schoolData = []
  Object.entries(schoolByYear).forEach(([year, schools]) => {
    Object.entries(schools).forEach(([school, count]) => {
      if (top10Schools.includes(school)) {
        schoolData.push({
          year: parseInt(year),
          category: school,
          count
        })
      }
    })
  })

  // 公私立資料
  const typeData = []
  Object.entries(typeByYear).forEach(([year, types]) => {
    Object.entries(types).forEach(([type, count]) => {
      typeData.push({
        year: parseInt(year),
        category: type,
        count
      })
    })
  })

  return {
    pathwayData,
    schoolData,
    typeData
  }
})

// 地圖用的大學資料
const filteredUniversityData = computed(() => {
  if (!filteredRawData.value.length || !universityCoordinates.value.length) return []
  
  // 建立大學座標查詢表
  const coordinateMap = new Map()
  universityCoordinates.value.forEach(coord => {
    coordinateMap.set(coord.名稱, {
      lng: coord.E,
      lat: coord.N
    })
  })
  
  // 統計每個大學的學生數並匹配座標
  const universityMap = new Map()
  
  // 建立大學公私立查詢表
  const universityTypeMapForMap = new Map()
  universityList.value.forEach(university => {
    universityTypeMapForMap.set(university.名稱, university.公私立)
  })
  
  finalFilteredData.value.forEach(item => {
    const school = item['錄取學校']
    
    if (school) {
      const coordinates = coordinateMap.get(school)
      
      if (coordinates) {
        if (universityMap.has(school)) {
          universityMap.get(school).count++
        } else {
          // 使用大學列表中的公私立資訊
          const type = universityTypeMapForMap.get(school) || item['公私立'] || '未知'
          
          universityMap.set(school, {
            name: school,
            lng: coordinates.lng,
            lat: coordinates.lat,
            count: 1,
            type: type,
            rank: 0
          })
        }
      }
    }
  })
  
  return Array.from(universityMap.values())
})

const handleFilterChange = (filters) => {
  currentFilters.value = filters
}

// 切換跨功能查詢過濾器
const toggleCrossFunctionalFilter = () => {
  crossFunctionalFilterActive.value = !crossFunctionalFilterActive.value
  
  if (crossFunctionalFilterActive.value) {
    ElMessage.success(`已啟用跨功能篩選，顯示 ${crossFunctionalUIDs.value.length} 位畢業生`)
  } else {
    ElMessage.success('已關閉跨功能篩選，顯示全部畢業生')
  }
}

const loadAllData = async (forceReload = false) => {
  // 智能載入：如果已有資料且非強制重載，則跳過
  if (dataLoaded.value && !forceReload) {
    console.log('📦 GraduateDashboard: 資料已載入，跳過重複載入')
    return
  }
  
  loading.value = true
  emit('loading-change', true)
  
  try {
    // 檢查是否為跨功能查詢
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      ElMessage.info('載入跨功能查詢資料中...')
      const result = await apiService.getCrossFunctionalGraduateList(lockedStudents.value)
      if (result.success) {
        processedGraduateData.value = result.data || result.graduates || []
        ElMessage.success(`跨功能查詢載入完成，共 ${processedGraduateData.value.length} 筆資料`)
      } else {
        ElMessage.error('跨功能查詢失敗：' + result.error)
      }
      return
    }

    // 一次性載入所有資料
    if (forceReload) {
      ElMessage.info('正在重新載入完整資料集...')
    } else {
      ElMessage.info('正在載入完整資料集...')
    }
    
    const [graduateResult, rankingsResult, coordinatesResult, universityListResult, idMappingResult] = await Promise.all([
      apiService.getAllGraduateData(),
      apiService.getUniversityRankings(),
      apiService.getUniversityCoordinates(),
      apiService.getUniversityList(),
      apiService.getIdNumberMapping()
    ])
    
    if (graduateResult.success) {
      ElMessage.success(`資料載入完成！畢業生 ${graduateResult.data.length} 筆`)
      
      // 保存所有原始資料 (不在此處設定 UID，稍後透過 ID 對應表處理)
      allGraduateData.value = graduateResult.data
      
      // 載入輔助資料
      if (rankingsResult.success) {
        universityRankings.value = rankingsResult.data || []
        console.log('✅ 大學權值表載入完成:', universityRankings.value.length, '筆')
      }
      
      if (coordinatesResult.success) {
        universityCoordinates.value = coordinatesResult.data || []
        console.log('✅ 大學座標表載入完成:', universityCoordinates.value.length, '筆')
      }
      
      if (universityListResult.success) {
        universityList.value = universityListResult.data || []
        console.log('✅ 大學列表載入完成:', universityList.value.length, '筆')
      }
      
      if (idMappingResult.success) {
        idNumberMapping.value = idMappingResult.data || []
        console.log('✅ 身分證號對照表載入完成:', idNumberMapping.value.length, '筆')
      }
      
      ElMessage.info('正在處理和合併資料...')
      
      // 載入身分證對應表並處理資料
      await loadIdNumberMapping()
      
      ElMessage.success(`資料處理完成！合併後共 ${processedGraduateData.value.length} 筆資料`)
      
      // 標記資料已載入
      dataLoaded.value = true
      
      console.log('完整畢業生資料載入完成')
      console.log('畢業生資料:', allGraduateData.value.length, '筆')
      if (allGraduateData.value.length > 0) {
        console.log('可用年份:', [...new Set(allGraduateData.value.map(item => item['榜單年分']))].sort())
      }
    } else {
      ElMessage.error('載入畢業生資料失敗：' + graduateResult.error)
    }
  } catch (error) {
    ElMessage.error('載入資料時發生錯誤')
    console.error(error)
  } finally {
    loading.value = false
    emit('loading-change', false)
    if (processedGraduateData.value.length > 0) {
      emit('data-loaded')
    }
  }
}

// 載入身分證對應表
const loadIdNumberMapping = async () => {
  try {
    console.log('🔑 載入身分證對應表...')
    const result = await apiService.getIdNumberMapping()
    
    if (result.success) {
      idNumberMapping.value = result.data || []
      console.log('✅ 身分證對應表載入完成:', idNumberMapping.value.length, '筆')
      
      // 處理畢業生資料，加入 UID
      processGraduateData()
    } else {
      console.error('❌ 載入身分證對應表失敗:', result.error)
      // 如果載入失敗，使用原有邏輯作為後備
      processAllGraduateDataFallback()
    }
  } catch (error) {
    console.error('❌ 載入身分證對應表發生錯誤:', error)
    // 如果載入失敗，使用原有邏輯作為後備
    processAllGraduateDataFallback()
  }
}

// 處理畢業生資料，匹配身分證號碼加入 UID
const processGraduateData = () => {
  if (!allGraduateData.value.length || !idNumberMapping.value.length) {
    console.log('⚠️ 無法處理畢業生資料：缺少必要資料')
    processAllGraduateDataFallback()
    return
  }
  
  console.log('🔧 開始處理畢業生資料，匹配身分證號碼...')
  
  // 建立對應表查詢 Map（使用報名序號+考試年份作為 key）
  const idMap = new Map()
  idNumberMapping.value.forEach(mapping => {
    const key = `${mapping['報名序號']}_${mapping['考試年份']}`
    idMap.set(key, mapping['身分證字號'])
  })
  
  // 為每個畢業生加入 UID
  let matchedCount = 0
  processedGraduateData.value = allGraduateData.value.map(graduate => {
    const regNum = graduate['學測報名序號']
    const year = graduate['榜單年分']
    
    let uid = null
    let idNumber = null
    
    if (regNum && year) {
      const key = `${regNum}_${year}`
      const mappedIdNumber = idMap.get(key)
      
      if (mappedIdNumber) {
        uid = mappedIdNumber
        idNumber = mappedIdNumber
        matchedCount++
      }
    }
    
    // 如果沒有匹配到，使用原有邏輯作為後備
    if (!uid) {
      uid = graduate['學測報名序號'] || graduate.idNumber
      idNumber = graduate.idNumber
    }
    
    return {
      ...graduate,
      uid: uid,
      idNumber: idNumber
    }
  })
  
  console.log(`✅ 畢業生身分證匹配完成：${matchedCount}/${allGraduateData.value.length} 筆成功`)
  console.log(`資料處理完成：${processedGraduateData.value.length} 筆畢業生資料`)
}

// 後備處理函數（原有邏輯）
const processAllGraduateDataFallback = () => {
  console.log(`🔧 processAllGraduateDataFallback: 使用後備邏輯處理 ${allGraduateData.value.length} 筆畢業生資料`)
  
  if (!allGraduateData.value.length) {
    console.log('⚠️ processAllGraduateDataFallback: allGraduateData 是空的')
    processedGraduateData.value = []
    return
  }

  // 使用原有邏輯：直接使用學測報名序號作為 UID
  processedGraduateData.value = allGraduateData.value.map(graduate => {
    return {
      ...graduate,
      uid: graduate['學測報名序號'] || graduate.idNumber
    }
  })

  console.log(`後備處理完成：${processedGraduateData.value.length} 筆畢業生資料`)
}


// 根據大學權值表排序畢業生資料
const sortGraduatesByUniversityRanking = (data) => {
  // 建立大學權值查詢表
  const rankingMap = new Map()
  universityRankings.value.forEach(ranking => {
    rankingMap.set(ranking.名稱, ranking.完整權值)
  })
  
  // 根據大學權值排序（權值越高越前面，沒有權值的排到後面）
  return data.sort((a, b) => {
    const schoolA = a['錄取學校']
    const schoolB = b['錄取學校']
    
    const rankA = rankingMap.get(schoolA) || 0
    const rankB = rankingMap.get(schoolB) || 0
    
    // 權值高的排前面
    if (rankA !== rankB) {
      return rankB - rankA
    }
    
    // 權值相同時，按學校名稱排序
    return (schoolA || '').localeCompare(schoolB || '', 'zh-TW')
  })
}

// Watch for lockedStudents changes
watch(lockedStudents, () => {
  loadAllData()
}, { deep: true })

// Watch for years changes - computed會自動重新計算
watch(() => props.selectedYears, () => {
  console.log('年份變更:', props.selectedYears)
}, { deep: true })

// Watch for manual refresh trigger
watch(() => props.dataRefreshTrigger, (newValue) => {
  if (newValue) {
    console.log('🔄 接收到手動刷新信號，重新載入資料')
    loadAllData(true) // 強制重載
  }
})

// Watch for filter changes - computed會自動重新計算
watch(currentFilters, () => {
  console.log('篩選條件變更:', currentFilters.value)
}, { deep: true })

// 監聽跨功能查詢條件變化
watch(crossFunctionalUIDs, () => {
  if (crossFunctionalFilterActive.value) {
    console.log('跨功能查詢條件變更，重新篩選資料')
  }
}, { deep: true })

// 文字版格式化函數
const pathwayTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和入學管道分組
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const pathways = [...new Set(data.map(d => d.category))]
  
  const tableData = pathways.map(pathway => {
    const row = { pathway }
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === pathway)
      const count = item ? item.count : 0
      row[`year_${year}`] = count
    })
    
    // 計算百分比
    yearCategories.forEach(year => {
      const yearTotal = data.filter(d => d.year === year).reduce((sum, d) => sum + d.count, 0)
      const count = row[`year_${year}`]
      row[`year_${year}_percent`] = yearTotal > 0 ? ((count / yearTotal) * 100).toFixed(1) : '0.0'
    })
    
    return row
  })
  
  const columns = [
    { prop: 'pathway', label: '入學管道', width: 140 },
    ...yearCategories.map(year => ({
      prop: `year_${year}`,
      label: `${year}年`,
      formatter: (row) => {
        if (displayMode === 'percentage') {
          return `${row[`year_${year}_percent`]}%`
        }
        return row[`year_${year}`] || 0
      }
    }))
  ]
  
  return { data: tableData, columns }
}

const schoolTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和學校分組（取前10名）
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const schools = [...new Set(data.map(d => d.category))].slice(0, 10)
  
  const tableData = schools.map(school => {
    const row = { school }
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === school)
      const count = item ? item.count : 0
      row[`year_${year}`] = count
    })
    
    // 計算百分比
    yearCategories.forEach(year => {
      const yearTotal = data.filter(d => d.year === year).reduce((sum, d) => sum + d.count, 0)
      const count = row[`year_${year}`]
      row[`year_${year}_percent`] = yearTotal > 0 ? ((count / yearTotal) * 100).toFixed(1) : '0.0'
    })
    
    return row
  })
  
  const columns = [
    { prop: 'school', label: '錄取學校', width: 160 },
    ...yearCategories.map(year => ({
      prop: `year_${year}`,
      label: `${year}年`,
      formatter: (row) => {
        if (displayMode === 'percentage') {
          return `${row[`year_${year}_percent`]}%`
        }
        return row[`year_${year}`] || 0
      }
    }))
  ]
  
  return { data: tableData, columns }
}

const typeTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和公私立類型分組
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const types = [...new Set(data.map(d => d.category))]
  
  const tableData = types.map(type => {
    const row = { type }
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === type)
      const count = item ? item.count : 0
      row[`year_${year}`] = count
    })
    
    // 計算百分比
    yearCategories.forEach(year => {
      const yearTotal = data.filter(d => d.year === year).reduce((sum, d) => sum + d.count, 0)
      const count = row[`year_${year}`]
      row[`year_${year}_percent`] = yearTotal > 0 ? ((count / yearTotal) * 100).toFixed(1) : '0.0'
    })
    
    return row
  })
  
  const columns = [
    { prop: 'type', label: '學校類型', width: 100 },
    ...yearCategories.map(year => ({
      prop: `year_${year}`,
      label: `${year}年`,
      formatter: (row) => {
        if (displayMode === 'percentage') {
          return `${row[`year_${year}_percent`]}%`
        }
        return row[`year_${year}`] || 0
      }
    }))
  ]
  
  return { data: tableData, columns }
}

onMounted(() => {
  loadAllData()
})
</script>

<style scoped>
.section-container {
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-container {
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: 480px;
  position: relative;
  overflow: hidden;
}

.map-container {
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: 600px;
  position: relative;
  overflow: hidden;
}

.chart-title {
  margin: 0 0 20px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header .chart-title {
  margin-bottom: 0;
}

/* 響應式設計 */
@media (max-width: 1199px) {
  .chart-container,
  .map-container {
    margin-bottom: 20px;
  }
  
  /* 移除桌面版的 margin-top */
  .el-col .chart-container[style*="margin-top"],
  .el-col .map-container[style*="margin-top"] {
    margin-top: 0 !important;
  }
}

/* 中等螢幕 - 圖表改為兩欄 */
@media (max-width: 1399px) and (min-width: 992px) {
  .chart-container {
    height: 460px;
  }
}

@media (max-width: 991px) {
  .chart-container {
    height: 420px;
  }
}

@media (max-width: 768px) {
  .chart-container {
    height: 400px;
    padding: 15px;
  }
  
  .map-container {
    height: 400px;
    padding: 15px;
  }
  
  .section-container {
    padding: 15px;
  }
  
  .chart-title {
    font-size: 14px;
    margin-bottom: 15px;
  }
}

@media (max-width: 480px) {
  .chart-container {
    height: 380px;
    padding: 10px;
  }
  
  .chart-title {
    font-size: 13px;
    margin-bottom: 10px;
  }
}
</style>