<template>
  <div ref="chartContainer" v-loading="loading" style="width: 100%; height: 400px;"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, inject, watch } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  selectedYears: {
    type: Array,
    default: () => []
  },
  studentData: {
    type: Array,
    default: () => []
  },
  isPercentage: {
    type: Boolean,
    default: false
  }
})

// 注入跨功能查詢相關功能
const lockedStudents = inject('lockedStudents')

const chartContainer = ref(null)
const loading = ref(false)

let svg = null
let resizeObserver = null

const loadAndDrawChart = async () => {
  try {
    await nextTick()
    drawChart(props.studentData)
  } catch (error) {
    console.error('載入性別統計資料失敗:', error)
  }
}

const drawChart = (data) => {
  if (!chartContainer.value || !data.length) return
  processGenderData(data)
}

const processGenderData = (studentData) => {
  if (!chartContainer.value || !studentData.length) return

  // 清除舊圖表
  d3.select(chartContainer.value).selectAll("*").remove()

  // 過濾資料並按年份和性別分組（支持多選年份）
  const filteredData = (!props.selectedYears || props.selectedYears.length === 0 || props.selectedYears.length >= 6)
    ? studentData 
    : studentData.filter(d => {
        const itemYear = d['入學年分']
        return props.selectedYears.includes(itemYear)
      })

  const genderByYear = {}
  
  filteredData.forEach(student => {
    const year = student['入學年分']
    const gender = student['性別']
    
    if (!genderByYear[year]) {
      genderByYear[year] = { 男: 0, 女: 0 }
    }
    
    if (gender === '男' || gender === '女') {
      genderByYear[year][gender]++
    }
  })

  // 轉換為D3所需的資料格式
  const years = Object.keys(genderByYear).sort((a, b) => Number(a) - Number(b))
  const genders = ['男', '女']
  
  const stackData = genders.map(gender => ({
    key: gender,
    values: years.map(year => ({
      year: year,
      value: genderByYear[year][gender] || 0
    }))
  }))

  // 設定圖表尺寸
  const container = chartContainer.value
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  
  const margin = { top: 20, right: 80, bottom: 50, left: 60 }
  const width = containerWidth - margin.left - margin.right
  const height = containerHeight - margin.top - margin.bottom

  // 建立SVG
  svg = d3.select(container)
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // 設定比例尺
  const xScale = d3.scaleBand()
    .domain(years)
    .range([0, width])
    .padding(0.1)

  const maxValue = props.isPercentage ? 100 : d3.max(years, year => 
    genders.reduce((sum, gender) => sum + (genderByYear[year][gender] || 0), 0)
  )

  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height, 0])

  // 顏色比例尺
  const colorScale = d3.scaleOrdinal()
    .domain(genders)
    .range(['#409EFF', '#F56C6C'])

  // 堆疊生成器
  const stack = d3.stack()
    .keys(genders)
    .value((d, key) => {
      const rawValue = genderByYear[d][key] || 0
      if (props.isPercentage) {
        const totalForYear = genders.reduce((sum, gender) => sum + (genderByYear[d][gender] || 0), 0)
        return totalForYear > 0 ? (rawValue / totalForYear * 100) : 0
      }
      return rawValue
    })

  const stackedData = stack(years)

  // 設定y軸為橫向，x軸為縱向 - 年份倒序排列（新年份在上方）
  const yBandScale = d3.scaleBand()
    .domain(years.reverse())
    .range([0, height])
    .padding(0.1)

  const xLinearScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, width])

  // 繪製橫向堆疊條形圖
  g.selectAll(".gender-group")
    .data(stackedData)
    .enter().append("g")
    .attr("class", "gender-group")
    .attr("fill", d => colorScale(d.key))
    .selectAll("rect")
    .data(d => d)
    .enter().append("rect")
    .attr("y", d => yBandScale(d.data))
    .attr("x", d => xLinearScale(d[0]))
    .attr("width", d => xLinearScale(d[1]) - xLinearScale(d[0]))
    .attr("height", yBandScale.bandwidth())
    .on("mouseover", function(event, d) {
      const gender = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
      const year = d.data
      
      // 計算原始數值和百分比
      const rawValue = genderByYear[year][gender] || 0
      const totalForYear = genders.reduce((sum, g) => sum + (genderByYear[year][g] || 0), 0)
      const percentage = totalForYear > 0 ? (rawValue / totalForYear * 100).toFixed(1) : '0.0'
      
      // 建立tooltip
      const tooltip = d3.select("body").append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000")

      tooltip.transition()
        .duration(200)
        .style("opacity", 1)

      // 根據模式顯示不同內容
      const tooltipContent = props.isPercentage 
        ? `${year}年 ${gender}: ${percentage}% (${rawValue}人)`
        : `${year}年 ${gender}: ${rawValue}人 (${percentage}%)`

      tooltip.html(tooltipContent)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
    })
    .on("mouseout", function() {
      d3.selectAll(".chart-tooltip").remove()
    })

  // X軸（橫向顯示人數或百分比）
  const xAxis = d3.axisBottom(xLinearScale)
  if (props.isPercentage) {
    xAxis.tickFormat(d => d + '%')
  }
  
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text(props.isPercentage ? "百分比" : "人數")

  // Y軸（縱向顯示年分）
  g.append("g")
    .call(d3.axisLeft(yBandScale))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -height / 2)
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text("入學年分")

  // 圖例
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width + 20}, 20)`)

  const legendItems = legend.selectAll(".legend-item")
    .data(genders)
    .enter().append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)

  legendItems.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", d => colorScale(d))

  legendItems.append("text")
    .attr("x", 20)
    .attr("y", 12)
    .style("font-size", "12px")
    .text(d => d)

  // 標題
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text(props.isPercentage ? "性別分布統計（百分比）" : "性別分布統計")
}

const setupResizeObserver = () => {
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (svg) {
        loadAndDrawChart()
      }
    })
    resizeObserver.observe(chartContainer.value)
  }
}

onMounted(() => {
  loadAndDrawChart()
  setupResizeObserver()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// 監聽學生資料或年份變化
watch([() => props.studentData, () => props.selectedYears], () => {
  console.log('GenderChart: 學生資料或年份變更，重新繪製圖表')
  if (!lockedStudents.value || lockedStudents.value.length === 0) {
    loadAndDrawChart()
  }
}, { deep: true })

// 監聽鎖定學生名單變化
watch(() => lockedStudents.value, () => {
  loadAndDrawChart()
}, { deep: true })

// 監聽百分比模式變化
watch(() => props.isPercentage, () => {
  console.log('GenderChart: 百分比模式變更，重新繪製圖表')
  loadAndDrawChart()
})
</script>

<style scoped>
/* 載入動畫樣式 */
:deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.8);
}
</style>