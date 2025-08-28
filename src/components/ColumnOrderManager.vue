<template>
  <el-dialog
    v-model="visible"
    title="管理表格欄位順序"
    width="500px"
    @close="handleClose"
  >
    <div class="column-order-manager">
      <div class="column-list">
        <div
          v-for="(column, index) in localColumns"
          :key="column.prop"
          class="column-item"
          :class="{ 'is-selected': selectedIndex === index }"
          @click="selectedIndex = index"
        >
          <span class="column-label">{{ column.label }}</span>
          <div class="column-actions">
            <el-button
              :disabled="index === 0"
              size="small"
              circle
              @click.stop="moveUp(index)"
            >
              <el-icon><ArrowUp /></el-icon>
            </el-button>
            <el-button
              :disabled="index === localColumns.length - 1"
              size="small"
              circle
              @click.stop="moveDown(index)"
            >
              <el-icon><ArrowDown /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      
      <div class="tips">
        <p>提示：點擊選中列，使用箭頭按鈕調整順序</p>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm">確定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: Boolean,
  columns: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'update:order'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const localColumns = ref([])
const selectedIndex = ref(-1)

// 向上移動
const moveUp = (index) => {
  if (index > 0) {
    const temp = localColumns.value[index]
    localColumns.value[index] = localColumns.value[index - 1]
    localColumns.value[index - 1] = temp
    selectedIndex.value = index - 1
  }
}

// 向下移動
const moveDown = (index) => {
  if (index < localColumns.value.length - 1) {
    const temp = localColumns.value[index]
    localColumns.value[index] = localColumns.value[index + 1]
    localColumns.value[index + 1] = temp
    selectedIndex.value = index + 1
  }
}

const handleClose = () => {
  selectedIndex.value = -1
  visible.value = false
}

const handleConfirm = () => {
  const newOrder = localColumns.value.map(col => col.prop)
  emit('update:order', newOrder)
  visible.value = false
}

// 當對話框打開時，初始化本地列副本
watch(visible, (val) => {
  if (val) {
    localColumns.value = [...props.columns]
    selectedIndex.value = -1
  }
})
</script>

<style scoped>
.column-order-manager {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.column-list {
  flex: 1;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow-y: auto;
  padding: 10px;
}

.column-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 5px;
  background: #f5f7fa;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.column-item:hover {
  background: #e6e8eb;
}

.column-item.is-selected {
  background: #ecf5ff;
  border: 1px solid #409eff;
}

.column-label {
  font-size: 14px;
}

.column-actions {
  display: flex;
  gap: 5px;
}

.tips {
  margin-top: 10px;
  padding: 10px;
  background: #f4f4f5;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
}
</style>