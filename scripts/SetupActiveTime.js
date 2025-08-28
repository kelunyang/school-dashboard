/**
 * 設置 activeTime 參數到 PropertiesService
 * 這個腳本需要在 Google Apps Script 編輯器中手動執行一次
 */

function setupActiveTime() {
  try {
    const properties = PropertiesService.getScriptProperties();
    
    // 設置 activeTime 為 30 分鐘（以分鐘為單位）
    // 可以根據需要調整這個值
    const activeTimeMinutes = 30;
    
    properties.setProperty('activeTime', activeTimeMinutes.toString());
    
    console.log(`已設置 activeTime 為 ${activeTimeMinutes} 分鐘`);
    
    // 驗證設置
    const savedValue = properties.getProperty('activeTime');
    console.log(`驗證：從 PropertiesService 讀取的 activeTime 值為: ${savedValue}`);
    
    return {
      success: true,
      message: `activeTime 已設置為 ${activeTimeMinutes} 分鐘`
    };
    
  } catch (error) {
    console.error('設置 activeTime 失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 獲取當前的 activeTime 設置
 */
function getActiveTime() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const activeTime = properties.getProperty('activeTime');
    
    console.log('當前 activeTime 設置:', activeTime);
    
    return {
      success: true,
      activeTime: activeTime ? parseInt(activeTime) : null
    };
    
  } catch (error) {
    console.error('獲取 activeTime 失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 列出所有 Properties
 */
function listAllProperties() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    
    console.log('所有 PropertiesService 參數:');
    for (const [key, value] of Object.entries(allProperties)) {
      console.log(`${key}: ${value}`);
    }
    
    return {
      success: true,
      properties: allProperties
    };
    
  } catch (error) {
    console.error('列出 Properties 失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}