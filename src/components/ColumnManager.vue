<template>
  <el-dialog
    v-model="visible"
    title="管理表格欄位"
    width="600px"
    @close="handleClose"
  >
    <div class="column-manager">
      <div class="column-list">
        <div class="list-header">
          <span>可用欄位（拖曳排序）</span>
          <el-button size="small" @click="resetOrder">重置順序</el-button>
        </div>
        
        <div ref="sortableList" class="sortable-list">
          <div
            v-for="column in sortedColumns"
            :key="column.prop"
            class="column-item"
            :class="{ 'is-selected': isSelected(column.prop), 'is-required': column.required }"
          >
            <el-checkbox
              :model-value="isSelected(column.prop)"
              :disabled="column.required"
              @change="toggleColumn(column.prop)"
            >
              {{ column.label }}
            </el-checkbox>
            <span v-if="column.required" class="required-tag">必要</span>
          </div>
        </div>
      </div>
      
      <div class="preview">
        <div class="list-header">預覽順序</div>
        <div class="preview-list">
          <div
            v-for="column in previewColumns"
            :key="column.prop"
            class="preview-item"
          >
            {{ column.label }}
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm">確定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import Sortable from 'sortablejs'

const props = defineProps({
  modelValue: Boolean,
  columns: {
    type: Array,
    required: true
  },
  selectedColumns: {
    type: Array,
    required: true
  },
  columnOrder: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'update:selectedColumns', 'update:columnOrder'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const sortableList = ref(null)
const sortableInstance = ref(null)
const localOrder = ref([...props.columnOrder])
const localSelected = ref([...props.selectedColumns])

// 根據順序排序的列
const sortedColumns = computed(() => {
  if (!localOrder.value.length) return props.columns
  
  const columnMap = new Map(props.columns.map(col => [col.prop, col]))
  const sorted = []
  
  // 先添加有序的列
  localOrder.value.forEach(prop => {
    const col = columnMap.get(prop)
    if (col) {
      sorted.push(col)
      columnMap.delete(prop)
    }
  })
  
  // 添加新列
  columnMap.forEach(col => {
    sorted.push(col)
  })
  
  return sorted
})

// 預覽列
const previewColumns = computed(() => {
  return sortedColumns.value.filter(col => 
    localSelected.value.includes(col.prop)
  )
})

const isSelected = (prop) => {
  return localSelected.value.includes(prop)
}

const toggleColumn = (prop) => {
  const index = localSelected.value.indexOf(prop)
  if (index > -1) {
    localSelected.value.splice(index, 1)
  } else {
    localSelected.value.push(prop)
  }
}

const resetOrder = () => {
  localOrder.value = props.columns.map(col => col.prop)
  initSortable()
}

const handleClose = () => {
  // 重置本地狀態
  localOrder.value = [...props.columnOrder]
  localSelected.value = [...props.selectedColumns]
  visible.value = false
}

const handleConfirm = () => {
  emit('update:selectedColumns', [...localSelected.value])
  emit('update:columnOrder', [...localOrder.value])
  visible.value = false
}

const initSortable = async () => {
  await nextTick()
  
  if (!sortableList.value) return
  
  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }
  
  sortableInstance.value = Sortable.create(sortableList.value, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd: (evt) => {
      const oldIndex = evt.oldIndex
      const newIndex = evt.newIndex
      
      if (oldIndex === newIndex) return
      
      // 更新順序
      const newOrder = [...sortedColumns.value.map(col => col.prop)]
      const [movedItem] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, movedItem)
      
      localOrder.value = newOrder
    }
  })
}

watch(visible, (val) => {
  if (val) {
    localOrder.value = [...props.columnOrder]
    localSelected.value = [...props.selectedColumns]
    nextTick(() => {
      initSortable()
    })
  }
})

onMounted(() => {
  if (visible.value) {
    initSortable()
  }
})
</script>

<style scoped>
.column-manager {
  display: flex;
  gap: 20px;
  height: 400px;
}

.column-list,
.preview {
  flex: 1;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: bold;
}

.sortable-list,
.preview-list {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  height: calc(100% - 40px);
  overflow-y: auto;
  padding: 10px;
}

.column-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  background: #f5f7fa;
  border-radius: 4px;
  cursor: move;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s;
}

.column-item:hover {
  background: #e6e8eb;
}

.column-item.is-selected {
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
}

.column-item.is-required {
  cursor: default;
}

.required-tag {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.preview-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  background: #ecf5ff;
  border-radius: 4px;
  border: 1px solid #b3d8ff;
}

.sortable-ghost {
  opacity: 0.5;
}

.sortable-chosen {
  background: #409eff !important;
  color: white;
}

.sortable-drag {
  background: #409eff !important;
  color: white;
  opacity: 1 !important;
}
</style>