// 簡化的 Backend - 用於調試 NOT_FOUND 錯誤

// 主要 doGet 處理函數 - 簡化版本
function doGet() {
  try {
    console.log('doGet called');
    
    // 創建基本的 HTML 頁面，不依賴任何外部函數
    const simpleHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>學校儀表板系統 - 測試版</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 2rem; 
            text-align: center; 
        }
        .container { 
            background: #f0f0f0; 
            padding: 2rem; 
            border-radius: 8px; 
            max-width: 600px; 
            margin: 0 auto; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 學校儀表板系統</h1>
        <p>系統正在初始化中...</p>
        <p>如果看到這個頁面，表示基本的 doGet 函數正常工作。</p>
        <button onclick="testAPI()">測試 API 連接</button>
        <div id="result"></div>
    </div>
    
    <script>
        console.log('頁面載入完成');
        
        function testAPI() {
            console.log('測試 API...');
            document.getElementById('result').innerHTML = '<p>測試中...</p>';
            
            try {
                // 測試簡單的 GAS API 調用
                google.script.run
                    .withSuccessHandler(function(result) {
                        console.log('API 測試成功:', result);
                        document.getElementById('result').innerHTML = '<p style="color: green;">✅ API 連接成功: ' + result + '</p>';
                    })
                    .withFailureHandler(function(error) {
                        console.error('API 測試失敗:', error);
                        document.getElementById('result').innerHTML = '<p style="color: red;">❌ API 連接失敗: ' + error + '</p>';
                    })
                    .testFunction();
            } catch (error) {
                console.error('調用失敗:', error);
                document.getElementById('result').innerHTML = '<p style="color: red;">❌ 調用失敗: ' + error + '</p>';
            }
        }
        
        // 自動測試
        setTimeout(testAPI, 1000);
    </script>
</body>
</html>`;
    
    console.log('HTML created, returning HtmlOutput');
    
    return HtmlService.createHtmlOutput(simpleHtml)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
  } catch (error) {
    console.error('doGet 錯誤:', error);
    
    // 返回錯誤頁面
    const errorHtml = `<!DOCTYPE html>
<html>
<head>
    <title>錯誤</title>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial; text-align: center; padding: 2rem;">
    <div style="background: #f8d7da; color: #721c24; padding: 2rem; border-radius: 8px;">
        <h1>❌ 發生錯誤</h1>
        <p>${error.toString()}</p>
        <p>請檢查 GAS 編輯器的執行記錄</p>
    </div>
</body>
</html>`;
    
    return HtmlService.createHtmlOutput(errorHtml);
  }
}

// 簡單的測試函數
function testFunction() {
  try {
    console.log('testFunction called');
    
    // 測試 PropertiesService
    const properties = PropertiesService.getScriptProperties();
    const firebaseID = properties.getProperty('firebaseID');
    
    return `測試成功 - Firebase ID: ${firebaseID || '未設定'}`;
    
  } catch (error) {
    console.error('testFunction 錯誤:', error);
    return `測試失敗: ${error.toString()}`;
  }
}

// 測試 Firestore 連接
function testFirestoreConnection() {
  try {
    console.log('測試 Firestore 連接');
    
    const properties = PropertiesService.getScriptProperties();
    const apiKey = properties.getProperty('firestoreKey');
    const projectId = properties.getProperty('firebaseID') || 'schooldashboard-467219';
    
    if (!apiKey || !projectId) {
      return {
        success: false,
        error: 'Firestore 配置不完整'
      };
    }
    
    // 嘗試初始化 FirestoreApp
    const firestore = FirestoreApp.getFirestore(projectId, apiKey);
    
    // 嘗試執行簡單查詢
    const students = firestore.getDocuments('students', 1); // 只取 1 筆測試
    
    return {
      success: true,
      message: '連接成功',
      studentCount: students.length
    };
    
  } catch (error) {
    console.error('Firestore 連接錯誤:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 檢查所有依賴
function checkDependencies() {
  const results = {};
  
  try {
    // 檢查 PropertiesService
    const properties = PropertiesService.getScriptProperties();
    results.properties = '✅ 可用';
  } catch (error) {
    results.properties = '❌ ' + error.toString();
  }
  
  try {
    // 檢查 HtmlService
    const testHtml = HtmlService.createHtmlOutput('<p>test</p>');
    results.htmlService = '✅ 可用';
  } catch (error) {
    results.htmlService = '❌ ' + error.toString();
  }
  
  try {
    // 檢查 Session
    const user = Session.getActiveUser();
    results.session = '✅ 可用 - ' + (user ? user.getEmail() : '無用戶');
  } catch (error) {
    results.session = '❌ ' + error.toString();
  }
  
  try {
    // 檢查 FirestoreApp
    if (typeof FirestoreApp !== 'undefined') {
      results.firestoreApp = '✅ 庫已載入';
    } else {
      results.firestoreApp = '❌ 庫未載入';
    }
  } catch (error) {
    results.firestoreApp = '❌ ' + error.toString();
  }
  
  return results;
}