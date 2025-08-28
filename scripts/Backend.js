// 學校儀表板 Backend - Google Sheets API 版本
// 使用 Google Sheets API 進行所有數據操作

// 引入 GoogleSheetsOperations
// 使用 GoogleSheetsOperations.js 中建立的全域實例
// dbOps 已在 GoogleSheetsOperations.js 中建立為全域變數

// ========== 主要 API 處理函數 ==========

/**
 * 處理 API 請求
 * @param {string} action - API 動作名稱
 * @param {Object} params - API 參數
 * @returns {Object} API 響應
 */
function handleAPIRequest(action, params = {}) {
  try {
    // 使用 GoogleSheetsOperations 的 log 方法
    if (dbOps && dbOps.log) {
      dbOps.log(`處理 API 請求: ${action}`);
    }
    
    // 根據 action 路由到對應的處理函數
    switch (action) {
      // 系統設定
      case 'getSystemConfig':
        return getSystemConfig();
      
      // 學生資料相關
      case 'getStudentListYears':
        return getStudentListYears();
      case 'getStudentList':
        return getStudentList(params.year);
      case 'generateFilteredReport':
        return generateFilteredReport(params.filters);
      case 'getJuniorHighSchoolGeoInfo':
        return getJuniorHighSchoolGeoInfo();
      case 'getAllStudentData':
        return getAllStudentData();
      case 'getAllStudentCoordinates':
        return getAllStudentCoordinates();
      
      // 畢業生資料相關
      case 'getGraduateListYears':
        return getGraduateListYears();
      case 'getGraduateList':
        return getGraduateList(params.year);
      case 'generateGraduateReport':
        return generateGraduateReport(params.filters);
      
      // 學測成績相關
      case 'getExamScoreYears':
        return getExamScoreYears();
      case 'getExamScores':
        return getExamScores(params.year);
      case 'getAllExamScores':
        return getAllExamScores();
      case 'generateExamScoreReport':
        return generateExamScoreReport(params.filters);
      
      // 分科成績相關
      case 'getSTScoreYears':
        return getSTScoreYears();
      case 'getSTScores':
        return getSTScores(params.year);
      case 'getAllSTScores':
        return getAllSTScores();
      case 'generateSTScoreReport':
        return generateSTScoreReport(params.filters);
      
      // 跨功能查詢
      case 'getCrossFunctionalData':
        return getCrossFunctionalData(params.selectedStudentData);
      case 'getIdNumberMapping':
        return getIdNumberMapping();
      case 'searchIdMapping':
        return searchIdMapping(params.query);
      
      // 使用者權限
      case 'getUserTabPermissions':
        return getUserTabPermissions(params.userEmail);
      
      default:
        return {
          success: false,
          error: `未知的 API 動作: ${action}`
        };
    }
  } catch (error) {
    console.error(`API 處理錯誤 [${action}]:`, error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 系統設定 ==========

function getSystemConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();
    return {
      success: true,
      config: {
        manualDebug: properties.getProperty('manualDebug') === 'true'
      }
    };
  } catch (error) {
    console.error('獲取系統設定失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 學生資料相關 ==========

function getStudentListYears() {
  try {
    const years = dbOps.getStudentListYears();
    return {
      success: true,
      years: years
    };
  } catch (error) {
    console.error('獲取學生年份失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getStudentList(year = 'all') {
  try {
    const students = dbOps.getStudentList(year === 'all' ? null : parseInt(year));
    const filterOptions = dbOps.getStudentFilters(students);
    
    return {
      success: true,
      data: students,
      filters: filterOptions
    };
  } catch (error) {
    console.error('獲取學生列表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function generateFilteredReport(filters) {
  try {
    // 這個功能應該在前端處理 CSV 生成
    // 後端只需要返回過濾後的數據
    const students = dbOps.getStudentList(filters.year);
    
    return {
      success: true,
      data: students,
      message: '請在前端生成 CSV 檔案'
    };
  } catch (error) {
    console.error('生成報表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getJuniorHighSchoolGeoInfo() {
  try {
    const geoInfo = dbOps.getJuniorHighSchoolGeoInfo();
    return {
      success: true,
      data: geoInfo
    };
  } catch (error) {
    console.error('獲取國中地理資訊失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getAllStudentData() {
  try {
    const students = dbOps.getAllStudentData();
    return {
      success: true,
      data: students
    };
  } catch (error) {
    console.error('獲取完整學生資料失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getAllStudentCoordinates() {
  try {
    const coordinates = dbOps.getAllStudentCoordinates();
    return {
      success: true,
      data: coordinates
    };
  } catch (error) {
    console.error('獲取完整住址座標失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 畢業生資料相關 ==========

function getGraduateListYears() {
  try {
    const years = dbOps.getGraduateListYears();
    return {
      success: true,
      years: years
    };
  } catch (error) {
    console.error('獲取畢業生年份失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getGraduateList(year = 'all') {
  try {
    const result = dbOps.getGraduateList(year === 'all' ? null : parseInt(year));
    
    if (result.success) {
      return {
        success: true,
        data: result.graduates,
        filters: result.filters
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error('獲取畢業生列表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function generateGraduateReport(filters) {
  try {
    // 這個功能應該在前端處理 CSV 生成
    const result = dbOps.getGraduateList(filters.year);
    const graduates = result.success ? result.graduates : [];
    
    return {
      success: true,
      data: graduates,
      message: '請在前端生成 CSV 檔案'
    };
  } catch (error) {
    console.error('生成畢業生報表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 學測成績相關 ==========

function getExamScoreYears() {
  try {
    const years = dbOps.getExamScoreYears();
    return {
      success: true,
      years: years
    };
  } catch (error) {
    console.error('獲取學測成績年份失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getExamScores(year = 'all') {
  try {
    const scores = dbOps.getExamScores(year === 'all' ? null : parseInt(year));
    
    // 獲取學測五標資料並處理
    const gsatBenchmarksRaw = dbOps.getGsatBenchmarks();
    const benchmarks = {};
    
    // 處理五標資料，按年份和科目組織
    gsatBenchmarksRaw.forEach(benchmark => {
      const year = benchmark['年分'];
      const subject = benchmark['科目'];
      const standard = benchmark['五標'];
      const score = benchmark['分數'];
      
      if (!year || !subject || !standard || score === undefined) return;
      
      if (!benchmarks[year]) {
        benchmarks[year] = {};
      }
      
      // 使用regex匹配科目名稱，移除"級分"後綴得到純科目名稱
      const subjectName = subject.replace(/級分$/, '');
      
      if (!benchmarks[year][subjectName]) {
        benchmarks[year][subjectName] = {};
      }
      
      // 將五標轉換為標準格式
      const standardMap = {
        '頂標': 'top',
        '前標': 'front',
        '均標': 'average',
        '後標': 'back',
        '底標': 'bottom'
      };
      
      const standardKey = standardMap[standard];
      if (standardKey) {
        benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
      }
    });
    
    return {
      success: true,
      students: scores,
      benchmarks: benchmarks
    };
  } catch (error) {
    console.error('獲取學測成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getAllExamScores() {
  try {
    const scores = dbOps.getExamScores(); // 不傳年份，取得所有資料
    
    // 獲取學測五標資料並處理
    const gsatBenchmarksRaw = dbOps.getGsatBenchmarks();
    const benchmarks = {};
    
    // 處理五標資料，按年份和科目組織
    gsatBenchmarksRaw.forEach(benchmark => {
      const year = benchmark['年分'];
      const subject = benchmark['科目'];
      const standard = benchmark['五標'];
      const score = benchmark['分數'];
      
      if (!year || !subject || !standard || score === undefined) return;
      
      if (!benchmarks[year]) {
        benchmarks[year] = {};
      }
      
      // 使用regex匹配科目名稱，移除"級分"後綴得到純科目名稱
      const subjectName = subject.replace(/級分$/, '');
      
      if (!benchmarks[year][subjectName]) {
        benchmarks[year][subjectName] = {};
      }
      
      // 將五標轉換為標準格式
      const standardMap = {
        '頂標': 'top',
        '前標': 'front',
        '均標': 'average',
        '後標': 'back',
        '底標': 'bottom'
      };
      
      const standardKey = standardMap[standard];
      if (standardKey) {
        benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
      }
    });
    
    return {
      success: true,
      data: scores,
      benchmarks: benchmarks
    };
  } catch (error) {
    console.error('獲取完整學測成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function generateExamScoreReport(filters) {
  try {
    // 這個功能應該在前端處理 CSV 生成
    const scores = dbOps.getExamScores(filters.year);
    
    return {
      success: true,
      data: scores,
      message: '請在前端生成 CSV 檔案'
    };
  } catch (error) {
    console.error('生成學測成績報表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 分科成績相關 ==========

function getSTScoreYears() {
  try {
    const years = dbOps.getSTScoreYears();
    return {
      success: true,
      years: years
    };
  } catch (error) {
    console.error('獲取分科成績年份失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getSTScores(year = 'all') {
  try {
    const scores = dbOps.getSTScores(year === 'all' ? null : parseInt(year));
    
    // 獲取分科五標資料並處理
    const stBenchmarksRaw = dbOps.getSTBenchmarks();
    const benchmarks = {};
    
    // 處理五標資料，按年份和科目組織
    stBenchmarksRaw.forEach(benchmark => {
      const year = benchmark['年分'];
      const subject = benchmark['科目'];
      const standard = benchmark['五標'];
      const score = benchmark['分數'];
      
      if (!year || !subject || !standard || score === undefined) return;
      
      if (!benchmarks[year]) {
        benchmarks[year] = {};
      }
      
      // 使用regex匹配科目名稱，移除"級分"後綴得到純科目名稱
      const subjectName = subject.replace(/級分$/, '');
      
      if (!benchmarks[year][subjectName]) {
        benchmarks[year][subjectName] = {};
      }
      
      // 將五標轉換為標準格式
      const standardMap = {
        '頂標': 'top',
        '前標': 'front',
        '均標': 'average',
        '後標': 'back',
        '底標': 'bottom'
      };
      
      const standardKey = standardMap[standard];
      if (standardKey) {
        benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
      }
    });
    
    return {
      success: true,
      students: scores,
      benchmarks: benchmarks
    };
  } catch (error) {
    console.error('獲取分科成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getAllSTScores() {
  try {
    const scores = dbOps.getSTScores(); // 不傳年份，取得所有資料
    
    // 獲取分科五標資料並處理
    const stBenchmarksRaw = dbOps.getSTBenchmarks();
    const benchmarks = {};
    
    // 處理五標資料，按年份和科目組織
    stBenchmarksRaw.forEach(benchmark => {
      const year = benchmark['年分'];
      const subject = benchmark['科目'];
      const standard = benchmark['五標'];
      const score = benchmark['分數'];
      
      if (!year || !subject || !standard || score === undefined) return;
      
      if (!benchmarks[year]) {
        benchmarks[year] = {};
      }
      
      // 使用regex匹配科目名稱，移除"級分"後綴得到純科目名稱
      const subjectName = subject.replace(/級分$/, '');
      
      if (!benchmarks[year][subjectName]) {
        benchmarks[year][subjectName] = {};
      }
      
      // 將五標轉換為標準格式
      const standardMap = {
        '頂標': 'top',
        '前標': 'front',
        '均標': 'average',
        '後標': 'back',
        '底標': 'bottom'
      };
      
      const standardKey = standardMap[standard];
      if (standardKey) {
        benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
      }
    });
    
    return {
      success: true,
      data: scores,
      benchmarks: benchmarks
    };
  } catch (error) {
    console.error('獲取完整分科成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function generateSTScoreReport(filters) {
  try {
    // 這個功能應該在前端處理 CSV 生成
    const scores = dbOps.getSTScores(filters.year);
    
    return {
      success: true,
      data: scores,
      message: '請在前端生成 CSV 檔案'
    };
  } catch (error) {
    console.error('生成分科成績報表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 跨功能查詢 ==========

function getCrossFunctionalData(selectedStudentData) {
  try {
    const result = dbOps.getCrossFunctionalData(selectedStudentData);
    
    if (result.success) {
      return {
        success: true,
        students: result.students,
        examScores: result.examScores,
        stScores: result.stScores,
        graduates: result.graduates
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error('跨功能查詢失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getIdNumberMapping() {
  try {
    const results = dbOps.getIdNumberMapping();
    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error('獲取身分證對應表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function searchIdMapping(query) {
  try {
    const results = dbOps.searchIdMapping(query);
    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error('搜尋身分證對應表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 使用者權限 ==========

function getUserTabPermissions(userEmail) {
  // 不再做任何權限檢查，直接返回所有權限
  const permissions = {
    newbie: true,
    graduate: true,
    examScore: true,
    stScore: true,
    crossFunctional: true
  };
  
  const allowedFunctions = ['新生查詢', '畢業生查詢', '學測成績', '分科成績', '跨功能查詢'];
  
  return {
    success: true,
    permissions: permissions,
    allowedFunctions: allowedFunctions
  };
  
  /* 原始權限檢查代碼 - 已停用
  try {
    const allowedFunctions = dbOps.getUserTabPermissions(userEmail);
    
    // 轉換為前端期望的格式
    const permissions = {
      newbie: allowedFunctions.includes('新生查詢'),
      graduate: allowedFunctions.includes('畢業生查詢'),
      examScore: allowedFunctions.includes('學測成績'),
      stScore: allowedFunctions.includes('分科成績'),
      crossFunctional: allowedFunctions.includes('跨功能查詢')
    };
    
    return {
      success: true,
      permissions: permissions,
      allowedFunctions: allowedFunctions
    };
  } catch (error) {
    console.error('獲取使用者權限失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
  */
}

// ========== Google Apps Script 特定函數 ==========

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

// GAS API Execute 模式入口
function executeAPI(request) {
  const { action, params } = request;
  return handleAPIRequest(action, params);
}