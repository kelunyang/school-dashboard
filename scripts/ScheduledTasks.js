// 定時任務管理
// 用於設定和管理 Firestore 同步的定時觸發器

/**
 * 設定每日 Firestore 同步觸發器
 * 推薦在凌晨執行，避免影響白天使用
 */
function setupDailyFirestoreSync() {
  console.log('=== 設定每日 Firestore 同步觸發器 ===');
  
  try {
    // 刪除現有的同步觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'performInitialSync' || 
          trigger.getHandlerFunction() === 'scheduledFirestoreSync') {
        ScriptApp.deleteTrigger(trigger);
        console.log(`已刪除舊觸發器: ${trigger.getHandlerFunction()}`);
      }
    });
    
    // 設定新的觸發器（每日凌晨 2:00 執行）
    ScriptApp.newTrigger('scheduledFirestoreSync')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .create();
      
    console.log('✅ 每日 Firestore 同步觸發器已設定（每天凌晨 2:00 執行）');
    
    return {
      success: true,
      message: '每日 Firestore 同步觸發器已設定',
      schedule: '每天凌晨 2:00'
    };
    
  } catch (error) {
    console.error('❌ 設定觸發器失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 設定每週 Firestore 同步觸發器
 * 適合資料更新頻率較低的情況
 */
function setupWeeklyFirestoreSync() {
  console.log('=== 設定每週 Firestore 同步觸發器 ===');
  
  try {
    // 刪除現有的同步觸發器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'performInitialSync' || 
          trigger.getHandlerFunction() === 'scheduledFirestoreSync') {
        ScriptApp.deleteTrigger(trigger);
        console.log(`已刪除舊觸發器: ${trigger.getHandlerFunction()}`);
      }
    });
    
    // 設定新的觸發器（每週日凌晨 1:00 執行）
    ScriptApp.newTrigger('scheduledFirestoreSync')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(1)
      .create();
      
    console.log('✅ 每週 Firestore 同步觸發器已設定（每週日凌晨 1:00 執行）');
    
    return {
      success: true,
      message: '每週 Firestore 同步觸發器已設定',
      schedule: '每週日凌晨 1:00'
    };
    
  } catch (error) {
    console.error('❌ 設定觸發器失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 定時執行的 Firestore 同步函數
 * 這是觸發器實際調用的函數
 */
function scheduledFirestoreSync() {
  console.log('=== 定時 Firestore 同步開始 ===');
  console.log('執行時間:', new Date().toISOString());
  
  try {
    // 記錄開始時間
    const startTime = Date.now();
    
    // 執行同步
    const results = performInitialSync();
    
    // 計算執行時間
    const duration = (Date.now() - startTime) / 1000;
    
    // 記錄結果
    console.log('=== 定時同步完成 ===');
    console.log('成功:', results.success.length, '項');
    console.log('失敗:', results.failed.length, '項');
    console.log('執行時間:', Math.round(duration), '秒');
    
    // 如果有失敗項目，記錄詳細資訊
    if (results.failed.length > 0) {
      console.warn('失敗項目:', results.failed);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ 定時同步失敗:', error);
    
    // 可以在這裡添加錯誤通知機制
    // 例如發送 email 或寫入錯誤日誌
    
    return {
      success: [],
      failed: ['定時同步執行失敗: ' + error.toString()]
    };
  }
}

/**
 * 移除所有 Firestore 同步觸發器
 */
function removeFirestoreSyncTriggers() {
  console.log('=== 移除 Firestore 同步觸發器 ===');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'performInitialSync' || 
          trigger.getHandlerFunction() === 'scheduledFirestoreSync') {
        ScriptApp.deleteTrigger(trigger);
        console.log(`已移除觸發器: ${trigger.getHandlerFunction()}`);
        removedCount++;
      }
    });
    
    console.log(`✅ 已移除 ${removedCount} 個 Firestore 同步觸發器`);
    
    return {
      success: true,
      removedCount: removedCount
    };
    
  } catch (error) {
    console.error('❌ 移除觸發器失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 檢查現有的觸發器狀態
 */
function checkFirestoreSyncTriggers() {
  console.log('=== 檢查 Firestore 同步觸發器狀態 ===');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const firestoreTriggers = [];
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'performInitialSync' || 
          trigger.getHandlerFunction() === 'scheduledFirestoreSync') {
        
        const triggerInfo = {
          handlerFunction: trigger.getHandlerFunction(),
          triggerSource: trigger.getTriggerSource().toString(),
          triggerType: trigger.getTriggerType().toString(),
          uniqueId: trigger.getUniqueId()
        };
        
        // 嘗試獲取時間觸發器的詳細資訊
        try {
          if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
            // 這些方法可能在某些情況下會拋出異常
            // 所以包在 try-catch 中
          }
        } catch (e) {
          // 忽略獲取詳細資訊的錯誤
        }
        
        firestoreTriggers.push(triggerInfo);
      }
    });
    
    console.log(`找到 ${firestoreTriggers.length} 個 Firestore 同步觸發器`);
    
    if (firestoreTriggers.length > 0) {
      firestoreTriggers.forEach((trigger, index) => {
        console.log(`觸發器 ${index + 1}:`, trigger);
      });
    } else {
      console.log('目前沒有設定 Firestore 同步觸發器');
    }
    
    return {
      success: true,
      triggers: firestoreTriggers,
      count: firestoreTriggers.length
    };
    
  } catch (error) {
    console.error('❌ 檢查觸發器失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 手動執行同步並測試
 * 用於測試同步功能是否正常
 */
function testScheduledSync() {
  console.log('=== 測試定時同步功能 ===');
  
  try {
    // 模擬定時觸發器執行
    const results = scheduledFirestoreSync();
    
    console.log('測試結果:');
    console.log('- 成功項目:', results.success);
    console.log('- 失敗項目:', results.failed);
    
    if (results.success.length > 0 && results.failed.length === 0) {
      console.log('✅ 同步功能測試通過');
    } else if (results.success.length > 0 && results.failed.length > 0) {
      console.log('⚠️ 同步功能部分成功');
    } else {
      console.log('❌ 同步功能測試失敗');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    return {
      success: [],
      failed: ['測試執行失敗: ' + error.toString()]
    };
  }
}