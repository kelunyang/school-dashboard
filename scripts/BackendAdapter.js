// Backend 適配器 - 提供 Backend.gs 期望的函數接口
// 將新的 GoogleSheetsOperations 類方法適配為舊的函數形式

// 按需載入數據的邏輯 - 直接實現，避免依賴外部類
function loadDataByDashboardType(year, dashboardType) {
  debugLog(`載入 ${year} 年度數據包，功能類型: ${dashboardType}`);
  const startTime = Date.now();
  const dbOps = getDbOps();
  
  // 初始化數據包結構
  const dataPackage = {
    year: year,
    loadTime: new Date().toISOString(),
    metadata: {
      totalRecords: 0,
      loadDuration: 0,
      queries: 0
    }
  };
  
  let queries = 0;
  let totalRecords = 0;
  
  // 根據 dashboard 類型按需載入數據
  switch (dashboardType) {
    case 'newbie':
      debugLog('載入新生數據...');
      const students = dbOps.getStudentList(year);
      const filters = dbOps.getStudentFilters();
      dataPackage.students = {
        data: students || [],
        filters: filters || {},
        count: students?.length || 0
      };
      totalRecords += students?.length || 0;
      queries += 1;
      break;

    case 'graduate':
      debugLog('載入畢業生數據...');
      const graduateResult = dbOps.getGraduateList(year);
      dataPackage.graduates = {
        data: graduateResult.success ? (graduateResult.graduates || graduateResult.data) : [],
        filters: graduateResult.success ? graduateResult.filters : {},
        count: graduateResult.success ? (graduateResult.graduates || graduateResult.data).length : 0
      };
      totalRecords += dataPackage.graduates.count;
      queries += 1;
      break;

    case 'examScore':
      debugLog('載入學測所有數據和五標資料...');
      
      // 調用 dbOps.getAllExamScores 函數
      let allExamResult = null;
      try {
        allExamResult = dbOps.getAllExamScores();
      } catch (error) {
        debugWarn('dbOps.getAllExamScores 函數不存在或執行失敗:', error);
      }
      
      if (allExamResult && allExamResult.success) {
        dataPackage.examScores = {
          data: allExamResult.data || [],
          benchmarks: allExamResult.benchmarks || {},
          count: allExamResult.data?.length || 0
        };
      } else {
        // 回退到舊方式（但一次載入全部，不按年度）
        const examScores = dbOps.getExamScores(); // 不傳年度，載入所有資料
        const gsatBenchmarks = dbOps.getGsatBenchmarks ? dbOps.getGsatBenchmarks() : [];
        
        // 處理五標資料
        const benchmarks = {};
        gsatBenchmarks.forEach(benchmark => {
          const year = benchmark['年分'];
          const subject = benchmark['科目'];
          const standard = benchmark['五標'];
          const score = benchmark['分數'];
          
          if (!year || !subject || !standard || score === undefined) return;
          
          if (!benchmarks[year]) benchmarks[year] = {};
          const subjectName = subject.replace(/級分$/, '');
          if (!benchmarks[year][subjectName]) benchmarks[year][subjectName] = {};
          
          const standardMap = { '頂標': 'top', '前標': 'front', '均標': 'average', '後標': 'back', '底標': 'bottom' };
          const standardKey = standardMap[standard];
          if (standardKey) {
            benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
          }
        });
        
        dataPackage.examScores = {
          data: examScores || [],
          benchmarks: benchmarks,
          count: examScores?.length || 0
        };
      }
      
      // ID 映射資料
      const idMapping = dbOps.getIdNumberMapping();
      dataPackage.idMapping = { 
        data: idMapping || [],
        count: idMapping?.length || 0 
      };
      
      totalRecords += dataPackage.examScores.count;
      queries += 3; // examScores + benchmarks + idMapping
      break;

    case 'stScore':
      debugLog('載入分科所有數據和五標資料...');
      
      // 調用 dbOps.getAllSTScores 函數
      let allSTResult = null;
      try {
        allSTResult = dbOps.getAllSTScores();
      } catch (error) {
        debugWarn('dbOps.getAllSTScores 函數不存在或執行失敗:', error);
      }
      
      if (allSTResult && allSTResult.success) {
        dataPackage.stScores = {
          data: allSTResult.data || [],
          benchmarks: allSTResult.benchmarks || {},
          count: allSTResult.data?.length || 0
        };
      } else {
        // 回退到舊方式（但一次載入全部，不按年度）
        const stScores = dbOps.getSTScores(); // 不傳年度，載入所有資料
        const stBenchmarks = dbOps.getSTBenchmarks ? dbOps.getSTBenchmarks() : [];
        
        // 處理五標資料
        const benchmarks = {};
        stBenchmarks.forEach(benchmark => {
          const year = benchmark['年分'];
          const subject = benchmark['科目'];
          const standard = benchmark['五標'];
          const score = benchmark['分數'];
          
          if (!year || !subject || !standard || score === undefined) return;
          
          if (!benchmarks[year]) benchmarks[year] = {};
          const subjectName = subject.replace(/級分$/, '');
          if (!benchmarks[year][subjectName]) benchmarks[year][subjectName] = {};
          
          const standardMap = { '頂標': 'top', '前標': 'front', '均標': 'average', '後標': 'back', '底標': 'bottom' };
          const standardKey = standardMap[standard];
          if (standardKey) {
            benchmarks[year][subjectName][standardKey] = parseFloat(score) || 0;
          }
        });
        
        dataPackage.stScores = {
          data: stScores || [],
          benchmarks: benchmarks,
          count: stScores?.length || 0
        };
      }
      
      // ID 映射資料
      const stIdMapping = dbOps.getIdNumberMapping();
      dataPackage.idMapping = { 
        data: stIdMapping || [],
        count: stIdMapping?.length || 0 
      };
      
      totalRecords += dataPackage.stScores.count;
      queries += 3; // stScores + benchmarks + idMapping
      break;

    case 'currentStudent':
      debugLog('載入當前學生數據...');
      
      // 步驟1：先查詢分片工作表的可用年份
      const currentStudentYears = dbOps.getCurrentStudentYears();
      debugLog('當前學生可用年度學期:', currentStudentYears);
      
      // 步驟2：確定要查詢的年度學期
      let targetYearSemester = year;
      if (year === 'latest' && currentStudentYears.length > 0) {
        // currentStudentYears 現在是物件陣列，需要取 value 屬性
        targetYearSemester = currentStudentYears[0].value; // 原始格式如 "114-1"
        debugLog(`使用最新年度學期: ${targetYearSemester} (${currentStudentYears[0].label})`);
      }
      
      // 步驟3：查詢該年度學期的學生資料
      const currentStudentResult = dbOps.getCurrentStudentList(targetYearSemester);
      debugLog('查詢結果:', {
        dataLength: currentStudentResult?.data?.length,
        byYearSemesterKeys: Object.keys(currentStudentResult?.byYearSemester || {}),
        targetYearSemester: targetYearSemester
      });
      
      dataPackage.currentStudents = {
        data: currentStudentResult?.data || [],
        byYearSemester: currentStudentResult?.byYearSemester || {},
        count: currentStudentResult?.data?.length || 0,
        availableYears: currentStudentYears // 包含轉換後的年份資訊
      };
      totalRecords += dataPackage.currentStudents.count;
      queries += 2; // getCurrentStudentYears + getCurrentStudentList
      break;

    default:
      debugLog('未知的 dashboard 類型:', dashboardType);
      break;
  }
  
  // 更新 metadata
  dataPackage.metadata.totalRecords = totalRecords;
  dataPackage.metadata.queries = queries;
  dataPackage.metadata.loadDuration = Date.now() - startTime;
  
  debugLog(`✅ ${dashboardType} 數據載入完成！`);
  debugLog(`📊 記錄數: ${totalRecords}`);
  debugLog(`🔍 查詢次數: ${queries}`);
  debugLog(`⏱️  載入時間: ${dataPackage.metadata.loadDuration}ms`);
  
  return dataPackage;
}

// ========== 新的優化版 API - 一次性數據載入 ==========

// 獲取所有可用年份（優化版）
function getAvailableYearsOptimized() {
  try {
    debugLog('=== 獲取所有可用年份（優化版） ===');
    
    const dbOps = getDbOps();
    
    // 安全的並行查詢所有集合的年份，加入錯誤處理
    const results = {
      students: [],
      graduates: [],
      examScores: [],
      stScores: [],
      currentStudents: []
    };
    
    // 安全的查詢每個數據源
    try {
      results.students = dbOps.getStudentListYears() || [];
      debugLog('學生年份查詢成功:', results.students.length, '個年份');
    } catch (error) {
      debugWarn('學生年份查詢失敗:', error.message);
    }
    
    try {
      results.graduates = dbOps.getGraduateListYears() || [];
      debugLog('畢業生年份查詢成功:', results.graduates.length, '個年份');
    } catch (error) {
      debugWarn('畢業生年份查詢失敗:', error.message);
    }
    
    try {
      results.examScores = dbOps.getExamScoreYears() || [];
      debugLog('學測年份查詢成功:', results.examScores.length, '個年份');
    } catch (error) {
      debugWarn('學測年份查詢失敗:', error.message);
    }
    
    try {
      results.stScores = dbOps.getSTScoreYears() || [];
      debugLog('分科年份查詢成功:', results.stScores.length, '個年份');
    } catch (error) {
      debugWarn('分科年份查詢失敗:', error.message);
    }
    
    try {
      results.currentStudents = dbOps.getCurrentStudentYears() || [];
      debugLog('學生名單總表年份查詢成功:', results.currentStudents.length, '個年份');
    } catch (error) {
      debugWarn('學生名單總表年份查詢失敗:', error.message);
    }
    
    // 計算所有年份的聯集
    const allYears = new Set();
    Object.values(results).forEach(years => {
      if (Array.isArray(years)) {
        years.forEach(year => {
          if (year && !isNaN(year)) {
            allYears.add(parseInt(year));
          }
        });
      }
    });
    
    const sortedYears = Array.from(allYears).sort((a, b) => b - a);
    
    // 如果沒有找到任何年份，記錄錯誤但不製造假資料
    if (sortedYears.length === 0) {
      console.error('❗ 沒有找到任何年份資料！請檢查 PropertiesService 配置和 Google Sheets 連線');
      console.error('需要設定的 PropertiesService 參數:');
      console.error('- newbieSheet: 新生資料工作表 ID');
      console.error('- graduateSheet: 畢業生資料工作表 ID');
      console.error('- examScoreSheet: 學測成績工作表 ID');
      console.error('- stScoreSheet: 分科成績工作表 ID');
      console.error('- currentStudentSheet: 學生名單工作表 ID');
    }
    
    debugLog('可用年份統計:', {
      學生年份: results.students,
      畢業生年份: results.graduates,
      學測年份: results.examScores,
      分科年份: results.stScores,
      學生名單總表年份: results.currentStudents,
      全部年份: sortedYears
    });
    
    return {
      success: true,
      years: {
        students: results.students,
        graduates: results.graduates,
        examScores: results.examScores,
        stScores: results.stScores,
        currentStudents: results.currentStudents,
        all: sortedYears
      }
    };
  } catch (error) {
    console.error('獲取可用年份失敗:', error);
    return {
      success: false,
      error: `獲取年份失敗: ${error.toString()}`,
      details: '請檢查 Google Apps Script 的 PropertiesService 配置和 Google Sheets 存取權限'
    };
  }
}

// 獲取完整數據包（優化版 - 按需載入）
function getCompleteDataPackage(year = 'latest', dashboardType = null) {
  try {
    debugLog(`=== 載入 ${year} 年度數據包 ===`);
    debugLog(`功能類型: ${dashboardType || '全部'}`);
    
    // 使用直接實現的按需載入邏輯
    const dataPackage = loadDataByDashboardType(year, dashboardType);
    
    return {
      success: true,
      dataPackage: dataPackage
    };
    
  } catch (error) {
    console.error('載入完整數據包失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========== 原有的 API（保留兼容性） ==========

// 學生資料相關適配器
function getStudentListYearsFromDB() {
  try {
    const years = getDbOps().getStudentListYears();
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

function getStudentListFromDB(year = 'all', filters = {}) {
  try {
    const students = getDbOps().getStudentList(year === 'all' ? null : parseInt(year));
    const filterOptions = getDbOps().getStudentFilters(students);
    
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

function getCrossFunctionalStudentListFromDB(selectedStudentData) {
  try {
    const result = getDbOps().getCrossFunctionalData(selectedStudentData);
    
    return result;
  } catch (error) {
    console.error('獲取跨功能學生列表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 畢業生資料相關適配器
function getGraduateListYearsFromDB() {
  try {
    const years = getDbOps().getGraduateListYears();
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

function getGraduateListFromDB(year = 'all', filters = {}) {
  try {
    debugLog(`開始獲取畢業生列表，年份: ${year}`);
    
    const result = getDbOps().getGraduateList(year === 'all' ? null : parseInt(year));
    
    if (result.success) {
      debugLog(`畢業生列表查詢完成，共 ${result.graduates.length} 筆資料`);
      
      return {
        success: true,
        graduates: result.graduates,
        data: result.graduates, // 兼容前端期待的 data 屬性
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

function getAllGraduateDataFromDB() {
  try {
    const result = getDbOps().getGraduateList(null);
    
    if (result.success) {
      return {
        success: true,
        data: result.graduates
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error('獲取所有畢業生資料失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getUniversityRankingsFromDB() {
  try {
    debugLog('開始讀取大學權值表');
    const rankings = getDbOps().getUniversityRankings();
    debugLog(`大學權值表讀取完成，共 ${rankings.length} 筆資料`);
    
    return {
      success: true,
      data: rankings
    };
  } catch (error) {
    console.error('獲取大學權值表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getUniversityCoordinatesFromDB() {
  try {
    debugLog('開始讀取大學座標表');
    const coordinates = getDbOps().getUniversityCoordinates();
    debugLog(`大學座標表讀取完成，共 ${coordinates.length} 筆資料`);
    
    return {
      success: true,
      data: coordinates
    };
  } catch (error) {
    console.error('獲取大學座標表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getUniversityListFromDB() {
  try {
    debugLog('開始讀取大學列表');
    const universities = getDbOps().getUniversityList();
    debugLog(`大學列表讀取完成，共 ${universities.length} 筆資料`);
    
    return {
      success: true,
      data: universities
    };
  } catch (error) {
    console.error('獲取大學列表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getIdNumberMappingFromDB() {
  try {
    debugLog('開始讀取身分證准考證對應表');
    const mapping = getDbOps().getIdNumberMapping();
    debugLog(`身分證准考證對應表讀取完成，共 ${mapping.length} 筆資料`);
    
    return {
      success: true,
      data: mapping
    };
  } catch (error) {
    console.error('獲取身分證准考證對應表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function getCrossFunctionalGraduateListFromDB(selectedStudentData) {
  try {
    const graduates = getDbOps().getCrossFunctionalGraduateList(selectedStudentData);
    
    return {
      success: true,
      data: graduates
    };
  } catch (error) {
    console.error('獲取跨功能畢業生列表失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 學測成績相關適配器
function getExamScoreYearsFromDB() {
  try {
    const years = getDbOps().getExamScoreYears();
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

function getExamScoresFromDB(year = 'all') {
  try {
    debugLog(`開始獲取學測成績，年份: ${year}`);
    
    const scores = getDbOps().getExamScores(year);
    
    // 獲取五標資料
    let benchmarks = {};
    try {
      if (year && year !== 'all') {
        benchmarks[year] = getDbOps().getGsatBenchmarks(year);
      } else {
        // 獲取所有年份的五標
        const years = getDbOps().getExamScoreYears();
        years.forEach(y => {
          benchmarks[y] = getDbOps().getGsatBenchmarks(y);
        });
      }
    } catch (benchmarkError) {
      debugWarn('獲取學測五標資料失敗:', benchmarkError);
    }
    
    debugLog(`學測成績查詢完成，共 ${scores.length} 筆資料`);
    
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

function getCrossFunctionalExamScoresFromDB(selectedStudentData) {
  try {
    const scores = getDbOps().getCrossFunctionalExamScores(selectedStudentData);
    
    return {
      success: true,
      students: scores
    };
  } catch (error) {
    console.error('獲取跨功能學測成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 分科成績相關適配器
function getSTScoreYearsFromDB() {
  try {
    const years = getDbOps().getSTScoreYears();
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

function getSTScoresFromDB(year = 'all') {
  try {
    debugLog(`開始獲取分科成績，年份: ${year}`);
    
    const scores = getDbOps().getSTScores(year);
    
    // 獲取五標資料
    let benchmarks = {};
    try {
      if (year && year !== 'all') {
        benchmarks[year] = getDbOps().getSTBenchmarks(year);
      } else {
        // 獲取所有年份的五標
        const years = getDbOps().getSTScoreYears();
        years.forEach(y => {
          benchmarks[y] = getDbOps().getSTBenchmarks(y);
        });
      }
    } catch (benchmarkError) {
      debugWarn('獲取五標資料失敗:', benchmarkError);
    }
    
    debugLog(`分科成績查詢完成，共 ${scores.length} 筆資料`);
    
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

function getCrossFunctionalSTScoresFromDB(selectedStudentData) {
  try {
    const scores = getDbOps().getCrossFunctionalSTScores(selectedStudentData);
    
    return {
      success: true,
      students: scores
    };
  } catch (error) {
    console.error('獲取跨功能分科成績失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 權限相關適配器 - 完整實作 (已停用權限檢查)
function checkUserAuthorizationFromDB(userEmail) {
  // 不再做任何權限檢查，直接返回授權通過
  return {
    success: true,
    authorized: true,
    userName: 'DefaultUser',
    userEmail: userEmail || 'default@app.lksh.ntpc.edu.tw',
    groups: ['所有人'],
    group: '所有人'
  };
  
  /* 原始權限檢查代碼 - 已停用
  try {
    debugLog('=== checkUserAuthorizationFromDB 開始 ===');
    debugLog('檢查用戶授權，email:', userEmail);
    
    if (!userEmail) {
      return {
        success: false,
        authorized: false,
        error: '未提供 email'
      };
    }
    
    // 1. 先到 contacts 集合用 email 找到姓名
    // 需要查詢 Emails 陣列，因為用戶可能使用備用 email 登入
    let userName = null;
    let contactDocs = getDbOps().executeCustomQuery('contacts', 'Emails', 'array-contains', userEmail);
    
    debugLog('contacts 查詢結果 (array-contains):', contactDocs);
    
    // 如果在 Emails 陣列中找不到，再試主要 email
    if (contactDocs.length === 0) {
      debugLog('在 Emails 陣列中找不到，嘗試查詢 PrimaryEmail...');
      contactDocs = getDbOps().executeCustomQuery('contacts', 'PrimaryEmail', '==', userEmail);
      debugLog('PrimaryEmail 查詢結果:', contactDocs);
    }
    
    if (contactDocs.length === 0) {
      debugWarn('在 contacts 中找不到該 email:', userEmail);
      return {
        success: false,
        authorized: false,
        error: '找不到該用戶的聯絡資訊'
      };
    }
    
    userName = contactDocs[0].fields['name'] || contactDocs[0].fields['姓名'];
    debugLog('找到使用者姓名:', userName);
    
    // 2. 用姓名到 groups 集合找群組
    let userGroups = [];
    const groupDocs = getDbOps().executeCustomQuery('groups', 'name', '==', userName);
    
    debugLog('groups 查詢結果:', groupDocs);
    
    if (groupDocs.length > 0) {
      userGroups = groupDocs[0].fields['Groups'] || [];
      debugLog('使用者群組:', userGroups);
    } else {
      debugWarn('在 groups 中找不到該用戶:', userName);
      // 沒找到群組，設定為一般使用者
      userGroups = ['一般使用者'];
    }
    
    debugLog('=== checkUserAuthorizationFromDB 結束 ===');
    
    return {
      success: true,
      authorized: true,
      userName: userName,
      userEmail: userEmail,
      groups: userGroups,
      group: userGroups[0] || '一般使用者'
    };
    
  } catch (error) {
    debugError('checkUserAuthorizationFromDB 發生錯誤:', error);
    return {
      success: false,
      authorized: false,
      error: error.toString()
    };
  }
  */
}

function getUserTabPermissionsFromDB(userEmail) {
  // 不再做任何權限檢查，直接返回所有權限
  return {
    success: true,
    userEmail: userEmail || 'default@app.lksh.ntpc.edu.tw',
    groups: ['所有人'],
    permissions: {
      '歷年新生統計': true,
      '畢業生流向統計': true,
      '學測分數統計': true,
      '分科成績統計': true,
      '跨功能查詢名單': true,
      '當學期學生名單查詢': true
    }
  };
  
  /* 原始權限檢查代碼 - 已停用
  debugLog('=== getUserTabPermissionsFromDB 開始 ===');
  debugLog('輸入 userEmail 參數:', userEmail);
  
  try {
    // 直接使用傳入的 userEmail，不需要再次呼叫 Session API
    if (!userEmail) {
      debugLog('userEmail 為空，嘗試使用 Session API');
      try {
        userEmail = Session.getActiveUser().getEmail();
        debugLog('Session.getActiveUser().getEmail() 成功，結果:', userEmail);
      } catch (sessionError) {
        debugError('Session.getActiveUser() 失敗:', sessionError);
        return {
          success: false,
          userEmail: null,
          message: '無法獲取用戶會話信息',
          error: sessionError.toString()
        };
      }
    }
    
    if (!userEmail) {
      debugLog('userEmail 仍為空，用戶未登入');
      return {
        success: false,
        userEmail: null,
        message: '尚未登入 Google 帳號'
      };
    }
    
    debugLog('當前用戶:', userEmail);
    
    // 檢查用戶授權
    debugLog('正在檢查用戶授權...');
    const authResult = checkUserAuthorizationFromDB(userEmail);
    debugLog('授權檢查結果:', authResult);
    
    if (!authResult.success) {
      debugWarn('用戶授權失敗');
      return {
        success: false,
        userEmail: userEmail,
        message: '無權限存取系統',
        permissions: {
          '歷年新生統計': false,
          '畢業生流向統計': false,
          '學測分數統計': false,
          '分科成績統計': false,
          '跨功能查詢名單': false
        }
      };
    }
    
    // 獲取用戶的標籤權限
    const userGroups = authResult.groups || [];
    debugLog('用戶群組:', userGroups);
    
    // 統一的功能名稱映射 (前端名稱 => tabControl名稱)
    const tabControlMapping = {
      '歷年新生統計': '新生資料查詢',
      '畢業生流向統計': '畢業生流向統計', 
      '學測分數統計': '學測分數統計',
      '分科成績統計': '分科成績統計',
      '跨功能查詢名單': '跨功能查詢名單',
      '當學期學生名單查詢': '當學期學生名單查詢'
    };

    const permissions = {};
    Object.keys(tabControlMapping).forEach(frontendName => {
      const tabControlName = tabControlMapping[frontendName];
      debugLog(`🔍 檢查權限: ${frontendName} (tabControl: ${tabControlName})`);
      permissions[frontendName] = checkTabAccessFromDB(tabControlName, userGroups);
    });
    debugLog('計算出的權限:', permissions);
    
    const result = {
      success: true,
      userEmail: userEmail,
      groups: userGroups,
      permissions: permissions
    };
    
    debugLog('=== getUserTabPermissionsFromDB 成功結束 ===');
    debugLog('最終結果:', result);
    
    return result;
  } catch (error) {
    debugError('getUserTabPermissionsFromDB 發生異常:', error);
    debugError('錯誤堆疊:', error.stack);
    return {
      success: false,
      error: error.toString(),
      message: '獲取權限時發生錯誤'
    };
  }
  */
}

function checkTabAccessFromDB(tabName, userGroups) {
  // 不再做任何權限檢查，直接返回 true
  return true;
  
  /* 原始權限檢查代碼 - 已停用
  try {
    debugLog('=== checkTabAccessFromDB 開始 ===');
    debugLog('檢查功能權限，tabName:', tabName, 'userGroups:', userGroups);
    
    // 查詢 tabControl 集合，找到該功能的權限設定
    const tabDocs = getDbOps().executeCustomQuery('tabControl', 'function', '==', tabName);
    
    debugLog('tabControl 查詢結果:', tabDocs);
    debugLog('查詢到的文檔數量:', tabDocs.length);
    
    if (tabDocs.length === 0) {
      debugWarn('⚠️ 在 tabControl 中找不到功能:', tabName);
      debugLog('預設拒絕存取 (如果沒有特別設定，拒絕所有人使用)');
      // 如果沒有設定，預設拒絕所有人
      return false;
    }
    
    const requiredGroupsString = tabDocs[0].fields['group'] || tabDocs[0].fields['群組'];
    debugLog('📋 該功能所需群組（原始）:', requiredGroupsString);
    debugLog('👤 用戶群組:', userGroups);
    
    // 如果設定為 "所有人"，則允許所有用戶
    if (requiredGroupsString === '所有人') {
      debugLog('✅ 該功能開放給所有人');
      return true;
    }
    
    // 將逗號分隔的群組字串切割成陣列
    const requiredGroups = requiredGroupsString
      .split(',')
      .map(group => group.trim())
      .filter(group => group.length > 0);
    
    debugLog('📋 該功能所需群組（陣列）:', requiredGroups);
    
    // 檢查用戶群組是否包含任一所需群組
    const hasAccess = requiredGroups.some(requiredGroup => 
      userGroups.includes(requiredGroup)
    );
    
    debugLog('🔍 權限檢查詳情:');
    requiredGroups.forEach(requiredGroup => {
      const hasThisGroup = userGroups.includes(requiredGroup);
      debugLog('  - ' + requiredGroup + ': ' + (hasThisGroup ? '✅ 有' : '❌ 無'));
    });
    
    debugLog('🔍 最終權限檢查結果:', hasAccess ? '✅ 有權限' : '❌ 無權限');
    debugLog('=== checkTabAccessFromDB 結束 ===');
    
    return hasAccess;
    
  } catch (error) {
    console.error('❌ checkTabAccessFromDB 發生錯誤:', error);
    console.error('錯誤詳情:', error.toString());
    // 發生錯誤時，預設拒絕存取
    return false;
  }
  */
}

// 系統相關適配器
function shouldUseFirebase() {
  // 現在使用 Firestore，但保持兼容性
  return true;
}

function testFirebaseConnection() {
  try {
    // 測試 Firestore 連接
    new DatabaseOperations();
    return true;
  } catch (error) {
    console.error('Firestore 連接測試失敗:', error);
    return false;
  }
}

// Firebase 資料獲取（舊系統兼容）
function fetchFromFirebase(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      console.error('Firebase 請求失敗:', response.getResponseCode());
      return null;
    }
  } catch (error) {
    console.error('Firebase 請求錯誤:', error);
    return null;
  }
}

// 資料庫狀態檢查
function checkDatabaseStatus() {
  try {
    // 測試 Firestore 連接和基本查詢
    const dbOps = getDbOps();
    
    // 測試查詢各個主要集合
    const tests = [
      { collection: 'contacts', name: '聯絡人' },
      { collection: 'groups', name: '群組' },
      { collection: 'tabControl', name: '標籤控制' },
      { collection: 'students', name: '學生資料' },
      { collection: 'graduates', name: '畢業生資料' }
    ];
    
    const results = {};
    let allHealthy = true;
    
    for (const test of tests) {
      try {
        const query = dbOps.firestore.query(test.collection).limit(1);
        const docs = query.execute();
        results[test.name] = {
          healthy: true,
          message: `成功連接，找到 ${docs.length} 筆測試資料`
        };
      } catch (error) {
        results[test.name] = {
          healthy: false,
          error: error.toString()
        };
        allHealthy = false;
      }
    }
    
    return {
      success: true,
      healthy: allHealthy,
      collections: results,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('資料庫狀態檢查失敗:', error);
    return {
      success: false,
      healthy: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

function logDownloadFromDB(reportType, userEmail, metadata = {}) {
  try {
    // 記錄下載活動到 Firestore
    const dbOps = getDbOps();
    const logData = {
      reportType: reportType,
      userEmail: userEmail,
      timestamp: new Date().toISOString(),
      metadata: metadata
    };
    
    // 這裡可以實作記錄到 downloads 集合的邏輯
    debugLog('記錄下載活動:', logData);
    
    return {
      success: true,
      logged: true
    };
  } catch (error) {
    console.error('記錄下載活動失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 跨功能查詢相關適配器
function getCrossFunctionalData(selectedStudentData) {
  try {
    if (!selectedStudentData || selectedStudentData.length === 0) {
      return {
        success: false,
        error: '未選擇學生資料'
      };
    }
    
    const idNumbers = selectedStudentData.map(student => 
      student['身分證統一編號'] || student.idNumber
    ).filter(id => id);
    
    if (idNumbers.length === 0) {
      return {
        success: false,
        error: '無有效的身分證號碼'
      };
    }
    
    const data = getDbOps().getCrossFunctionalData(idNumbers);
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('跨功能查詢失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function searchIdMapping(searchTerm) {
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return {
        success: false,
        error: '搜尋條件不能為空'
      };
    }
    
    const results = getDbOps().searchIdMapping(searchTerm.trim());
    
    return {
      success: true,
      data: results,
      totalFound: results.length
    };
  } catch (error) {
    console.error('ID 對應搜尋失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 當學期學生名單相關適配器
function getCurrentStudentListFromDB(year = null) {
  try {
    debugLog(`開始獲取當學期學生名單，年份: ${year || '所有年份'}`);
    
    const result = getDbOps().getCurrentStudentList(year);
    
    debugLog(`當學期學生名單查詢完成，共 ${result.data.length} 筆資料`);
    debugLog(`年份學期分組: ${Object.keys(result.byYearSemester).length} 組`);
    
    return {
      success: true,
      data: result.data,
      byYearSemester: result.byYearSemester
    };
  } catch (error) {
    console.error('獲取當學期學生名單失敗:', error);
    return {
      success: false,
      error: error.toString(),
      data: [],
      byYearSemester: {}
    };
  }
}

// 舊系統的權限相關函數 - 暫時的空實現
function getTabControlFromFirebase() {
  return [];
}