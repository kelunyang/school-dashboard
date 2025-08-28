<template>
  <div class="special-attributes-chart">
    <div ref="chartContainer" style="height: 400px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
// import * as echarts from 'echarts'
import * as d3 from 'd3'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartContainer = ref(null)
// let chartInstance = null
let svg = null
let resizeObserver = null

// const initChart = () => {
//   if (chartContainer.value && !chartInstance) {
//     chartInstance = echarts.init(chartContainer.value)
//     updateChart()
//   }
// }

const updateChart = () => {
  // if (!chartInstance || !props.data.length) return
  if (!chartContainer.value || !props.data.length) return

  // 清除舊圖表
  d3.select(chartContainer.value).selectAll("*").remove()

  // 準備數據
  const categories = []
  const series = {
    indigenous: { name: '原住民', data: [], stack: 'total' },
    specialEducation: { name: '特教生', data: [], stack: 'total' },
    lowIncome: { name: '中低收', data: [], stack: 'total' }
  }

  // 處理每個年份學期的數據
  props.data.forEach(yearData => {
    const categoryName = `${yearData.year}-${yearData.semester === 1 ? '上' : '下'}`
    categories.push(categoryName)

    // 原住民數據（排除"無"）
    const indigenousCount = Object.entries(yearData.indigenous)
      .filter(([key]) => key !== '無')
      .reduce((sum, [, value]) => sum + value, 0)
    series.indigenous.data.push(indigenousCount)

    // 特教生數據
    series.specialEducation.data.push(yearData.specialEducation.true || 0)

    // 中低收數據（排除"無"）
    const lowIncomeCount = Object.entries(yearData.lowIncome)
      .filter(([key]) => key !== '無')
      .reduce((sum, [, value]) => sum + value, 0)
    series.lowIncome.data.push(lowIncomeCount)
  })

  // D3.js 實作
  const container = chartContainer.value
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  
  const margin = { top: 60, right: 120, bottom: 50, left: 60 }
  const width = containerWidth - margin.left - margin.right
  const height = containerHeight - margin.top - margin.bottom

  // 建立 SVG
  svg = d3.select(container)
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // 設定比例尺
  const xScale = d3.scaleBand()
    .domain(categories)
    .range([0, width])
    .padding(0.2)

  // 計算堆疊數據的最大值
  const maxValue = d3.max(categories.map((_, i) => 
    series.indigenous.data[i] + series.specialEducation.data[i] + series.lowIncome.data[i]
  ))

  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height, 0])

  // 顏色比例尺
  const colorScale = d3.scaleOrdinal()
    .domain(['原住民', '特教生', '中低收'])
    .range(['#5470c6', '#91cc75', '#fac858'])

  // 準備堆疊數據
  const stackData = categories.map((category, i) => ({
    category: category,
    原住民: series.indigenous.data[i],
    特教生: series.specialEducation.data[i],
    中低收: series.lowIncome.data[i]
  }))

  // 堆疊生成器
  const stack = d3.stack()
    .keys(['原住民', '特教生', '中低收'])

  const stackedData = stack(stackData)

  // 繪製堆疊條形圖
  const groups = g.selectAll(".layer")
    .data(stackedData)
    .enter().append("g")
    .attr("class", "layer")
    .attr("fill", d => colorScale(d.key))

  groups.selectAll("rect")
    .data(d => d)
    .enter().append("rect")
    .attr("x", d => xScale(d.data.category))
    .attr("y", d => yScale(d[1]))
    .attr("height", d => yScale(d[0]) - yScale(d[1]))
    .attr("width", xScale.bandwidth())
    .on("mouseover", function(event, d) {
      const layer = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
      
      // 建立 tooltip
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

      tooltip.html(`${d.data.category}<br/>${layer}: ${value}人`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px")
    })
    .on("mouseout", function() {
      d3.selectAll(".chart-tooltip").remove()
    })

  // X 軸
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale))

  // Y 軸
  g.append("g")
    .call(d3.axisLeft(yScale))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -40)
    .attr("x", -height / 2)
    .attr("fill", "black")
    .style("text-anchor", "middle")
    .text("人數")

  // 標題
  g.append("text")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("特殊身分學生統計")

  // 圖例
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width + 20}, 20)`)

  const legendItems = legend.selectAll(".legend-item")
    .data(['原住民', '特教生', '中低收'])
    .enter().append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 25})`)

  legendItems.append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", d => colorScale(d))

  legendItems.append("text")
    .attr("x", 24)
    .attr("y", 14)
    .style("font-size", "12px")
    .text(d => d)

  // const option = {
  //   title: {
  //     text: '特殊身分學生統計',
  //     left: 'center'
  //   },
  //   tooltip: {
  //     trigger: 'axis',
  //     axisPointer: {
  //       type: 'shadow'
  //     },
  //     formatter: function(params) {
  //       let tooltip = params[0].name + '<br/>'
  //       params.forEach(param => {
  //         tooltip += `${param.marker}${param.seriesName}: ${param.value}<br/>`
  //       })
  //       return tooltip
  //     }
  //   },
  //   legend: {
  //     data: ['原住民', '特教生', '中低收'],
  //     top: 30
  //   },
  //   grid: {
  //     left: '3%',
  //     right: '4%',
  //     bottom: '3%',
  //     top: 80,
  //     containLabel: true
  //   },
  //   xAxis: [
  //     {
  //       type: 'category',
  //       data: categories,
  //       axisTick: {
  //         alignWithLabel: true
  //       }
  //     }
  //   ],
  //   yAxis: [
  //     {
  //       type: 'value',
  //       name: '人數'
  //     }
  //   ],
  //   series: [
  //     {
  //       name: '原住民',
  //       type: 'bar',
  //       stack: 'total',
  //       data: series.indigenous.data,
  //       itemStyle: {
  //         color: '#5470c6'
  //       }
  //     },
  //     {
  //       name: '特教生',
  //       type: 'bar',
  //       stack: 'total',
  //       data: series.specialEducation.data,
  //       itemStyle: {
  //         color: '#91cc75'
  //       }
  //     },
  //     {
  //       name: '中低收',
  //       type: 'bar',
  //       stack: 'total',
  //       data: series.lowIncome.data,
  //       itemStyle: {
  //         color: '#fac858'
  //       }
  //     }
  //   ]
  // }

  // chartInstance.setOption(option, true)
}

// const resizeChart = () => {
//   if (chartInstance) {
//     chartInstance.resize()
//   }
// }

const setupResizeObserver = () => {
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (svg) {
        updateChart()
      }
    })
    resizeObserver.observe(chartContainer.value)
  }
}

// 監聽數據變化
watch(() => props.data, () => {
  updateChart()
}, { deep: true })

// 監聽窗口大小變化
onMounted(() => {
  // initChart()
  // window.addEventListener('resize', resizeChart)
  updateChart()
  setupResizeObserver()
})

// 清理
// import { onUnmounted } from 'vue'
onUnmounted(() => {
  // window.removeEventListener('resize', resizeChart)
  // if (chartInstance) {
  //   chartInstance.dispose()
  //   chartInstance = null
  // }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.special-attributes-chart {
  width: 100%;
  height: 400px;
}
</style>