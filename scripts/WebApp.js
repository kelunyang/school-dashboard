// Google Apps Script Web App 入口
// 包含 doGet 函數和必要的輔助函數

// 包含其他 HTML 檔案的輔助函數
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// GAS Webapp 模式入口
function doGet() {
  try {
    // 取得 Google Client ID
    const properties = PropertiesService.getScriptProperties();
    const googleClientId = properties.getProperty('GOOGLE_CLIENT_ID') || '';
    
    // 創建前端 HTML 模板
    const template = HtmlService.createTemplateFromFile('Index');
    template.googleClientId = googleClientId;
    
    const html = template.evaluate()
      .setTitle('學校儀表板系統')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    
    return html;
  } catch (error) {
    console.error('doGet error:', error);
    // 如果找不到 Index.html，返回錯誤頁面
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>載入錯誤</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>載入錯誤</h1>
          <p>無法載入應用程式。</p>
          <p>錯誤訊息：${error.toString()}</p>
          <p>請確認 Index.html 檔案存在於專案中。</p>
        </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(errorHtml)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// 測試函數
function test() {
  console.log('WebApp 測試成功');
  return 'WebApp 測試成功';
}