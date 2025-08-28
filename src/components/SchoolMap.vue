<template>
  <div v-loading="isLoading" element-loading-text="圖表載入中...">
    <div class="map-controls" style="margin-bottom: 15px;">
      <span class="legend-text">圓圈大小代表錄取人數，點擊可查看詳細資訊</span>
    </div>
    <div ref="mapContainer" class="map-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// 修復 Leaflet 圖標問題
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  selectedYears: {
    type: Array,
    default: () => []
  }
})

const mapContainer = ref(null)
const isLoading = ref(true)
let map = null
let markersLayer = null

const initMap = async () => {
  await nextTick()
  
  if (!mapContainer.value) return

  // 初始化地圖（以台灣為中心）
  map = L.map(mapContainer.value).setView([23.8, 121.0], 8)

  // 添加地圖圖層
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  // 創建標記圖層組
  markersLayer = L.layerGroup().addTo(map)

  updateMapData()
}

const finishLoading = () => {
  // 地圖初始化完成後關閉載入動畫
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

const updateMapData = () => {
  if (!map || !markersLayer) return

  // 清除現有標記
  markersLayer.clearLayers()

  if (!props.data.length) {
    isLoading.value = false
    return
  }
  
  isLoading.value = true

  // 計算圓圈大小比例
  const maxCount = Math.max(...props.data.map(item => item.count))
  const minRadius = 8
  const maxRadius = 30

  props.data.forEach(school => {
    if (school.lng && school.lat && !isNaN(school.lng) && !isNaN(school.lat)) {
      // 計算圓圈半徑
      const radius = minRadius + (school.count / maxCount) * (maxRadius - minRadius)
      
      // 根據錄取人數設定顏色
      let color = '#3388ff'
      if (school.count >= 10) color = '#ff4444'
      else if (school.count >= 5) color = '#ff8800'
      else if (school.count >= 2) color = '#ffcc00'

      // 創建圓形標記
      const circle = L.circleMarker([school.lat, school.lng], {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
      })

      // 設定彈出視窗內容
      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 10px 0; color: #333;">${school.schoolName}</h4>
          <p style="margin: 5px 0;"><strong>學校代碼:</strong> ${school.schoolCode}</p>
          <p style="margin: 5px 0;"><strong>錄取人數:</strong> ${school.count} 人</p>
          ${props.selectedYear !== 'all' ? `<p style="margin: 5px 0;"><strong>年度:</strong> ${school.year}</p>` : ''}
          <p style="margin: 5px 0; font-size: 12px; color: #666;">
            座標: ${school.lat.toFixed(4)}, ${school.lng.toFixed(4)}
          </p>
        </div>
      `

      circle.bindPopup(popupContent)
      
      // 滑鼠懸停效果
      circle.on('mouseover', function() {
        this.setStyle({
          fillOpacity: 0.9,
          weight: 3
        })
      })
      
      circle.on('mouseout', function() {
        this.setStyle({
          fillOpacity: 0.7,
          weight: 2
        })
      })

      markersLayer.addLayer(circle)
    }
  })

  // 自動調整地圖視野以包含所有標記
  if (props.data.length > 0) {
    const group = new L.featureGroup(markersLayer.getLayers())
    if (group.getBounds().isValid()) {
      map.fitBounds(group.getBounds().pad(0.1))
    }
  }
  
  // 地圖渲染完成，關閉載入動畫
  isLoading.value = false
}

onMounted(() => {
  initMap()
  finishLoading()
})

watch(() => props.data, () => {
  if (map) {
    updateMapData()
  }
}, { deep: true })
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 550px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.map-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.legend-text {
  font-size: 14px;
  color: #666;
}

@media (max-width: 768px) {
  .map-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>