<template>
  <div v-loading="isLoading" element-loading-text="圖表載入中...">
    <div class="map-info" style="margin-bottom: 10px;">
      <span class="legend-text">熱力圖顯示學生住址密度分布</span>
    </div>
    <div ref="mapContainer" class="map-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

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
let heatLayer = null

const initMap = async () => {
  await nextTick()
  
  if (!mapContainer.value) return

  // 初始化地圖（以台灣為中心）
  map = L.map(mapContainer.value).setView([23.8, 121.0], 8)

  // 添加地圖圖層
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  updateMapData()
}

const finishLoading = () => {
  // 地圖初始化完成後關閉載入動畫
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

const updateMapData = () => {
  if (!map) return

  // 清除現有熱力圖層
  if (heatLayer) map.removeLayer(heatLayer)

  if (!props.data.length) {
    isLoading.value = false
    return
  }
  
  isLoading.value = true

  updateHeatmap()

  // 自動調整地圖視野
  if (props.data.length > 0) {
    const bounds = L.latLngBounds(props.data.map(item => [item.lat, item.lng]))
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.1))
    }
  }
  
  // 地圖渲染完成，關閉載入動畫
  isLoading.value = false
}

const updateHeatmap = () => {
  // 為熱力圖準備數據格式: [lat, lng, intensity]
  const heatData = props.data
    .filter(item => item.lat && item.lng && !isNaN(item.lat) && !isNaN(item.lng))
    .map(item => [item.lat, item.lng, 1]) // 每個學生為 1 個單位

  if (heatData.length > 0) {
    heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan', 
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map)
  }
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

.map-info {
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-text {
  font-size: 14px;
  color: #666;
  text-align: center;
}
</style>