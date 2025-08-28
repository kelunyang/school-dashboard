<template>
  <div ref="mapContainer" v-loading="loading" style="width: 100%; height: 100%;"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  selectedYear: {
    type: [String, Number],
    default: 'all'
  }
})

const mapContainer = ref(null)
const loading = ref(false)

let map = null
let markersLayer = null

const initMap = async () => {
  if (!mapContainer.value) return

  await nextTick()
  
  // 初始化地圖
  map = L.map(mapContainer.value, {
    center: [23.8, 121],
    zoom: 7,
    zoomControl: true
  })

  // 添加底圖
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  // 初始化標記圖層
  markersLayer = L.layerGroup().addTo(map)
  
  // 如果有資料就繪製
  if (props.data.length > 0) {
    updateMap(props.data)
  }
}

const updateMap = (data) => {
  if (!map || !markersLayer) return

  // 清除現有標記
  markersLayer.clearLayers()

  if (!data.length) return

  // 計算點的大小範圍
  const maxCount = Math.max(...data.map(d => d.count))
  const minSize = 8
  const maxSize = 30

  // 為每個大學添加標記
  data.forEach(university => {
    if (!university.lng || !university.lat) return

    // 計算點的大小
    const size = minSize + (university.count / maxCount) * (maxSize - minSize)
    
    // 根據公私立設定顏色
    const color = university.type === '公立' ? '#409EFF' : 
                  university.type === '私立' ? '#F56C6C' : '#909399'
    
    // 創建標記
    const marker = L.circleMarker([university.lat, university.lng], {
      radius: size,
      fillColor: color,
      color: 'white',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.7
    })

    // 添加彈出視窗
    marker.bindPopup(`
      <div style="font-size: 14px;">
        <strong>${university.name}</strong><br>
        類型: ${university.type}<br>
        錄取人數: ${university.count}人<br>
        權值: ${university.rank || '未知'}
      </div>
    `)

    // 添加懸停效果
    marker.on('mouseover', function() {
      this.setStyle({
        weight: 3,
        fillOpacity: 0.9
      })
    })

    marker.on('mouseout', function() {
      this.setStyle({
        weight: 2,
        fillOpacity: 0.7
      })
    })

    markersLayer.addLayer(marker)
  })

  // 調整視圖以包含所有標記
  if (data.length > 0) {
    const group = new L.featureGroup(markersLayer.getLayers())
    if (group.getBounds().isValid()) {
      map.fitBounds(group.getBounds().pad(0.1))
    }
  }
}

const resizeMap = () => {
  if (map) {
    // 延遲執行以確保容器大小已更新
    setTimeout(() => {
      map.invalidateSize()
    }, 100)
  }
}

onMounted(() => {
  initMap()
  window.addEventListener('resize', resizeMap)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
  window.removeEventListener('resize', resizeMap)
})

watch(() => props.data, (newData) => {
  if (newData) {
    updateMap(newData)
  }
}, { deep: true })

watch(() => props.selectedYear, () => {
  // 年份變化時重新調整地圖視圖
  if (props.data.length > 0) {
    updateMap(props.data)
  }
})
</script>

<style scoped>
:deep(.leaflet-container) {
  height: 100%;
  width: 100%;
}

:deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.8);
}
</style>