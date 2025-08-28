const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🚀 準備 GAS 部署包...');

// 1. 確保 gas-deploy 目錄存在並清理舊檔案
const gasDeployPath = path.join(__dirname, '../gas-deploy');
if (!fs.existsSync(gasDeployPath)) {
  fs.mkdirSync(gasDeployPath);
} else {
  // 清理舊的 .gs 檔案，但保留配置檔案
  const filesToKeep = ['.clasp.json', '.clasp.bak', '.clasp.json.template', 'appsscript.json', 'README.md'];
  const files = fs.readdirSync(gasDeployPath);
  files.forEach(file => {
    if (!filesToKeep.includes(file) && (file.endsWith('.gs') || file.endsWith('.html'))) {
      fs.unlinkSync(path.join(gasDeployPath, file));
      console.log(`🗑️  已刪除舊檔案: ${file}`);
    }
  });
}

async function buildForGAS() {
  try {
    // 1. 編譯前端代碼
    console.log('\n📦 開始編譯前端代碼...');
    try {
      // 設置 NODE_ENV 環境變數
      const env = {
        ...process.env,
        NODE_ENV: 'production'
      };
      await execAsync('npm run build:gas', { 
        cwd: path.join(__dirname, '..'),
        env: env
      });
      console.log('✅ 前端代碼編譯完成');
    } catch (buildError) {
      console.error('❌ 前端編譯失敗:', buildError);
      process.exit(1);
    }

    // 2. 讀取編譯後的文件
    const distPath = path.join(__dirname, '../dist');
    let htmlContent = '';
    let cssContent = '';
    let jsContent = '';
    
    if (fs.existsSync(distPath)) {
      // 讀取 index.html
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        htmlContent = fs.readFileSync(indexPath, 'utf8');
        console.log('✅ 已讀取 index.html');
      }
      
      // 讀取所有 CSS 文件
      const cssFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.css'));
      cssFiles.forEach(file => {
        cssContent += fs.readFileSync(path.join(distPath, file), 'utf8') + '\n';
      });
      if (cssFiles.length > 0) {
        console.log(`✅ 已讀取 ${cssFiles.length} 個 CSS 文件`);
      }
      
      // 讀取所有 JS 文件
      const jsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
      jsFiles.forEach(file => {
        let content = fs.readFileSync(path.join(distPath, file), 'utf8');
        
        // 修復 GAS 不支援的 八進制轉義序列問題  
        // 只轉換 \0 為 \x00，保留 \1, \2 等反向引用
        content = content.replace(/\\0(?![0-7])/g, '\\x00');
        
        jsContent += content + '\n';
      });
      if (jsFiles.length > 0) {
        console.log(`✅ 已讀取 ${jsFiles.length} 個 JS 文件，已處理轉義序列`);
      }
    }

    // 3. 檢查文件大小
    const totalSize = htmlContent.length + cssContent.length + jsContent.length;
    console.log(`📊 前端文件總大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (totalSize > 9 * 1024 * 1024) { // 9MB 限制（留點餘地）
      console.warn('⚠️  前端文件過大，可能超過 GAS 限制');
    }

    // 4. 複製必要的 GS 文件
    const gsFiles = [
      { source: 'WebApp.js', target: 'WebApp.gs' }, // Web App 入口 (包含 doGet)
      { source: 'Code.js', target: 'Code.gs' }, // 主要 API 執行入口 (包含 executeAPI)
      { source: 'GoogleSheetsOperations.js', target: 'GoogleSheetsOperations.gs' }, // Google Sheets 操作層
      { source: 'BackendAdapter.js', target: 'BackendAdapter.gs' }, // 後端適配器
      { source: 'DatabaseOperations.js', target: 'DatabaseOperations.gs' }, // 資料庫操作
      // { source: 'SupabaseManagement.js', target: 'SupabaseManagement.gs' }, // 已不使用
      { source: 'testGasAPIs.js', target: 'TestAPIs.gs' }, // 測試函數
    ];
    
    gsFiles.forEach(({ source, target }) => {
      const sourcePath = path.join(__dirname, source);
      const targetPath = path.join(gasDeployPath, target);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ 已複製 ${source} -> ${target}`);
      } else {
        console.log(`⚠️  找不到 ${source}，跳過`);
      }
    });

    // 5.1 創建 Index.html（從編譯後的前端）
    console.log('\n📝 創建 Index.html...');
    
    // 讀取編譯後的 index.html
    let indexHtmlContent = '';
    const distIndexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distIndexPath)) {
      indexHtmlContent = fs.readFileSync(distIndexPath, 'utf8');
      
      // 處理資源路徑，將相對路徑轉換為內嵌
      // 移除 <script type="module" crossorigin src="/app.js"></script>
      indexHtmlContent = indexHtmlContent.replace(/<script[^>]*src="\/app\.js"[^>]*><\/script>/g, '');
      
      // 移除 <link rel="stylesheet" crossorigin href="/style.css">
      indexHtmlContent = indexHtmlContent.replace(/<link[^>]*href="\/style\.css"[^>]*>/g, '');
      
      // 在 </head> 前插入 CSS (使用安全轉義)
      const escapedCssContent = cssContent.replace(/\$/g, '\\$');
      indexHtmlContent = indexHtmlContent.replace('</head>', 
        `<style>
${escapedCssContent}
</style>
</head>`);
      
      // 處理 JavaScript 文件 - 使用 Base64 編碼避免字符串轉義問題
      console.log('📦 將 JavaScript 使用 Base64 編碼並拆分為多個 GAS 函數');
      
      // 將 JavaScript 內容進行 Base64 編碼
      const base64JsContent = Buffer.from(jsContent, 'utf8').toString('base64');
      
      // 將 Base64 內容分成多個片段（每個 30KB）
      const chunkSize = 30000;
      const chunks = [];
      for (let i = 0; i < base64JsContent.length; i += chunkSize) {
        chunks.push(base64JsContent.substring(i, i + chunkSize));
      }
      
      // 創建多個 GAS 函數來存儲 JavaScript 片段
      let jsResourceContent = `// JavaScript 資源文件 - 自動生成，請勿手動修改\n\n`;
      
      // 為每個片段創建一個函數
      chunks.forEach((chunk, index) => {
        jsResourceContent += `function getJsChunk${index}() {\n`;
        jsResourceContent += `  return '${chunk}';\n`;
        jsResourceContent += `}\n\n`;
      });
      
      // 創建主函數來組合所有片段並解碼
      jsResourceContent += `function getAppJavaScript() {\n`;
      jsResourceContent += `  try {\n`;
      jsResourceContent += `    const chunks = [];\n`;
      chunks.forEach((_, index) => {
        jsResourceContent += `    chunks.push(getJsChunk${index}());\n`;
      });
      jsResourceContent += `    const base64Content = chunks.join('');\n`;
      jsResourceContent += `    const decodedBytes = Utilities.base64Decode(base64Content);\n`;
      jsResourceContent += `    return Utilities.newBlob(decodedBytes).getDataAsString('UTF-8');\n`;
      jsResourceContent += `  } catch (error) {\n`;
      jsResourceContent += `    console.error('Failed to decode JavaScript:', error);\n`;
      jsResourceContent += `    throw error;\n`;
      jsResourceContent += `  }\n`;
      jsResourceContent += `}\n`;
      
      // 寫入 JavaScript 資源文件
      fs.writeFileSync(path.join(gasDeployPath, 'JsResource.gs'), jsResourceContent);
      console.log('✅ 已創建 JsResource.gs');
      
      // 回到 google.script.run 方法但優化錯誤處理
      const scriptContent = `
<script>
// Google Client ID 注入
window.GOOGLE_CLIENT_ID = '<?!= googleClientId ?>';

// 設定 APP_CONFIG 為 GAS_WEBAPP 模式
window.APP_CONFIG = {
  MODE: 'GAS_WEBAPP'
};

// Backend API 封裝
window.backend = {
  executeAPI: function(request) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .executeAPI(request);
    });
  }
};

// 載入應用程式
window.addEventListener('DOMContentLoaded', function() {
  // 顯示載入中訊息
  var loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:white;z-index:9999;';
  loadingDiv.innerHTML = '<div style="text-align:center;font-family:Arial,sans-serif;"><h2>載入中...</h2><p>正在載入應用程式，請稍候。</p></div>';
  document.body.appendChild(loadingDiv);
  
  // 從服務器獲取 JavaScript 代碼
  google.script.run
    .withSuccessHandler(function(jsCode) {
      try {
        // 移除載入訊息
        if (loadingDiv && loadingDiv.parentNode) {
          loadingDiv.parentNode.removeChild(loadingDiv);
        }
        
        // 使用 Function constructor 執行代碼
        var scriptFunction = new Function(jsCode);
        scriptFunction();
        
        console.log('應用程式已成功載入');
      } catch (error) {
        console.error('載入應用程式失敗:', error);
        document.body.innerHTML = '<div style="padding:20px;color:red;font-family:Arial,sans-serif;"><h2>載入失敗</h2><p>執行應用程式時發生錯誤：' + error.message + '</p><pre>' + error.stack + '</pre></div>';
      }
    })
    .withFailureHandler(function(error) {
      console.error('獲取應用程式代碼失敗:', error);
      if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
      }
      document.body.innerHTML = '<div style="padding:20px;color:red;font-family:Arial,sans-serif;"><h2>載入失敗</h2><p>無法從服務器獲取應用程式代碼：' + error.toString() + '</p></div>';
    })
    .getAppJavaScript();
});
</script>`;
      
      // 在 </body> 之前插入加載腳本
      indexHtmlContent = indexHtmlContent.replace('</body>', 
        `${scriptContent}\n</body>`);
      
      
      // 添加 base target
      if (!indexHtmlContent.includes('<base')) {
        indexHtmlContent = indexHtmlContent.replace('<head>', '<head>\n  <base target="_top">');
      }
      
      // 寫入 Index.html
      fs.writeFileSync(path.join(gasDeployPath, 'Index.html'), indexHtmlContent);
      console.log('✅ 已創建 Index.html（整合編譯後的前端）');
    } else {
      console.error('❌ 找不到編譯後的 dist/index.html');
    }

    // 6. 複製或創建 appsscript.json
    const appsscriptSourcePath = path.join(__dirname, 'appsscript.json');
    const appsscriptTargetPath = path.join(gasDeployPath, 'appsscript.json');
    
    if (fs.existsSync(appsscriptSourcePath)) {
      fs.copyFileSync(appsscriptSourcePath, appsscriptTargetPath);
      console.log('✅ 已複製 appsscript.json');
    } else {
      // 創建預設的 appsscript.json
      const defaultAppsscript = {
        "timeZone": "Asia/Taipei",
        "dependencies": {},
        "exceptionLogging": "STACKDRIVER",
        "runtimeVersion": "V8",
        "executionApi": {
          "access": "ANYONE"
        },
        "oauthScopes": [
          "https://www.googleapis.com/auth/script.external_request",
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/userinfo.email"
        ]
      };
      
      fs.writeFileSync(appsscriptTargetPath, JSON.stringify(defaultAppsscript, null, 2));
      console.log('✅ 已創建預設 appsscript.json');
    }

    // 7. 檢查 .clasp.json
    const claspTargetPath = path.join(gasDeployPath, '.clasp.json');
    
    if (fs.existsSync(claspTargetPath)) {
      console.log('✅ .clasp.json 已存在');
    } else {
      console.log('⚠️  找不到 .clasp.json，請手動設定或使用 clasp create');
    }

    // 8. 輸出部署包文件列表
    const files = fs.readdirSync(gasDeployPath);
    
    console.log('\n🚀 GAS 部署包準備完成');
    console.log('包含以下文件:');
    
    files.forEach(file => {
      const filePath = path.join(gasDeployPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        console.log(`└─ 📁 ${file}/`);
      } else {
        console.log(`└─ 📄 ${file}`);
      }
    });
    
    console.log('\n🔥 部署架構說明：');
    console.log('此版本使用純 Google Sheets 架構，包含必要的檔案：');
    console.log('包含的文件：');
    console.log('- Index.html: 整合了 Vue 前端應用（含 CSS/JS）');
    console.log('- WebApp.gs: Web App 入口（包含 doGet 函數）');
    console.log('- Code.gs: API 執行入口（包含 executeAPI 函數）');
    console.log('- DatabaseOperations.gs: Google Sheets 資料庫操作層');
    console.log('- BackendAdapter.gs: 後端適配器（已停用權限檢查）');
    console.log('- TestAPIs.gs: API 測試函數');
    console.log('');
    console.log('📋 部署步驟：');
    console.log('1. cd gas-deploy');
    console.log('2. clasp push');
    console.log('3. 在 GAS 編輯器中設定 Google Sheets 配置：');
    console.log('   - 確認專案有權限存取相關的 Google Sheets');
    console.log('   - 設定必要的 SpreadsheetID（如有需要）');
    console.log('4. 部署為 Web 應用程式 (Webapp)');
    console.log('   - 執行身分：我');
    console.log('   - 具有應用程式存取權的使用者：同網域 (app.lksh.ntpc.edu.tw)');

  } catch (error) {
    console.error('❌ 處理 GAS 部署包失敗:', error);
    process.exit(1);
  }
}

// 執行主函數
buildForGAS();