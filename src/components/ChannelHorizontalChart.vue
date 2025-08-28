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

  const margin = { top: 20, right: 180, bottom: 40, left: 100 }
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
  const channels = [...new Set(props.data.map(d => d.channel))].sort()
  
  const colorScale = d3.scaleOrdinal()
    .domain(channels)
    .range(d3.schemeSet3)

  const y = d3.scaleBand()
    .domain(years)
    .range([0, height])
    .padding(0.3)

  // 計算每年的總人數
  const yearTotals = {}
  years.forEach(year => {
    yearTotals[year] = d3.sum(props.data.filter(d => d.year === year), d => d.count)
  })
  
  const maxTotal = Math.max(...Object.values(yearTotals))

  const x = d3.scaleLinear()
    .domain([0, maxTotal])
    .nice()
    .range([0, width])

  // Y軸 (年度)
  g.append('g')
    .call(d3.axisLeft(y))
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -80)
    .attr('x', -height / 2)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('年度')

  // X軸 (人數)
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append('text')
    .attr('x', width / 2)
    .attr('y', 35)
    .attr('fill', 'black')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('人數')

  // 準備堆疊數據
  const yearData = years.map(year => {
    const yearObj = { year }
    channels.forEach(channel => {
      const item = props.data.find(d => d.year === year && d.channel === channel)
      yearObj[channel] = item ? item.count : 0
    })
    return yearObj
  })

  const stackData = d3.stack()
    .keys(channels)
    .value((d, key) => d[key] || 0)(yearData)

  // 繪製堆疊橫條圖
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
      const channel = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
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

      tooltip.html(`${year}年 - ${channel}: ${value} 人`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 1)
      d3.selectAll('.d3-tooltip').remove()
    })

  // 圖例
  const legend = svg.append('g')
    .attr('transform', `translate(${width + margin.left + 20}, ${margin.top})`)

  channels.forEach((channel, i) => {
    const legendRow = legend.append('g')
      .attr('transform', `translate(0, ${i * 22})`)

    legendRow.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', colorScale(channel))

    legendRow.append('text')
      .attr('x', 24)
      .attr('y', 14)
      .style('font-size', '13px')
      .text(channel)
  })

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
</script>

<style scoped>
.d3-chart-container {
  width: 100%;
  height: 100%;
  min-height: 440px;
}
</style>