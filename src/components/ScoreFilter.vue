<template>
  <div class="score-filter">
    <el-dropdown trigger="click" @visible-change="handleDropdownChange">
      <el-button type="primary" text>
        {{ displayText }}
        <el-icon class="el-icon--right">
          <arrow-down />
        </el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <div class="score-slider-container">
            <div class="slider-header">
              <span>{{ subjectName }}</span>
              <el-button size="small" text @click="resetRange">重設</el-button>
            </div>
            <div class="slider-content">
              <div class="range-display">
                <span>{{ minScore }}</span>
                <span>到</span>
                <span>{{ maxScore }}</span>
                <span>分</span>
              </div>
              <el-slider
                v-model="scoreRange"
                range
                :min="0"
                :max="maxRange"
                :step="1"
                @change="handleRangeChange"
                style="margin: 20px 0;"
              />
              <div class="range-labels">
                <span>0</span>
                <span style="float: right;">{{ maxRange }}</span>
              </div>
              
              <!-- 過濾空值選項 -->
              <div class="filter-empty-option">
                <el-checkbox v-model="filterEmptyScores">
                  過濾掉沒有這科分數的學生
                </el-checkbox>
              </div>
            </div>
            <div class="slider-footer">
              <el-button size="small" @click="applyFilter">套用</el-button>
              <el-button size="small" plain @click="clearFilter">清除</el-button>
            </div>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  subjectName: {
    type: String,
    required: true
  },
  subjectKey: {
    type: String,
    required: true
  },
  modelValue: {
    type: Object,
    default: () => ({ min: null, max: null, filterEmptyScores: false })
  },
  maxRange: {
    type: Number,
    default: 100 // 預設為100，但可以由父組件設定為15或60
  }
})

const emit = defineEmits(['update:modelValue', 'filter-change'])

const scoreRange = ref([0, props.maxRange])
const filterEmptyScores = ref(false)
const isActive = ref(false)

const minScore = computed(() => scoreRange.value[0])
const maxScore = computed(() => scoreRange.value[1])

const displayText = computed(() => {
  const hasRangeFilter = props.modelValue.min !== null || props.modelValue.max !== null
  const hasEmptyFilter = props.modelValue.filterEmptyScores
  
  if (hasRangeFilter || hasEmptyFilter) {
    let text = props.subjectName
    if (hasRangeFilter) {
      const min = props.modelValue.min ?? 0
      const max = props.modelValue.max ?? props.maxRange
      text += `: ${min}-${max}分`
    }
    if (hasEmptyFilter) {
      text += hasRangeFilter ? ' (已過濾空值)' : ' (過濾空值)'
    }
    return text
  }
  return props.subjectName
})

const handleDropdownChange = (visible) => {
  if (visible) {
    // 重置滑桿到當前過濾值
    if (props.modelValue.min !== null || props.modelValue.max !== null) {
      scoreRange.value = [
        props.modelValue.min ?? 0,
        props.modelValue.max ?? props.maxRange
      ]
    } else {
      scoreRange.value = [0, props.maxRange]
    }
    // 重置 checkbox 狀態
    filterEmptyScores.value = props.modelValue.filterEmptyScores || false
  }
}

const handleRangeChange = (value) => {
  scoreRange.value = value
}

const resetRange = () => {
  scoreRange.value = [0, props.maxRange]
  filterEmptyScores.value = false
}

const applyFilter = () => {
  const newValue = {
    min: scoreRange.value[0] === 0 ? null : scoreRange.value[0],
    max: scoreRange.value[1] === props.maxRange ? null : scoreRange.value[1],
    filterEmptyScores: filterEmptyScores.value
  }
  
  emit('update:modelValue', newValue)
  emit('filter-change', {
    subject: props.subjectKey,
    range: newValue
  })
}

const clearFilter = () => {
  const newValue = { min: null, max: null, filterEmptyScores: false }
  scoreRange.value = [0, props.maxRange]
  filterEmptyScores.value = false
  
  emit('update:modelValue', newValue)
  emit('filter-change', {
    subject: props.subjectKey,
    range: newValue
  })
}
</script>

<style scoped>
.score-filter {
  display: inline-block;
}

.score-slider-container {
  padding: 16px;
  min-width: 320px;
  width: 320px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 500;
}

.slider-content {
  margin-bottom: 16px;
}

.range-display {
  text-align: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #606266;
}

.range-display span {
  margin: 0 4px;
}

.range-labels {
  font-size: 12px;
  color: #909399;
  margin-top: -10px;
}

.slider-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.slider-footer .el-button {
  flex: 1;
}

.filter-empty-option {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
</style>