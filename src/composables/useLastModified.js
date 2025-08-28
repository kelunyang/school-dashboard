import { ref, computed } from 'vue'
import { apiService } from '../services/apiService'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useLastModified() {
  const lastModifiedData = ref(null)
  const loading = ref(false)
  
  // 功能名稱到中文顯示名稱的映射
  const functionDisplayNames = {
    'currentStudent': '當學期名單',
    'newbie': '新生統計',
    'graduate': '畢業生流向',
    'examScore': '學測成績',
    'stScore': '分科成績'
  }
  
  // 獲取指定功能的資料表最後修改時間
  const getLastModified = async (functionName) => {
    loading.value = true
    try {
      const result = await apiService.getSheetLastModified(functionName)
      
      if (result.success) {
        lastModifiedData.value = {
          ...result,
          displayName: functionDisplayNames[functionName] || functionName
        }
        return result
      } else {
        ElMessage.error('獲取資料表更新時間失敗：' + result.error)
        return null
      }
    } catch (error) {
      console.error('獲取資料表更新時間錯誤:', error)
      ElMessage.error('獲取資料表更新時間失敗')
      return null
    } finally {
      loading.value = false
    }
  }
  
  // 顯示資料表最後更新時間的 MessageBox
  const showLastModifiedDialog = async (functionName) => {
    const data = await getLastModified(functionName)
    
    if (data) {
      const formattedDate = new Date(data.lastModified).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      
      ElMessageBox.alert(
        `<div style="line-height: 1.6;">
          <p><strong>資料表：</strong>${data.sheetName}</p>
          <p><strong>最後更新時間：</strong><br/>${formattedDate}</p>
          <p><strong>更新者：</strong>${data.modifiedBy}</p>
        </div>`,
        '資料表更新資訊',
        {
          dangerouslyUseHTMLString: true,
          confirmButtonText: '確定',
          type: 'info'
        }
      )
    }
  }
  
  // 在資料載入完成時自動顯示更新時間通知
  const showDataLoadedNotification = async (functionName) => {
    const data = await getLastModified(functionName)
    
    if (data) {
      const formattedDate = new Date(data.lastModified).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      
      ElMessage({
        message: `${data.sheetName} 資料已載入完成\n最後更新：${formattedDate}`,
        type: 'success',
        duration: 4000,
        showClose: true,
        dangerouslyUseHTMLString: false
      })
    }
  }
  
  // 格式化的最後更新時間
  const formattedLastModified = computed(() => {
    if (!lastModifiedData.value) return ''
    
    return new Date(lastModifiedData.value.lastModified).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  })
  
  return {
    lastModifiedData,
    loading,
    getLastModified,
    showLastModifiedDialog,
    showDataLoadedNotification,
    formattedLastModified
  }
}