<template>
  <div v-loading="isLoading" element-loading-text="圖表載入中...">
    <div ref="chartContainer" class="d3-chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  isPercentage: {
    type: Boolean,
    default: false
  }
})

const chartContainer = ref(null)
const isLoading = ref(true)

const drawChart = () => {
  if (!chartContainer.value) return
  
  if (!props.data.length) {
    isLoading.value = false
    return
  }
  
  isLoading.value = true

  d3.select(chartContainer.value).selectAll('*').remove()

  const margin = { top: 20, right: 180, bottom: 40, left: 80 }
  const containerWidth = chartContainer.value.clientWidth
  const containerHeight = chartContainer.value.clientHeight || 440
  const width = Math.max(300, containerWidth - margin.left - margin.right)
  const height = Math.max(300, containerHeight - margin.top - margin.bottom)

  const svg = d3.select(chartContainer.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const years = [...new Set(props.data.map(d => d.year))].sort()
  const scoreRanges = [...new Set(props.data.map(d => d.category))].sort((a, b) => {
    return parseInt(a) - parseInt(b)
  })

  // 使用色彩插值生成足夠的顏色
  const colorScale = d3.scaleOrdinal()
    .domain(scoreRanges)
    .range(d3.quantize(d3.interpolateSpectral, scoreRanges.length))

  const y = d3.scaleBand()
    .domain(years.reverse())
    .range([0, height])
    .padding(0.3)

  const yearTotals = {}
  years.forEach(year => {
    yearTotals[year] = d3.sum(props.data.filter(d => d.year === year), d => d.count)
  })
  
  const maxTotal = props.isPercentage ? 100 : Math.max(...Object.values(yearTotals))

  const x = d3.scaleLinear()
    .domain([0, maxTotal])
    .nice()
    .range([0, width])

  // Y軸 (年度)
  g.append('g')
    .call(d3.axisLeft(y))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -60)
    .attr('x', -height / 2)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('年度')

  // X軸 (人數/百分比)
  const xAxis = props.isPercentage ? d3.axisBottom(x).tickFormat(d => `${d}%`) : d3.axisBottom(x)
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis)
    .append('text')
    .attr('x', width / 2)
    .attr('y', 35)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text(props.isPercentage ? '百分比 (%)' : '人數')

  const yearData = years.map(year => {
    const yearObj = { year }
    const yearTotal = yearTotals[year]
    
    scoreRanges.forEach(range => {
      const item = props.data.find(d => d.year === year && d.category === range)
      const originalValue = item ? item.count : 0
      
      if (props.isPercentage && yearTotal > 0) {
        yearObj[range] = (originalValue / yearTotal) * 100
        yearObj[`${range}_original`] = originalValue
      } else {
        yearObj[range] = originalValue
        yearObj[`${range}_original`] = originalValue
      }
    })
    return yearObj
  })

  const stackData = d3.stack()
    .keys(scoreRanges)
    .value((d, key) => d[key] || 0)(yearData)

  const groups = g.selectAll('.layer')
    .data(stackData)
    .enter().append('g')
    .attr('class', 'layer')
    .style('fill', d => colorScale(d.key))

  groups.selectAll('rect')
    .data(d => d)
    .enter().append('rect')
    .attr('y', d => y(d.data.year))
    .attr('x', d => x(d[0]))
    .attr('width', d => x(d[1]) - x(d[0]))
    .attr('height', y.bandwidth())
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const range = d3.select(this.parentNode).datum().key
      const displayValue = d[1] - d[0]
      const originalValue = d.data[`${range}_original`]
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
        .style('opacity', .9)

      const tooltipText = props.isPercentage 
        ? `${year}年 - 積分 ${range}: ${displayValue.toFixed(1)}% (${originalValue}人)`
        : `${year}年 - 積分 ${range}: ${originalValue}人`
      
      tooltip.html(tooltipText)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 1)
      d3.selectAll('.d3-tooltip').remove()
    })

  const legend = svg.append('g')
    .attr('transform', `translate(${width + margin.left + 20}, ${margin.top})`)

  // 由於分數項目可能很多，只顯示部分圖例
  const maxLegendItems = 20
  const displayRanges = scoreRanges.slice(0, maxLegendItems)
  const legendItemsPerColumn = 10
  const legendColumns = Math.ceil(displayRanges.length / legendItemsPerColumn)

  displayRanges.forEach((range, i) => {
    const column = Math.floor(i / legendItemsPerColumn)
    const row = i % legendItemsPerColumn
    
    const legendRow = legend.append('g')
      .attr('transform', `translate(${column * 50}, ${row * 18})`)

    legendRow.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colorScale(range))

    legendRow.append('text')
      .attr('x', 16)
      .attr('y', 10)
      .style('font-size', '10px')
      .text(`${range}分`)
  })
  
  // 如果項目太多，顯示提示
  if (scoreRanges.length > maxLegendItems) {
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendItemsPerColumn * 18 + 10)
      .style('font-size', '10px')
      .style('font-style', 'italic')
      .style('fill', '#666')
      .text(`... 還有 ${scoreRanges.length - maxLegendItems} 個分數`)
  }

  // 在每個橫條右側顯示總人數
  years.forEach(year => {
    const total = yearTotals[year]
    g.append('text')
      .attr('x', x(total) + 5)
      .attr('y', y(year) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'start')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(total)
  })
  
  // 繪製完成，關閉載入動畫
  isLoading.value = false
}

onMounted(() => {
  drawChart()
  window.addEventListener('resize', drawChart)
})

watch(() => props.data, () => {
  drawChart()
}, { deep: true })

watch(() => props.isPercentage, () => {
  drawChart()
})
</script>

<style scoped>
.d3-chart-container {
  width: 100%;
  height: 100%;
  min-height: 440px;
}
</style>