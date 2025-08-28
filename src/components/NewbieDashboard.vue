<template>
  <div v-loading="loading">
    <el-alert 
      v-if="unmatchedCount > 0"
      :title="`有 ${unmatchedCount} 筆資料無法匹配到地理資訊`"
      type="warning"
      :closable="false"
      style="margin: 20px 0;"
    />
    
    <!-- 學生列表 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <div class="section-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 class="chart-title">學生列表</h3>
            <div style="display: flex; gap: 10px;">
            </div>
          </div>
          <StudentList 
            :selected-years="props.selectedYears" 
            :student-data="processedData"
            :filtered-data="filteredRawData"
            :loading="loading"
            @filter-change="handleFilterChange" 
            :key="`student-list-${processedData.length}-${filteredRawData.length}`"
          />
        </div>
      </el-col>
    </el-row>
    
    <!-- 圖表區域 - RWD 調整：橫屏 2 個一排，直屏 1 個一排 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading">
          <ChartWrapper 
            title="錄取管道分布" 
            file-name="admission_channel_distribution"
            :chart-data="chartData.channelData"
            :text-formatter="channelTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.channel"
          >
            <ChannelChart :data="chartData.channelData" :is-percentage="chartDisplayModes.channel" />
          </ChartWrapper>
        </div>
      </el-col>
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading">
          <ChartWrapper 
            title="會考總積分分布" 
            file-name="entrance_exam_score_distribution"
            :chart-data="chartData.scoreData"
            :text-formatter="scoreTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.score"
          >
            <ScoreChart :data="chartData.scoreData" :is-percentage="chartDisplayModes.score" />
          </ChartWrapper>
        </div>
      </el-col>
      <el-col :xs="24" :sm="24" :md="12" :lg="12" :xl="12">
        <div class="chart-container" v-loading="loading">
          <ChartWrapper 
            title="性別分布統計" 
            file-name="gender_distribution"
            :chart-data="chartData.genderData"
            :text-formatter="genderTextFormatter"
            :show-percentage-toggle="true"
            v-model="chartDisplayModes.gender"
          >
            <GenderChart 
              :selected-years="props.selectedYears" 
              :student-data="filteredRawData"
              :is-percentage="chartDisplayModes.gender"
            />
          </ChartWrapper>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
        <div class="map-container" v-loading="loading">
          <h3 class="chart-title">畢業國中地理分布圖</h3>
          <SchoolMap :data="filteredSchoolGeoData" :selected-years="props.selectedYears" />
        </div>
      </el-col>
      <el-col :xs="24" :sm="24" :md="24" :lg="12" :xl="12">
        <div class="map-container" v-loading="loading" style="margin-top: 20px;">
          <h3 class="chart-title">新生住址分布圖</h3>
          <StudentAddressMap :data="filteredStudentCoordinates" :selected-years="props.selectedYears" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, inject, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { apiService } from '../services/apiService'
import ChartWrapper from './ChartWrapper.vue'
import ChannelChart from './ChannelChart.vue'
import ScoreChart from './ScoreChart.vue'
import SchoolMap from './SchoolMap.vue'
import StudentAddressMap from './StudentAddressMap.vue'
import StudentList from './StudentListTanstack.vue'
import GenderChart from './GenderChart.vue'

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

// Inject lockedStudents for cross-functional queries
const lockedStudents = inject('lockedStudents', ref([]))

const loading = ref(false)
const dataLoaded = ref(false) // 追蹤資料是否已載入
const allStudentData = ref([])
const allStudentCoordinates = ref([])
const juniorHighGeoInfo = ref([])
const processedData = ref([])
const schoolGeoData = ref([])
const studentCoordinates = ref([])
const unmatchedCount = ref(0)
const currentFilters = ref({
  selectedChannel: '',
  selectedStudentType: '',
  selectedAdmissionType: '',
  selectedClass: ''
})

// 圖表顯示模式（false: 絕對數字, true: 百分比）
const chartDisplayModes = ref({
  channel: false,
  score: false,
  gender: false
})

// 篩選資料
// 使用新的前端篩選邏輯
const filteredRawData = computed(() => {
  console.log('📊 filteredRawData: allStudentData.length =', allStudentData.value.length)
  console.log('📊 filteredRawData: processedData.length =', processedData.value.length)
  
  // 確保所有必要的資料都已載入
  if (!allStudentData.value.length || !processedData.value.length) {
    console.log('📊 filteredRawData: 資料尚未準備好，回傳空陣列')
    return []
  }
  
  const result = getFilteredData()
  console.log('📊 filteredRawData: 回傳', result.length, '筆資料')
  return result
})

const filteredSchoolGeoData = computed(() => {
  if (!schoolGeoData.value.length) return []
  
  // 如果沒有選擇年份或選擇了所有年份，顯示所有資料
  if (!props.selectedYears || props.selectedYears.length === 0 || props.selectedYears.length >= 6) {
    // 合併所有年度的資料
    const schoolMap = new Map()
    schoolGeoData.value.forEach(item => {
      const key = item.schoolCode
      if (schoolMap.has(key)) {
        schoolMap.get(key).count += item.count
      } else {
        schoolMap.set(key, { ...item })
      }
    })
    return Array.from(schoolMap.values())
  }
  
  // 篩選選定年份的資料，並合併相同學校
  const filteredData = schoolGeoData.value.filter(item => props.selectedYears.includes(item.year))
  const schoolMap = new Map()
  filteredData.forEach(item => {
    const key = item.schoolCode
    if (schoolMap.has(key)) {
      schoolMap.get(key).count += item.count
    } else {
      schoolMap.set(key, { ...item })
    }
  })
  const result = Array.from(schoolMap.values())
  console.log('🗺️ filteredSchoolGeoData: 選定年份', props.selectedYears, '資料筆數:', result.length)
  return result
})

const filteredStudentCoordinates = computed(() => {
  if (!studentCoordinates.value.length) return []
  
  // 如果沒有選擇年份或選擇了所有年份，顯示所有資料
  if (!props.selectedYears || props.selectedYears.length === 0 || props.selectedYears.length >= 6) {
    return studentCoordinates.value
  }
  
  // 篩選選定年份的資料
  const result = studentCoordinates.value.filter(item => props.selectedYears.includes(item.year))
  console.log('🗺️ filteredStudentCoordinates: 選定年份', props.selectedYears, '資料筆數:', result.length)
  return result
})

const chartData = computed(() => {
  console.log('📊 chartData computed - filteredRawData.value.length:', filteredRawData.value.length)
  console.log('📊 chartData computed - selectedYears:', props.selectedYears)
  console.log('📊 chartData computed - currentFilters:', currentFilters.value)
  
  if (!filteredRawData.value.length) {
    console.log('📊 chartData: 無資料，回傳空資料')
    return {
      channelData: [],
      scoreData: [],
      genderData: []
    }
  }
  
  // 調試：檢查第一筆資料
  if (filteredRawData.value.length > 0) {
    console.log('📊 chartData - 第一筆資料欄位檢查:')
    const firstItem = filteredRawData.value[0]
    console.log('  - 錄取管道:', firstItem['錄取管道'])
    console.log('  - 入學管道:', firstItem['入學管道'])
    console.log('  - 所有欄位:', Object.keys(firstItem))
  }

  const channelByYear = {}
  const scoreByYear = {}
  const genderByYear = {}
  const years = [...new Set(filteredRawData.value.map(item => item['入學年分']))].sort()
  
  console.log('📊 chartData - 從篩選資料中找到的年份:', years)
  console.log('📊 chartData - 選定的年份:', props.selectedYears)

  years.forEach(year => {
    channelByYear[year] = {}
    scoreByYear[year] = {}
    genderByYear[year] = {}
  })

  filteredRawData.value.forEach(item => {
    const year = item['入學年分']
    
    if (item['錄取管道']) {
      channelByYear[year][item['錄取管道']] = (channelByYear[year][item['錄取管道']] || 0) + 1
    } else if (item['入學管道']) {
      // 可能欄位名稱是'入學管道'而非'錄取管道'
      channelByYear[year][item['入學管道']] = (channelByYear[year][item['入學管道']] || 0) + 1
    }

    // 只統計一般生的會考總積分，排除空白值但包含0分
    if (item['學生身分別'] === '一般生' && item['會考總積分'] !== null && item['會考總積分'] !== undefined && item['會考總積分'] !== '') {
      const originalScore = item['會考總積分']
      const scoreRange = getScoreRange(originalScore)
      if (scoreByYear[year][scoreRange] === undefined) {
        console.log(`📊 新增分數範圍: ${originalScore} → ${scoreRange}`)
      }
      scoreByYear[year][scoreRange] = (scoreByYear[year][scoreRange] || 0) + 1
    }

    // 統計性別分布
    if (item['性別']) {
      genderByYear[year][item['性別']] = (genderByYear[year][item['性別']] || 0) + 1
    }
  })

  const channelData = []
  Object.entries(channelByYear).forEach(([year, channels]) => {
    Object.entries(channels).forEach(([channel, count]) => {
      channelData.push({
        year: parseInt(year),
        category: channel,
        count
      })
    })
  })

  const scoreData = []
  Object.entries(scoreByYear).forEach(([year, scores]) => {
    Object.entries(scores).forEach(([range, count]) => {
      scoreData.push({
        year: parseInt(year),
        category: range,
        count
      })
    })
  })

  const genderData = []
  Object.entries(genderByYear).forEach(([year, genders]) => {
    Object.entries(genders).forEach(([gender, count]) => {
      genderData.push({
        year: parseInt(year),
        category: gender,
        count
      })
    })
  })

  // 調試：檢查最終的 channelData 和 scoreData
  console.log('📊 chartData - 最終 channelData 筆數:', channelData.length)
  console.log('📊 chartData - 最終 scoreData 筆數:', scoreData.length)
  if (channelData.length > 0) {
    console.log('📊 chartData - channelData 範例:', channelData.slice(0, 3))
  }
  if (scoreData.length > 0) {
    console.log('📊 chartData - scoreData 範例:', scoreData.slice(0, 5))
  }
  
  return {
    channelData,
    scoreData,
    genderData
  }
})

const getScoreRange = (score) => {
  // 無條件捨去小數點
  const truncatedScore = Math.floor(score)
  return truncatedScore.toString()
}

const handleFilterChange = (filters) => {
  console.log('🔍 NewbieDashboard: 接收到過濾器變更', filters)
  currentFilters.value = filters
  console.log('🔍 NewbieDashboard: 當前過濾器狀態', currentFilters.value)
  console.log('🔍 NewbieDashboard: filteredRawData 筆數', filteredRawData.value.length)
}

const loadAllData = async (forceReload = false) => {
  // 智能載入：如果已有資料且非強制重載，則跳過
  if (dataLoaded.value && !forceReload) {
    console.log('📦 資料已載入，跳過重複載入')
    return
  }
  
  loading.value = true
  emit('loading-change', true)
  
  try {
    // 檢查是否為跨功能查詢
    if (lockedStudents.value && lockedStudents.value.length > 0) {
      ElMessage.info('載入跨功能查詢資料中...')
      const result = await apiService.getCrossFunctionalStudentList(lockedStudents.value)
      if (result.success) {
        processedData.value = result.data
        ElMessage.success(`跨功能查詢載入完成，共 ${processedData.value.length} 筆資料`)
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
    
    const [studentResult, coordinateResult, geoResult] = await Promise.all([
      apiService.getAllStudentData(),
      apiService.getAllStudentCoordinates(), 
      apiService.getJuniorHighSchoolGeoInfo()
    ])
    
    if (studentResult.success && coordinateResult.success && geoResult.success) {
      ElMessage.success(`資料載入完成！學生 ${studentResult.data.length} 筆、座標 ${coordinateResult.data.length} 筆、國中 ${geoResult.data.length} 筆`)
      
      // 在原始學生資料中就加上 uid 欄位
      allStudentData.value = studentResult.data.map(student => ({
        ...student,
        uid: student['身分證統一編號']
      }))
      allStudentCoordinates.value = coordinateResult.data
      juniorHighGeoInfo.value = geoResult.data
      
      ElMessage.info('正在處理和合併資料...')
      
      // 前端處理資料合併
      processAllData()
      
      ElMessage.success(`資料處理完成！合併後共 ${processedData.value.length} 筆資料`)
      
      // 標記資料已載入
      dataLoaded.value = true
      
      // 通知App.vue數據已載入
      emit('data-loaded', {
        type: 'newbie',
        data: processedData.value,
        metadata: {
          totalCount: processedData.value.length,
          years: [...new Set(allStudentData.value.map(item => item['入學年分']))].sort()
        }
      })
      
      console.log('完整資料載入完成')
      console.log('學生資料:', allStudentData.value.length, '筆')
      console.log('座標資料:', allStudentCoordinates.value.length, '筆') 
      console.log('國中地理資訊:', juniorHighGeoInfo.value.length, '筆')
      if (allStudentData.value.length > 0) {
        console.log('可用年份:', [...new Set(allStudentData.value.map(item => item['入學年分']))].sort())
      }
    } else {
      let errorMsg = '載入失敗：'
      if (!studentResult.success) errorMsg += '學生資料 '
      if (!coordinateResult.success) errorMsg += '座標資料 '
      if (!geoResult.success) errorMsg += '國中地理資訊 '
      ElMessage.error(errorMsg)
    }
  } catch (error) {
    ElMessage.error('載入資料時發生錯誤')
    console.error(error)
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

// 前端資料處理和合併
const processAllData = () => {
  console.log(`🔧 processAllData: 開始處理 ${allStudentData.value.length} 筆學生資料`)
  
  if (!allStudentData.value.length) {
    console.log('⚠️ processAllData: allStudentData 是空的')
    processedData.value = []
    return
  }

  // 建立座標資料的快速查詢對照表（使用身分證字號）
  const coordinateMap = new Map()
  allStudentCoordinates.value.forEach(coord => {
    const idNumber = coord['身分證字號']
    if (idNumber) {
      coordinateMap.set(idNumber, {
        address: coord['地址'] || '',
        lat: parseFloat(coord['緯度']) || null,
        lng: parseFloat(coord['經度']) || null
      })
    }
  })

  // 合併學生資料與住址座標
  processedData.value = allStudentData.value.map(student => {
    const idNumber = student['身分證統一編號']
    const coordinateInfo = coordinateMap.get(idNumber)
    
    return {
      ...student,
      // 住址座標資訊（使用身分證字號 JOIN）
      住址經度: coordinateInfo ? coordinateInfo.lng : null,
      住址緯度: coordinateInfo ? coordinateInfo.lat : null,
      地址: student['地址'] || (coordinateInfo ? coordinateInfo.address : ''),
      // 身分證字號作為統一 UID
      uid: idNumber
    }
  })

  console.log(`資料合併完成：${processedData.value.length} 筆學生資料`)
  console.log(`座標匹配成功：${processedData.value.filter(s => s.住址經度 && s.住址緯度).length} 筆`)
  
  // 調試：檢查資料欄位
  if (processedData.value.length > 0) {
    console.log('🔍 第一筆資料的欄位:', Object.keys(processedData.value[0]))
    console.log('🔍 錄取管道範例:', processedData.value.slice(0, 3).map(s => s['錄取管道']))
  }
  
  // 等待 nextTick 確保 computed 更新後再計算地理統計
  nextTick(() => {
    console.log('🎯 開始計算地理統計')
    calculateSchoolGeoStats()
    calculateStudentCoordinates()
  })
}

// 根據年份篩選資料
const getFilteredData = () => {
  if (!processedData.value.length) {
    console.log('⚠️ getFilteredData: processedData 是空的')
    return []
  }
  
  console.log(`🔍 getFilteredData: 開始篩選 ${processedData.value.length} 筆資料，選定年份: ${props.selectedYears}`)
  let filteredData = processedData.value
  
  // 年份篩選（前端處理，支持多選）
  if (props.selectedYears && props.selectedYears.length > 0) {
    filteredData = filteredData.filter(record => {
      const itemYear = record['入學年分']
      if (!itemYear) return false
      
      // 檢查記錄的年份是否在選定的年份列表中
      return props.selectedYears.includes(itemYear)
    })
  }
  
  // 其他篩選條件
  if (currentFilters.value.selectedChannel) {
    filteredData = filteredData.filter(item => item['錄取管道'] === currentFilters.value.selectedChannel)
  }
  
  if (currentFilters.value.selectedStudentType) {
    filteredData = filteredData.filter(item => item['學生身分別'] === currentFilters.value.selectedStudentType)
  }
  
  if (currentFilters.value.selectedAdmissionType) {
    filteredData = filteredData.filter(item => item['錄取身分別'] === currentFilters.value.selectedAdmissionType)
  }
  
  if (currentFilters.value.selectedClass) {
    if (currentFilters.value.selectedClass === '未編班') {
      filteredData = filteredData.filter(item => !item['班級'] || item['班級'] === '')
    } else {
      filteredData = filteredData.filter(item => item['班級'] === currentFilters.value.selectedClass)
    }
  }
  
  // 按入學年分降序排列（最新的在前面）
  filteredData.sort((a, b) => {
    const aYear = a['入學年分'] || 0
    const bYear = b['入學年分'] || 0
    return bYear - aYear
  })
  
  console.log(`✅ getFilteredData: 篩選完成，回傳 ${filteredData.length} 筆資料`)
  return filteredData
}

const calculateSchoolGeoStats = () => {
  const filteredData = getFilteredData()
  
  if (!filteredData.length || !juniorHighGeoInfo.value.length) {
    schoolGeoData.value = []
    unmatchedCount.value = 0
    return
  }

  // 建立國中地理資訊的快速查詢對照表（使用長名稱）
  const geoInfoMap = new Map()
  juniorHighGeoInfo.value.forEach(geoInfo => {
    geoInfoMap.set(geoInfo.schoolName, {
      lng: geoInfo.lng,
      lat: geoInfo.lat
    })
  })

  const schoolStats = new Map()
  let unmatched = 0

  filteredData.forEach(student => {
    const schoolCode = student['畢業國中代碼']
    const schoolName = student['畢業國中名稱']
    const year = student['入學年分']

    // 使用畢業國中名稱去查詢地理資訊
    const geoInfo = geoInfoMap.get(schoolName)

    if (geoInfo && geoInfo.lng && geoInfo.lat && !isNaN(geoInfo.lng) && !isNaN(geoInfo.lat)) {
      const key = `${schoolCode}-${year}`
      if (schoolStats.has(key)) {
        schoolStats.get(key).count++
      } else {
        schoolStats.set(key, {
          schoolCode,
          schoolName,
          year,
          lng: parseFloat(geoInfo.lng),
          lat: parseFloat(geoInfo.lat),
          count: 1
        })
      }
    } else {
      unmatched++
    }
  })

  schoolGeoData.value = Array.from(schoolStats.values())
  unmatchedCount.value = unmatched
  console.log('學校地理統計資料:', schoolGeoData.value.length, '筆')
  console.log('無法匹配地理資訊:', unmatched, '筆')
}

const calculateStudentCoordinates = () => {
  const filteredData = getFilteredData()
  
  if (!filteredData.length) {
    studentCoordinates.value = []
    return
  }

  const coordinates = []

  filteredData.forEach(student => {
    const year = student['入學年分']
    const studentLng = student['住址經度']
    const studentLat = student['住址緯度']
    const address = student['地址']
    
    if (studentLng && studentLat && !isNaN(studentLng) && !isNaN(studentLat)) {
      coordinates.push({
        year,
        lng: parseFloat(studentLng),
        lat: parseFloat(studentLat),
        address: address || '',
        studentId: student['身分證統一編號'] || student['uid']
      })
    }
  })

  studentCoordinates.value = coordinates
  console.log('學生座標資料:', studentCoordinates.value.length, '筆')
}

// Watch for lockedStudents changes
watch(lockedStudents, () => {
  loadAllData()
}, { deep: true })

// Watch for years changes - 只需重新計算地理統計，不需重新載入資料
watch(() => props.selectedYears, () => {
  console.log('年份變更，重新計算地理統計:', props.selectedYears)
  if (processedData.value.length > 0) {
    console.log('重新計算地理統計...')
    calculateSchoolGeoStats()
    calculateStudentCoordinates()
  } else {
    console.log('⚠️ processedData 還沒有資料，等待載入完成')
  }
}, { deep: true })

// Watch for manual refresh trigger
watch(() => props.dataRefreshTrigger, (newValue) => {
  if (newValue) {
    console.log('🔄 接收到手動刷新信號，重新載入資料')
    loadAllData(true) // 強制重載
  }
})

// Watch for filter changes
watch(currentFilters, () => {
  console.log('篩選條件變更，重新計算地理統計')
  if (processedData.value.length > 0) {
    calculateSchoolGeoStats()
    calculateStudentCoordinates()
  }
}, { deep: true })

// 文字版格式化函數
const channelTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和管道分組
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const categories = [...new Set(data.map(d => d.category))]
  
  const tableData = categories.map(category => {
    const row = { category }
    let totalCount = 0
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === category)
      const count = item ? item.count : 0
      row[`year_${year}`] = count
      totalCount += count
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
    { prop: 'category', label: '錄取管道', width: 120 },
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

const scoreTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和積分分組
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const scoreRanges = [...new Set(data.map(d => d.category))].sort((a, b) => {
    const aScore = parseInt(a.replace('分以上', '').replace('分', ''))
    const bScore = parseInt(b.replace('分以上', '').replace('分', ''))
    return bScore - aScore
  })
  
  const tableData = scoreRanges.map(scoreRange => {
    const row = { scoreRange }
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === scoreRange)
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
    { prop: 'scoreRange', label: '會考積分', width: 120 },
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

const genderTextFormatter = (data, displayMode) => {
  if (!data || data.length === 0) return { data: [], columns: [] }
  
  // 按年份和性別分組
  const yearCategories = [...new Set(data.map(d => d.year))].sort((a, b) => b - a)
  const genders = [...new Set(data.map(d => d.category))].sort()
  
  const tableData = genders.map(gender => {
    const row = { gender }
    
    yearCategories.forEach(year => {
      const item = data.find(d => d.year === year && d.category === gender)
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
    { prop: 'gender', label: '性別', width: 80 },
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