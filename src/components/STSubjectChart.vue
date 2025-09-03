<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>{{ subjectName }}成績分布</span>
        <div>
          <el-button 
            size="small" 
            @click="showTextVersion"
            :disabled="loading"
          >
            文字版
          </el-button>
        </div>
      </div>
    </template>
    
    <div v-loading="loading" element-loading-text="圖表載入中...">
      <div ref="chartContainer" class="d3-chart-container"></div>
    </div>
    
    <!-- 文字版對話框 -->
    <el-dialog
      v-model="textVersionVisible"
      :title="`${subjectName}成績分布 - 文字版`"
      width="800px"
    >
      <div style="margin-bottom: 20px;">
        <el-button 
          type="primary" 
          @click="downloadCSV"
          style="margin-right: 10px;"
        >
          下載 CSV
        </el-button>
        <el-radio-group v-model="displayMode">
          <el-radio value="count">絕對數字</el-radio>
          <el-radio value="percentage">百分比</el-radio>
        </el-radio-group>
      </div>
      
      <el-table :data="tableData" border stripe>
        <el-table-column prop="score" label="級分" width="80" />
        <el-table-column 
          v-for="year in availableYears" 
          :key="year"
          :prop="`year_${year}`"
          :label="`${year}年`"
          :formatter="(row) => formatValue(row[`year_${year}`], row[`year_${year}_total`])"
        />
      </el-table>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import randomColor from 'randomcolor'

const props = defineProps({
  subjectName: {
    type: String,
    required: true
  },
  subjectKey: {
    type: String,
    required: true
  },
  scores: {
    type: Array,
    default: () => []
  },
  benchmark: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  percentageMode: {
    type: Boolean,
    default: false
  }
})

const chartContainer = ref(null)

// 文字版相關狀態
const textVersionVisible = ref(false)
const displayMode = ref('count')
const tableData = ref([])
const availableYears = ref([])

// 顏色配置相關
let useCustomColors = false
let customBenchmarkColors = null

const drawChart = () => {
  if (!chartContainer.value || props.loading) return
  
  // 清除之前的圖表
  d3.select(chartContainer.value).selectAll('*').remove()
  
  if (!props.scores.length) {
    return
  }
  
  // 按年份和級分統計人數，排除0分（未報名）
  const yearScoreData = {}
  const years = new Set()
  
  props.scores.forEach(item => {
    if (item.score > 0 && item.score <= 60) { // 排除0分，分科成績範圍0-60
      const year = item.year
      years.add(year)
      
      if (!yearScoreData[year]) {
        yearScoreData[year] = {}
        for (let i = 1; i <= 60; i++) {
          yearScoreData[year][i] = 0
        }
      }
      yearScoreData[year][item.score]++
    }
  })
  
  const sortedYears = Array.from(years).sort((a, b) => b - a) // 最新年份在上
  const scoreRange = Array.from({length: 60}, (_, i) => i + 1) // 1-60級分
  
  // 準備 stack 資料
  const stackData = sortedYears.map(year => {
    const yearData = { year }
    scoreRange.forEach(score => {
      yearData[score] = yearScoreData[year] ? yearScoreData[year][score] : 0
    })
    return yearData
  })
  
  const margin = { top: 40, right: 30, bottom: 80, left: 80 }
  const containerWidth = chartContainer.value.clientWidth
  const containerHeight = 450
  const width = Math.max(500, containerWidth - margin.left - margin.right)
  const height = containerHeight - margin.top - margin.bottom
  
  const svg = d3.select(chartContainer.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
  
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)
  
  // 設定比例尺
  const yScale = d3.scaleBand()
    .domain(sortedYears)
    .range([0, height])
    .padding(0.2)
  
  // 根據百分比模式設定 x 軸範圍
  let xScale
  if (props.percentageMode) {
    xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width])
  } else {
    // 計算每年的總人數以設定 x 軸範圍
    const maxTotal = d3.max(stackData, d => 
      scoreRange.reduce((sum, score) => sum + d[score], 0)
    )
    
    xScale = d3.scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([0, width])
  }
  
  // 根據五標決定顏色的函數
  const getScoreColor = (score, year) => {
    if (!props.benchmark || !props.benchmark[year]) {
      // 如果沒有五標資料，使用預設顏色
      return '#95A5A6'
    }
    
    const benchmark = props.benchmark[year]
    const scoreNum = parseInt(score)
    
    // 如果使用自定義顏色，從自定義顏色中獲取
    if (useCustomColors && customBenchmarkColors) {
      if (scoreNum >= (benchmark.top || 50)) {
        return customBenchmarkColors.top
      } else if (scoreNum >= (benchmark.front || 40)) {
        return customBenchmarkColors.front
      } else if (scoreNum >= (benchmark.average || 30)) {
        return customBenchmarkColors.average
      } else if (scoreNum >= (benchmark.back || 20)) {
        return customBenchmarkColors.back
      } else if (scoreNum >= (benchmark.bottom || 15)) {
        return customBenchmarkColors.bottom
      } else {
        return customBenchmarkColors.belowBottom
      }
    }
    
    // 使用預設顏色
    if (scoreNum >= (benchmark.top || 50)) {
      return '#E74C3C' // 頂標：紅色
    } else if (scoreNum >= (benchmark.front || 40)) {
      return '#F39C12' // 前標：橙色
    } else if (scoreNum >= (benchmark.average || 30)) {
      return '#F1C40F' // 均標：黃色
    } else if (scoreNum >= (benchmark.back || 20)) {
      return '#95A5A6' // 後標：灰色
    } else if (scoreNum >= (benchmark.bottom || 15)) {
      return '#3498DB' // 底標：藍色
    } else {
      return '#9B59B6' // 低於底標：紫色
    }
  }
  
  // 建立 stack 佈局
  const stack = d3.stack()
    .keys(scoreRange)
    .value((d, key) => d[key])
  
  const stackedData = stack(stackData)
  
  // Y軸（年份）
  g.append('g')
    .call(d3.axisLeft(yScale))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -60)
    .attr('x', -height / 2)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('年度')
  
  // X軸
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .append('text')
    .attr('x', width / 2)
    .attr('y', 45)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text(props.percentageMode ? '百分比 (%)' : '人數')
  
  // 繪製 stack bar
  const layers = g.selectAll('.layer')
    .data(stackedData)
    .enter().append('g')
    .attr('class', 'layer')
  
  layers.selectAll('rect')
    .data(d => d)
    .enter().append('rect')
    .attr('y', d => yScale(d.data.year))
    .attr('x', d => {
      if (props.percentageMode) {
        // 計算年度總人數
        const yearTotal = scoreRange.reduce((sum, score) => sum + d.data[score], 0)
        return xScale((d[0] / yearTotal) * 100)
      }
      return xScale(d[0])
    })
    .attr('width', d => {
      if (props.percentageMode) {
        // 計算年度總人數
        const yearTotal = scoreRange.reduce((sum, score) => sum + d.data[score], 0)
        return xScale((d[1] / yearTotal) * 100) - xScale((d[0] / yearTotal) * 100)
      }
      return xScale(d[1]) - xScale(d[0])
    })
    .attr('height', yScale.bandwidth())
    .attr('fill', function(d) {
      // 從父節點的資料取得score
      const score = d3.select(this.parentNode).datum().key
      return getScoreColor(score, d.data.year)
    })
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const score = d3.select(this.parentNode).datum().key
      const count = d[1] - d[0]
      const year = d.data.year
      
      d3.select(this).style('opacity', 0.8)
      
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
      
      tooltip.transition()
        .duration(200)
        .style('opacity', 0.9)
      
      let tooltipText = `${year}年 ${score}級分: ${count}人`
      if (props.percentageMode) {
        const yearTotal = scoreRange.reduce((sum, s) => sum + d.data[s], 0)
        const percentage = yearTotal > 0 ? ((count / yearTotal) * 100).toFixed(1) : '0.0'
        tooltipText += ` (${percentage}%)`
      }
      
      tooltip.html(tooltipText)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 1)
      d3.selectAll('.d3-tooltip').remove()
    })
  
  // 新增五標圖例說明
  const benchmarkLegend = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top + height + 20})`)
  
  let benchmarkColors
  if (useCustomColors && customBenchmarkColors) {
    benchmarkColors = [
      { name: '頂標', color: customBenchmarkColors.top },
      { name: '前標', color: customBenchmarkColors.front },
      { name: '均標', color: customBenchmarkColors.average },
      { name: '後標', color: customBenchmarkColors.back },
      { name: '底標', color: customBenchmarkColors.bottom },
      { name: '底標以下', color: customBenchmarkColors.belowBottom }
    ]
  } else {
    benchmarkColors = [
      { name: '頂標', color: '#E74C3C' },
      { name: '前標', color: '#F39C12' },
      { name: '均標', color: '#F1C40F' },
      { name: '後標', color: '#95A5A6' },
      { name: '底標', color: '#3498DB' },
      { name: '底標以下', color: '#9B59B6' }
    ]
  }
  
  benchmarkColors.forEach((item, i) => {
    const legendItem = benchmarkLegend.append('g')
      .attr('transform', `translate(${i * 80}, 0)`)
    
    legendItem.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', item.color)
    
    legendItem.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(item.name)
  })
  
}

onMounted(async () => {
  await nextTick()
  drawChart()
  window.addEventListener('resize', drawChart)
})

watch(() => props.scores, () => {
  drawChart()
}, { deep: true })

watch(() => props.benchmark, () => {
  drawChart()
}, { deep: true })

watch(() => props.loading, () => {
  if (!props.loading) {
    nextTick(() => drawChart())
  }
})

watch(() => props.percentageMode, () => {
  drawChart()
})

// 文字版功能函數
const showTextVersion = () => {
  generateTableData()
  textVersionVisible.value = true
}

const generateTableData = () => {
  if (!props.scores || props.scores.length === 0) return
  
  // 獲取所有年份
  const years = [...new Set(props.scores.map(s => s.年度 || s.year))].sort()
  availableYears.value = years
  
  // 創建60個級分的表格行（分科測驗級分範圍 1-60）
  const table = []
  for (let score = 1; score <= 60; score++) {
    const row = { score: `${score}級分` }
    
    years.forEach(year => {
      const yearScores = props.scores.filter(s => (s.年度 || s.year) === year)
      const scoreCount = yearScores.filter(s => (s[props.subjectKey] || s.score) === score).length
      const yearTotal = yearScores.length
      
      row[`year_${year}`] = scoreCount
      row[`year_${year}_total`] = yearTotal
    })
    
    table.push(row)
  }
  
  tableData.value = table
}

const formatValue = (count, total) => {
  if (displayMode.value === 'percentage') {
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
    return `${percentage}%`
  }
  return count || 0
}

const downloadCSV = () => {
  const headers = ['級分', ...availableYears.value.map(year => `${year}年`)]
  const rows = tableData.value.map(row => [
    row.score,
    ...availableYears.value.map(year => formatValue(row[`year_${year}`], row[`year_${year}_total`]))
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
  
  const blob = new Blob(['\uFEFF' + csvContent], { 
    type: 'text/csv;charset=utf-8;' 
  })
  
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${props.subjectName}成績分布.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 重新配色功能
const recolor = () => {
  if (!props.scores || !props.scores.length) return
  
  // 生成新的五標顏色
  const newColors = randomColor({
    count: 6,
    luminosity: 'bright',
    seed: Math.floor(Math.random() * 10000)
  })
  
  customBenchmarkColors = {
    top: newColors[0],        // 頂標
    front: newColors[1],      // 前標
    average: newColors[2],    // 均標
    back: newColors[3],       // 後標
    bottom: newColors[4],     // 底標
    belowBottom: newColors[5] // 底標以下
  }
  
  useCustomColors = true
  
  // 重新繪製圖表
  drawChart()
}

// 暴露方法給父組件
defineExpose({
  recolor
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.d3-chart-container {
  width: 100%;
  height: 500px;
  min-height: 500px;
}
</style>