<template>
  <div class="chart-wrapper">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-actions">
        <div v-if="showPercentageToggle" class="percentage-toggle">
          <span class="toggle-label">百分比模式</span>
          <el-switch 
            v-model="isPercentageMode"
            @change="togglePercentageMode"
            active-text=""
            inactive-text=""
            :title="isPercentageMode ? '切換到絕對數量' : '切換到百分比模式'"
          />
        </div>
        <el-button 
          v-if="chartData && chartData.length > 0"
          type="text" 
          @click="showTextVersion"
          title="查看文字版表格"
          class="text-version-btn"
        >
          文字版
        </el-button>
        <el-button 
          type="text" 
          :icon="Download" 
          @click="downloadChart"
          title="下載圖表 (SVG)"
          class="download-btn"
        >
          下載
        </el-button>
      </div>
    </div>
    <div ref="chartContent" class="chart-content">
      <slot></slot>
    </div>
    
    <!-- 文字版對話框 -->
    <el-dialog
      v-model="textVersionVisible"
      :title="`${title} - 文字版`"
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
        <el-table-column 
          v-for="column in tableColumns" 
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :formatter="column.formatter"
        />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { useChartDownload } from '../composables/useChartDownload'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: ''
  },
  showPercentageToggle: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Boolean,
    default: false
  },
  chartData: {
    type: Array,
    default: () => []
  },
  textFormatter: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const isPercentageMode = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const chartContent = ref(null)
const { downloadSVG } = useChartDownload()

// 文字版相關狀態
const textVersionVisible = ref(false)
const displayMode = ref('count')
const tableData = ref([])
const tableColumns = ref([])

const togglePercentageMode = (value) => {
  // switch 會自動更新 isPercentageMode，這裡不需要額外操作
  // 如果需要額外處理，可以在這裡添加
}

const downloadChart = () => {
  const svgElement = chartContent.value?.querySelector('svg')
  if (svgElement) {
    const fileName = props.fileName || props.title.replace(/\s+/g, '_')
    downloadSVG(svgElement, fileName)
  }
}

// 文字版功能函數
const showTextVersion = () => {
  if (props.textFormatter && props.chartData) {
    const formattedData = props.textFormatter(props.chartData, displayMode.value)
    tableData.value = formattedData.data
    tableColumns.value = formattedData.columns
    textVersionVisible.value = true
  }
}

const downloadCSV = () => {
  if (!tableData.value || tableData.value.length === 0) return
  
  const headers = tableColumns.value.map(col => col.label)
  const rows = tableData.value.map(row => 
    tableColumns.value.map(col => row[col.prop] || '')
  )
  
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
  link.setAttribute('download', `${props.title}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
.chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 10px;
}

.chart-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.chart-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.download-btn {
  color: #409eff;
  font-size: 12px;
  padding: 4px 8px;
}

.download-btn:hover {
  background-color: #ecf5ff;
  color: #337ecc;
}

.percentage-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 12px;
}

.toggle-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}

.chart-content {
  width: 100%;
  height: calc(100% - 50px);
}
</style>