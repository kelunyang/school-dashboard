<template>
  <div ref="chartContainer" v-loading="loading" style="width: 100%; height: 400px;"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  isPercentage: {
    type: Boolean,
    default: false
  }
})

const chartContainer = ref(null)
const loading = ref(false)

let svg = null
let resizeObserver = null

const drawChart = async (data) => {
  if (!chartContainer.value || !data.length) return

  await nextTick()

  // 清除舊圖表
  d3.select(chartContainer.value).selectAll("*").remove()

  // 數據分組
  const groupedData = d3.group(data, d => d.category)
  const categories = Array.from(groupedData.keys())
  const years = [...new Set(data.map(d => d.year))].sort()

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

  // 設定比例尺 - 年份倒序排列（新年份在上方）
  const yScale = d3.scaleBand()
    .domain(years.reverse())
    .range([0, height])
    .padding(0.1)

  const maxValue = props.isPercentage ? 100 : d3.max(years, year => 
    categories.reduce((sum, category) => {
      const yearData = data.find(d => d.year === year && d.category === category)
      return sum + (yearData ? yearData.count : 0)
    }, 0)
  )

  const xScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, width])

  // 顏色比例尺 - 公私立用不同顏色
  const colorScale = d3.scaleOrdinal()
    .domain(['公立', '私立', '未知'])
    .range(['#409EFF', '#F56C6C', '#909399'])

  // 堆疊資料
  const stackData = categories.map(category => ({
    key: category,
    values: years.map(year => {
      const item = data.find(d => d.year === year && d.category === category)
      return {
        year: year,
        value: item ? item.count : 0
      }
    })
  }))

  // 計算堆疊位置
  years.forEach(year => {
    // 先計算該年份的總數
    const yearTotal = stackData.reduce((sum, stack) => {
      const value = stack.values.find(v => v.year === year)
      return sum + value.value
    }, 0)
    
    let offset = 0
    stackData.forEach(stack => {
      const value = stack.values.find(v => v.year === year)
      if (props.isPercentage && yearTotal > 0) {
        const percentage = (value.value / yearTotal) * 100
        value.x0 = offset
        value.x1 = offset + percentage
        offset += percentage
        value.displayValue = percentage
        value.originalValue = value.value
      } else {
        value.x0 = offset
        value.x1 = offset + value.value
        offset += value.value
        value.displayValue = value.value
        value.originalValue = value.value
      }
    })
  })

  // 繪製橫向堆疊條形圖
  stackData.forEach(stack => {
    g.selectAll(`.bar-${stack.key}`)
      .data(stack.values)
      .enter().append("rect")
      .attr("class", `bar-${stack.key}`)
      .attr("y", d => yScale(d.year))
      .attr("x", d => xScale(d.x0))
      .attr("width", d => xScale(d.x1) - xScale(d.x0))
      .attr("height", yScale.bandwidth())
      .attr("fill", colorScale(stack.key))
      .on("mouseover", function(event, d) {
        // Tooltip
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

        const tooltipText = props.isPercentage 
          ? `${d.year}年 ${stack.key}: ${d.displayValue.toFixed(1)}% (${d.originalValue}人)`
          : `${d.year}年 ${stack.key}: ${d.originalValue}人`
        tooltip.html(tooltipText)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px")
      })
      .on("mouseout", function() {
        d3.selectAll(".chart-tooltip").remove()
      })
  })

  // X軸
  const xAxis = props.isPercentage ? d3.axisBottom(xScale).tickFormat(d => `${d}%`) : d3.axisBottom(xScale)
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text(props.isPercentage ? "百分比 (%)" : "人數")

  // Y軸
  g.append("g")
    .call(d3.axisLeft(yScale))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -height / 2)
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text("年分")

  // 圖例
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width + 20}, 20)`)

  const legendItems = legend.selectAll(".legend-item")
    .data(categories)
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
}

const setupResizeObserver = () => {
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (svg && props.data.length > 0) {
        drawChart(props.data)
      }
    })
    resizeObserver.observe(chartContainer.value)
  }
}

onMounted(() => {
  setupResizeObserver()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

watch(() => props.data, (newData) => {
  if (newData && newData.length > 0) {
    drawChart(newData)
  }
}, { deep: true })

watch(() => props.isPercentage, () => {
  if (props.data && props.data.length > 0) {
    drawChart(props.data)
  }
})
</script>

<style scoped>
:deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.8);
}
</style>