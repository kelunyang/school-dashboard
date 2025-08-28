<template>
  <!-- 多重條件搜尋器抽屜 -->
  <el-drawer
    v-model="dialogVisible"
    title="多重條件搜尋器"
    direction="ttb"
    size="80%"
    :close-on-click-modal="false"
    @closed="onDialogClosed"
  >
    <!-- 載入舊篩選器提示 -->
    <el-alert
      v-if="showLoadOldFiltersAlert"
      title="偵測到已儲存的篩選條件"
      type="info"
      :closable="false"
      style="margin-bottom: 20px;"
    >
      <template #default>
        <p>發現已儲存的篩選條件，是否要載入？</p>
        <div style="margin-top: 10px;">
          <el-button size="small" type="primary" @click="loadOldFilters">載入舊條件</el-button>
          <el-button size="small" @click="dismissLoadAlert">忽略</el-button>
        </div>
      </template>
    </el-alert>

    <div class="filter-info">
      <el-alert 
        type="info" 
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <strong>篩選邏輯說明：</strong> 多個條件會依序進行 AND 篩選，即每個條件都必須滿足。每個條件內的多行正規表達式則是 OR 關係（任一匹配即可）。
        </template>
      </el-alert>
    </div>

    <div class="advanced-filter-container">
      <div 
        v-for="(condition, index) in advancedConditions" 
        :key="condition.id"
        class="filter-condition-row"
      >
        <div class="condition-left">
          <h4>條件 {{ index + 1 }} <span v-if="index > 0" class="and-label">AND</span></h4>
          <div class="field-selector">
            <label>選擇欄位：</label>
            <el-select 
              v-model="condition.field" 
              placeholder="請選擇欄位"
              style="width: 200px;"
              @change="onFieldChange(condition)"
            >
              <el-option
                v-for="field in availableFields"
                :key="field.value"
                :label="field.label"
                :value="field.value"
              />
            </el-select>
          </div>
        </div>
        
        <div class="condition-right">
          <div class="regex-input">
            <label>搜尋條件 (一行一個條件，行間為 OR 關係)：</label>
            <el-input
              v-model="condition.patterns"
              type="textarea"
              :rows="6"
              placeholder="例如：&#10;張三&#10;李四&#10;王.*五"
              style="width: 100%;"
            />
            <div class="pattern-help">
              <small>
                支援regex，或者你也可以輸入不完整的字串，系統會模糊搜尋
              </small>
            </div>
          </div>
        </div>
        
        <div class="condition-actions">
          <el-button
            type="danger"
            :icon="Delete"
            circle
            size="small"
            @click="removeCondition(index)"
            :disabled="advancedConditions.length === 1"
          />
        </div>
      </div>
      
      <div class="add-condition">
        <el-button 
          type="success" 
          :icon="Plus" 
          @click="addCondition"
          style="width: 100%;"
        >
          新增篩選條件 (AND)
        </el-button>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="cancelAdvancedFilter">取消</el-button>
        <el-button @click="clearAdvancedFilters">清除所有條件</el-button>
        <el-button type="primary" @click="applyAdvancedFilter">套用篩選</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  availableFields: {
    type: Array,
    default: () => []
  },
  storageKey: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'apply-filters'])

// 對話框顯示狀態
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 多重條件搜尋器狀態
const showLoadOldFiltersAlert = ref(false)
const advancedConditions = ref([])
let conditionIdCounter = 1

// 初始化空條件
const createEmptyCondition = () => ({
  id: conditionIdCounter++,
  field: '',
  patterns: ''
})

// 顯示進階篩選器
const showAdvancedFilter = () => {
  // 檢查是否有已儲存的篩選條件
  const savedConditions = loadAdvancedFilters()
  
  if (savedConditions && savedConditions.length > 0) {
    showLoadOldFiltersAlert.value = true
  } else {
    showLoadOldFiltersAlert.value = false
  }
  
  // 如果沒有任何條件，初始化一個空條件
  if (advancedConditions.value.length === 0) {
    advancedConditions.value = [createEmptyCondition()]
  }
}

// 載入舊篩選條件
const loadOldFilters = () => {
  const savedConditions = loadAdvancedFilters()
  if (savedConditions && savedConditions.length > 0) {
    // 恢復 counter 到最大 id + 1
    const maxId = Math.max(...savedConditions.map(c => c.id || 0))
    conditionIdCounter = maxId + 1
    
    advancedConditions.value = savedConditions
    ElMessage.success(`已載入 ${savedConditions.length} 個篩選條件`)
  }
  showLoadOldFiltersAlert.value = false
}

// 忽略載入提醒
const dismissLoadAlert = () => {
  showLoadOldFiltersAlert.value = false
}

// 新增條件
const addCondition = () => {
  advancedConditions.value.push(createEmptyCondition())
}

// 移除條件
const removeCondition = (index) => {
  if (advancedConditions.value.length > 1) {
    advancedConditions.value.splice(index, 1)
  }
}

// 欄位變更處理
const onFieldChange = (condition) => {
  console.log('欄位變更:', condition.field)
}

// 套用進階篩選
const applyAdvancedFilter = () => {
  // 儲存篩選條件到 localStorage
  saveAdvancedFilters()
  
  const validConditions = advancedConditions.value.filter(condition => 
    condition.field && condition.patterns.trim()
  )
  
  // 發出事件給父組件
  emit('apply-filters', validConditions)
  
  // 關閉對話框
  dialogVisible.value = false
  
  ElMessage.success(`已套用 ${validConditions.length} 個篩選條件`)
}

// 取消進階篩選
const cancelAdvancedFilter = () => {
  dialogVisible.value = false
  showLoadOldFiltersAlert.value = false
}

// 清除所有篩選條件
const clearAdvancedFilters = () => {
  advancedConditions.value = [createEmptyCondition()]
  // 清除儲存的篩選條件
  localStorage.removeItem(props.storageKey)
  ElMessage.info('已清除所有篩選條件')
}

// 儲存篩選條件
const saveAdvancedFilters = () => {
  const validConditions = advancedConditions.value.filter(condition => 
    condition.field && condition.patterns.trim()
  )
  localStorage.setItem(props.storageKey, JSON.stringify(validConditions))
}

// 載入篩選條件
const loadAdvancedFilters = () => {
  const saved = localStorage.getItem(props.storageKey)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      console.warn('無法載入已儲存的篩選條件:', e)
      return null
    }
  }
  return null
}

// 對話框關閉事件
const onDialogClosed = () => {
  showLoadOldFiltersAlert.value = false
}

// 當對話框顯示時初始化
const initializeDialog = () => {
  if (props.visible) {
    showAdvancedFilter()
  }
}

// 監聽 visible 變化
computed(() => {
  if (props.visible) {
    initializeDialog()
  }
})

// 暴露給父組件的方法
defineExpose({
  showAdvancedFilter
})
</script>

<style scoped>
.advanced-filter-container {
  max-height: 400px;
  overflow-y: auto;
}

.filter-condition-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  gap: 15px;
}

.condition-left {
  flex: 0 0 250px;
}

.condition-left h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.and-label {
  color: #409eff;
  font-size: 12px;
  margin-left: 5px;
}

.field-selector label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  color: #606266;
}

.condition-right {
  flex: 1;
}

.regex-input label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  color: #606266;
}

.pattern-help {
  margin-top: 5px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.pattern-help small {
  color: #909399;
  line-height: 1.4;
}

.condition-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  padding-top: 25px;
}

.add-condition {
  margin-top: 10px;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  margin: 0 -16px -16px -16px;
}
</style>