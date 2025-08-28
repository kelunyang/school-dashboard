// Google Apps Script API Execute Mode Backend - Firebase 版本
// 純 Firebase 實作，無 Google Sheets 依賴

// 載入數據庫操作層
// @include BackendAdapter.js
// @include DatabaseOperations.js
// @include FirebaseDataAccess.js
// @include FirebaseSync.js
// @include AuthManager.js

// ========== 認證管理功能 (內嵌實作，確保可用) ==========

// Session 配置
function getActiveTime() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const activeTime = properties.getProperty('activeTime');
    // activeTime 以分鐘為單位，轉換為秒（Cache Service 使用秒為單位）
    return activeTime ? parseInt(activeTime) * 60 : 24 * 60 * 60; // 預設24小時
  } catch (error) {
    debugError('獲取 activeTime 失敗:', error);
    return 24 * 60 * 60; // 預設24小時
  }
}
const SESSION_CACHE_PREFIX = 'auth_session_'
const API_ACCESS_TIME_PREFIX = 'api_access_'

// 從 Cache Service 獲取 session
function getAuthenticatedSession(sessionId) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    const sessionJson = cache.get(cacheKey);
    return sessionJson ? JSON.parse(sessionJson) : null;
  } catch (error) {
    debugError('獲取已認證 session 失敗:', error);
    return null;
  }
}

// 將 session 保存到 Cache Service
function saveAuthenticatedSession(sessionId, sessionData) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    const timeout = getActiveTime();
    cache.put(cacheKey, JSON.stringify(sessionData), timeout);
    debugLog('Session 已保存到 Cache Service:', sessionId, '有效期:', timeout + '秒');
  } catch (error) {
    debugError('保存已認證 session 失敗:', error);
  }
}

// 更新 API 存取時間
function updateApiAccessTime(sessionId) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = API_ACCESS_TIME_PREFIX + sessionId;
    const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const timeout = getActiveTime();
    cache.put(cacheKey, currentTime.toString(), timeout);
    debugLog('API 存取時間已更新:', sessionId, '時間:', currentTime);
    return currentTime;
  } catch (error) {
    debugError('更新 API 存取時間失敗:', error);
    return null;
  }
}

// 獲取 API 存取時間
function getApiAccessTime(sessionId) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = API_ACCESS_TIME_PREFIX + sessionId;
    const timeStr = cache.get(cacheKey);
    return timeStr ? parseInt(timeStr) : null;
  } catch (error) {
    debugError('獲取 API 存取時間失敗:', error);
    return null;
  }
}

// 從 Cache Service 刪除 session
function removeAuthenticatedSession(sessionId) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    cache.remove(cacheKey);
    debugLog('Session 已從 Cache Service 移除:', sessionId);
  } catch (error) {
    debugError('移除已認證 session 失敗:', error);
  }
}

/**
 * 初始化認證系統
 */
function initAuthSystem() {
  try {
    // 清理過期的 sessions
    cleanExpiredSessions();
    debugLog('認證系統初始化完成');
  } catch (error) {
    debugError('初始化認證系統失敗:', error);
  }
}

/**
 * 驗證 passKey
 * @param {string} passKey - 用戶提供的 passKey
 * @param {string} sessionId - 會話標識符
 * @return {Object} 驗證結果
 */
function verifyPassKey(passKey, sessionId) {
  try {
    if (!passKey || !sessionId) {
      return {
        success: false,
        error: 'passKey 或 sessionId 不能為空'
      };
    }
    
    // 從 PropertiesService 獲取系統設定的 passKey
    const properties = PropertiesService.getScriptProperties();
    const systemPassKey = properties.getProperty('passKey');
    
    if (!systemPassKey) {
      return {
        success: false,
        error: '系統未設定 passKey'
      };
    }
    
    // 驗證 passKey
    if (passKey !== systemPassKey) {
      return {
        success: false,
        error: 'passKey 錯誤'
      };
    }
    
    // 驗證成功，記錄 session 到 Cache Service
    const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const sessionData = {
      authenticated: true,
      timestamp: currentTime
    };
    saveAuthenticatedSession(sessionId, sessionData);
    // 同時記錄 API 存取時間
    updateApiAccessTime(sessionId);
    
    debugLog('認證成功，sessionId:', sessionId);
    return {
      success: true,
      message: '驗證成功'
    };
    
  } catch (error) {
    debugError('驗證 passKey 失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 檢查 session 是否已驗證
 * @param {string} sessionId - 會話標識符
 * @return {boolean} 是否已驗證
 */
function isAuthenticated(sessionId) {
  if (!sessionId) {
    debugLog('isAuthenticated: sessionId 為空');
    return false;
  }
  
  debugLog('isAuthenticated: 檢查 sessionId:', sessionId);
  
  const session = getAuthenticatedSession(sessionId);
  debugLog('isAuthenticated: 從 Cache Service 獲取的 session:', JSON.stringify(session));
  
  if (!session || !session.authenticated) {
    debugLog('isAuthenticated: session 不存在或未認證');
    return false;
  }
  
  // 檢查 API 存取時間是否過期
  const lastApiAccessTime = getApiAccessTime(sessionId);
  const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const activeTimeInSeconds = getActiveTime();
  
  if (lastApiAccessTime) {
    const timeDiff = currentTime - lastApiAccessTime;
    debugLog('API 時間檢查:', {
      currentTime: currentTime,
      lastApiAccessTime: lastApiAccessTime,
      timeDiff: timeDiff,
      activeTimeLimit: activeTimeInSeconds
    });
    
    if (timeDiff > activeTimeInSeconds) {
      debugLog('isAuthenticated: API 存取時間已過期');
      // 清除過期 session
      removeAuthenticatedSession(sessionId);
      return false;
    }
  }
  
  // 更新 API 存取時間（延長有效期）
  updateApiAccessTime(sessionId);
  
  // 更新 session timestamp
  session.timestamp = currentTime;
  saveAuthenticatedSession(sessionId, session);
  
  debugLog('isAuthenticated: 驗證通過並更新時間');
  return true;
}

/**
 * 登出 session
 * @param {string} sessionId - 會話標識符
 */
function logout(sessionId) {
  if (sessionId) {
    removeAuthenticatedSession(sessionId);
    // 同時清除 API 存取時間
    const cache = CacheService.getScriptCache();
    const apiCacheKey = API_ACCESS_TIME_PREFIX + sessionId;
    cache.remove(apiCacheKey);
  }
}

/**
 * 刷新 session 有效期
 * @param {string} sessionId - 會話標識符
 * @return {Object} 刷新結果
 */
function renewSession(sessionId) {
  try {
    if (!sessionId) {
      return {
        success: false,
        error: 'sessionId 為空'
      };
    }
    
    // 檢查 session 是否存在
    const session = getAuthenticatedSession(sessionId);
    if (!session || !session.authenticated) {
      return {
        success: false,
        error: '未找到有效的 session，請重新登入',
        needAuth: true
      };
    }
    
    // 更新 API 存取時間
    const newAccessTime = updateApiAccessTime(sessionId);
    
    // 更新 session
    session.timestamp = Math.floor(Date.now() / 1000);
    saveAuthenticatedSession(sessionId, session);
    
    debugLog('Session 已刷新:', sessionId, '新的存取時間:', newAccessTime);
    
    return {
      success: true,
      message: 'Session 已刷新',
      accessTime: newAccessTime,
      activeTime: getActiveTime()
    };
    
  } catch (error) {
    debugError('刷新 session 失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 清理過期的 sessions
 * Cache Service 會自動清理過期的項目，所以這個函數不需要做任何事情
 */
function cleanExpiredSessions() {
  debugLog('Cache Service 會自動清理過期的 sessions');
}

/**
 * 獲取認證狀態
 * @param {string} sessionId - 會話標識符
 * @return {Object} 認證狀態資訊
 */
function getAuthStatus(sessionId) {
  const isAuth = isAuthenticated(sessionId);
  const result = {
    success: true,
    authenticated: isAuth,
    sessionId: sessionId,
    activeTime: getActiveTime() // 以秒為單位
  };
  
  if (isAuth) {
    const apiAccessTime = getApiAccessTime(sessionId);
    const currentTime = Math.floor(Date.now() / 1000);
    
    result.apiAccessTime = apiAccessTime;
    result.currentTime = currentTime;
    result.remainingTime = apiAccessTime ? Math.max(0, (apiAccessTime + getActiveTime()) - currentTime) : getActiveTime();
  }
  
  debugLog('getAuthStatus:', result);
  return result;
}

// 快取 manualDebug 設定以提高效率
let _debugSettingCache = null;
let _debugCacheTime = 0;
const DEBUG_CACHE_DURATION = 60000; // 1分鐘快取

function isDebugEnabled() {
  const now = Date.now();
  if (_debugSettingCache === null || (now - _debugCacheTime) > DEBUG_CACHE_DURATION) {
    try {
      const properties = PropertiesService.getScriptProperties();
      const manualDebug = properties.getProperty('manualDebug');
      // manualDebug 為 true 時關閉 console 輸出，為 false 或未設定時啟用
      _debugSettingCache = !(manualDebug === 'true' || manualDebug === true);
      _debugCacheTime = now;
    } catch (error) {
      _debugSettingCache = true; // 預設啟用除錯
    }
  }
  return _debugSettingCache;
}

// 條件式日誌函數
function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log(...args);
  }
}

function debugWarn(...args) {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
}

function debugError(...args) {
  console.error(...args);
}

// 主要 API 執行函數
function executeAPI(request) {
  debugLog('=== executeAPI 被呼叫 ===');
  debugLog('收到的 request:', request);
  
  try {
    if (!request || !request.action) {
      debugError('executeAPI: 缺少必要的 action 參數');
      return {
        success: false,
        error: '無效的請求：缺少 action 參數'
      };
    }
    
    const { action, params = {} } = request;
    const { sessionId } = params;
    debugLog('解析的 action:', action);
    debugLog('解析的 params:', params);
    debugLog('解析的 sessionId:', sessionId);
    
    // 記錄 API 呼叫
    const timestamp = new Date().toISOString();
    debugLog(`[${timestamp}] API Call: ${action}`, params);
    
    // 初始化認證系統
    initAuthSystem();
    
    // 認證相關的 API 不需要驗證
    const authExemptActions = ['verifyPassKey', 'getAuthStatus', 'logout', 'renewSession'];
    
    // 如果不是認證相關 API，檢查是否已認證
    if (!authExemptActions.includes(action)) {
      if (!isAuthenticated(sessionId)) {
        debugLog('未通過認證，拒絕請求');
        return {
          success: false,
          error: '未授權：請先驗證 passKey',
          needAuth: true
        };
      }
    }
    
    // 不再使用 Session API 獲取當前使用者，使用預設值 (已停用權限檢查)
    let currentUserEmail = 'default@app.lksh.ntpc.edu.tw';
    debugLog('使用預設使用者 (已停用權限檢查):', currentUserEmail);
    
    /* 原始 Session API 呼叫 - 已停用
    try {
      currentUserEmail = Session.getActiveUser().getEmail();
      debugLog('當前登入使用者:', currentUserEmail);
    } catch (error) {
      debugLog('無法獲取當前使用者:', error);
    }
    */
    
    // 根據 action 路由到對應的函數
    switch (action) {
      // ========== 認證相關 API ==========
      
      case 'verifyPassKey':
        return verifyPassKey(params.passKey, sessionId);
      
      case 'getAuthStatus':
        return getAuthStatus(sessionId);
      
      case 'logout':
        logout(sessionId);
        return { success: true, message: '已登出' };
      
      case 'renewSession':
        return renewSession(sessionId);
      
      // ========== 新的優化版 API ==========
      
      // 獲取所有可用年份（優化版）
      case 'getAvailableYearsOptimized':
        return getAvailableYearsOptimized();
      
      // 獲取完整數據包（優化版）
      case 'getCompleteDataPackage':
        // 對於 examScore 和 stScore，不傳送年份參數，讓後端一次載入所有年份
        const shouldIgnoreYear = params.dashboardType === 'examScore' || params.dashboardType === 'stScore';
        const yearParam = shouldIgnoreYear ? null : params.year;
        return getCompleteDataPackage(yearParam, params.dashboardType);
      
      // ========== 原有 API（保留兼容性） ==========
      
      // 認證相關 (已停用權限檢查)
      case 'checkUserAuthorization':
        return checkUserAuthorizationFromDB(currentUserEmail || params.userEmail);
      
      case 'getUserTabPermissions':
        debugLog('=== executeAPI getUserTabPermissions 開始 (已停用權限檢查) ===');
        const userTabResult = getUserTabPermissionsFromDB(currentUserEmail || params.userEmail);
        debugLog('getUserTabPermissionsFromDB 返回結果:', userTabResult);
        debugLog('=== executeAPI getUserTabPermissions 結束 ===');
        return userTabResult;
      
      case 'getGoogleClientId':
        return { success: true, data: getGoogleClientId() };
      
      // 系統設定
      case 'getSystemConfig':
        return getSystemConfig();
      
      // 翻譯相關
      case 'getFieldTranslationMappings':
        return getFieldTranslationMappings();
      
      // 新生資料相關
      case 'getAvailableYears':
      case 'getStudentListYears':
        return getStudentListYearsFromDB();
      
      case 'getStudentList':
        return getStudentListFromDB(params.year);
      
      case 'getCrossFunctionalStudentList':
        return getCrossFunctionalStudentListFromDB(params.selectedStudentData);
      
      case 'generateFilteredReport':
        return generateFilteredReport(params.filters, currentUserEmail);
      
      // 畢業生資料相關
      case 'getGraduateYears':
      case 'getGraduateListYears':
        return getGraduateListYearsFromDB();
      
      case 'getGraduateList':
        return getGraduateListFromDB(params.year);
      
      case 'getAllGraduateData':
        return getAllGraduateDataFromDB();
      
      case 'getUniversityRankings':
        return getUniversityRankingsFromDB();
      
      case 'getUniversityCoordinates':
        return getUniversityCoordinatesFromDB();
      
      case 'getUniversityList':
        return getUniversityListFromDB();
      
      case 'getIdNumberMapping':
        return getIdNumberMappingFromDB();
      
      case 'getCrossFunctionalGraduateList':
        return getCrossFunctionalGraduateListFromDB(params.selectedStudentData);
      
      case 'generateGraduateReport':
        return generateGraduateReport(params.filters, currentUserEmail);
      
      // 學測成績相關
      case 'getExamScoreYears':
        return getExamScoreYearsFromDB();
      
      case 'getExamScores':
        return getExamScoresFromDB(params.year);
      
      case 'getAllExamScores':
        return getExamScoresFromDB('all');
      
      case 'getCrossFunctionalExamScores':
        return getCrossFunctionalExamScoresFromDB(params.selectedStudentData);
      
      case 'generateExamScoreReport':
        return generateExamScoreReport(params.filters, currentUserEmail);
      
      // 分科成績相關
      case 'getSTScoreYears':
        return getSTScoreYearsFromDB();
      
      case 'getSTScores':
        return getSTScoresFromDB(params.year);
      
      case 'getAllSTScores':
        return getSTScoresFromDB('all');
      
      case 'getCrossFunctionalSTScores':
        return getCrossFunctionalSTScoresFromDB(params.selectedStudentData);
      
      case 'generateSTScoreReport':
        return generateSTScoreReport(params.filters, currentUserEmail);
      
      // 跨功能查詢相關
      case 'getCrossFunctionalData':
        return getCrossFunctionalData(params.selectedStudentData);
      
      case 'searchIdMapping':
        return searchIdMapping(params.searchTerm);
      
      // OAuth 驗證（已廢棄，現使用 Session API）
      case 'verifyOAuthToken':
        return { success: false, error: 'OAuth 驗證已停用，現在使用 Session API' };
      
      // ========== UID 過濾系統 ==========
      
      // 設定 UID 過濾
      case 'setUIDFilter':
        return setUIDFilterAPI(params.uids);
      
      // 取得 UID 過濾
      case 'getUIDFilter':
        return getUIDFilterAPI();
      
      // 清除 UID 過濾
      case 'clearUIDFilter':
        return clearUIDFilterAPI();
      
      // 資料庫狀態檢查
      case 'checkDatabaseStatus':
        return checkDatabaseStatus();
      
      // 新生資料 - 完整資料集 API
      case 'getAllStudentData':
        return getAllStudentData();
      
      case 'getAllStudentCoordinates':
        return getAllStudentCoordinates();
        
      case 'getJuniorHighSchoolGeoInfo':
        return getJuniorHighSchoolGeoInfo();
      
      case 'getAllCurrentStudentData':
        return getCurrentStudentListFromDB(null);
      
      // 取得指定學期的學生名單
      case 'getCurrentStudentList':
        return getCurrentStudentListFromDB(params.yearSemester);

      case 'getSheetLastModified':
        return getSheetLastModified(params.functionName);
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        };
    }
  } catch (error) {
    console.error('API Error:', error);
    return {
      success: false,
      error: `伺服器錯誤: ${error.message}`
    };
  }
}

// OAuth 驗證函數（已廢棄，現使用 Session API）
function verifyOAuthToken(accessToken) {
  return {
    success: false,
    valid: false,
    error: 'OAuth 驗證已停用，現在使用 Session API'
  };
}

// 系統配置函數
function getGoogleClientId() {
  try {
    const properties = PropertiesService.getScriptProperties();
    return properties.getProperty('GOOGLE_CLIENT_ID') || '';
  } catch (error) {
    debugError('取得 Google Client ID 失敗:', error);
    return '';
  }
}

function getSystemConfig() {
  try {
    return {
      success: true,
      config: {
        googleClientId: getGoogleClientId(),
        firebaseEnabled: shouldUseFirebase(),
        debugEnabled: isDebugEnabled()
      }
    };
  } catch (error) {
    debugError('取得系統配置失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 取得工作表最後修改時間
function getSheetLastModified(functionName) {
  try {
    debugLog(`取得工作表最後修改時間, 功能: ${functionName}`);
    
    const properties = PropertiesService.getScriptProperties();
    
    // 功能名稱到工作表屬性名稱的對應
    const functionToSheetProperty = {
      'newbie': 'newbieSheet',
      'graduate': 'graduateSheet', 
      'examScore': 'gsatSheet',
      'stScore': 'stSheet',
      'currentStudent': 'currentstudentSheet'
    };
    
    const sheetPropertyName = functionToSheetProperty[functionName];
    if (!sheetPropertyName) {
      return {
        success: false,
        error: `不支援的功能類型: ${functionName}`
      };
    }
    
    const sheetId = properties.getProperty(sheetPropertyName);
    if (!sheetId) {
      return {
        success: false,
        error: `未設定工作表 ID: ${sheetPropertyName}`
      };
    }
    
    debugLog(`工作表 ID: ${sheetId}`);
    
    // 使用 Drive API 取得檔案最後修改時間
    try {
      const file = DriveApp.getFileById(sheetId);
      const lastModified = file.getLastUpdated();
      const lastModifiedBy = file.getOwner(); // 或使用其他方法取得修改者
      
      // 取得工作表名稱
      const spreadsheet = SpreadsheetApp.openById(sheetId);
      const sheetName = spreadsheet.getName();
      
      return {
        success: true,
        functionName: functionName,
        sheetName: sheetName,
        lastModified: lastModified.toISOString(),
        modifiedBy: lastModifiedBy ? lastModifiedBy.getEmail() : '未知'
      };
    } catch (driveError) {
      debugError('Drive API 錯誤:', driveError);
      return {
        success: false,
        error: `無法取得工作表資訊: ${driveError.message}`
      };
    }
    
  } catch (error) {
    debugError('取得工作表最後修改時間失敗:', error);
    return {
      success: false,
      error: `系統錯誤: ${error.message}`
    };
  }
}

// 報表生成函數 - 基於 Firebase 數據
function generateFilteredReport(filters, userEmail) {
  try {
    debugLog('生成新生報表, 過濾條件:', filters);
    
    // 從 Firebase 取得數據
    const dataResult = getStudentListFromDB(filters.year);
    if (!dataResult.success) {
      return {
        success: false,
        error: '無法取得學生資料: ' + dataResult.error
      };
    }
    
    let filteredData = dataResult.data || [];
    
    // 應用過濾條件
    if (filters.class && filters.class !== '全部') {
      filteredData = filteredData.filter(student => student['class'] === filters.class);
    }
    
    if (filters.department && filters.department !== '全部') {
      filteredData = filteredData.filter(student => student['department'] === filters.department);
    }
    
    if (filters.gender && filters.gender !== '全部') {
      filteredData = filteredData.filter(student => student['gender'] === filters.gender);
    }
    
    // 生成 CSV 內容
    if (filteredData.length === 0) {
      return {
        success: false,
        error: '沒有符合條件的資料'
      };
    }
    
    const headers = Object.keys(filteredData[0]);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    // 記錄下載
    logDownloadFromDB(`新生報表_${filters.year}`, userEmail, {
      filters: filters,
      recordCount: filteredData.length
    });
    
    return {
      success: true,
      csvContent: csvContent,
      recordCount: filteredData.length,
      fileName: `新生報表_${filters.year}_${new Date().toISOString().split('T')[0]}.csv`
    };
    
  } catch (error) {
    debugError('生成新生報表失敗:', error);
    return {
      success: false,
      error: `生成報表失敗: ${error.message}`
    };
  }
}

function generateGraduateReport(filters, userEmail) {
  try {
    debugLog('生成畢業生報表, 過濾條件:', filters);
    
    const dataResult = getGraduateListFromDB(filters.year);
    if (!dataResult.success) {
      return {
        success: false,
        error: '無法取得畢業生資料: ' + dataResult.error
      };
    }
    
    let filteredData = dataResult.graduates || [];
    
    // 應用過濾條件
    if (filters.class && filters.class !== '全部') {
      filteredData = filteredData.filter(student => student['class'] === filters.class);
    }
    
    if (filters.department && filters.department !== '全部') {
      filteredData = filteredData.filter(student => student['department'] === filters.department);
    }
    
    // 生成 CSV 內容
    if (filteredData.length === 0) {
      return {
        success: false,
        error: '沒有符合條件的資料'
      };
    }
    
    const headers = Object.keys(filteredData[0]);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    // 記錄下載
    logDownloadFromDB(`畢業生報表_${filters.year}`, userEmail, {
      filters: filters,
      recordCount: filteredData.length
    });
    
    return {
      success: true,
      csvContent: csvContent,
      recordCount: filteredData.length,
      fileName: `畢業生報表_${filters.year}_${new Date().toISOString().split('T')[0]}.csv`
    };
    
  } catch (error) {
    debugError('生成畢業生報表失敗:', error);
    return {
      success: false,
      error: `生成報表失敗: ${error.message}`
    };
  }
}

function generateExamScoreReport(filters, userEmail) {
  try {
    debugLog('生成學測成績報表, 過濾條件:', filters);
    
    const dataResult = getExamScoresFromDB(filters.year);
    if (!dataResult.success) {
      return {
        success: false,
        error: '無法取得學測成績資料: ' + dataResult.error
      };
    }
    
    let filteredData = dataResult.students || [];
    
    // 應用過濾條件
    if (filters.class && filters.class !== '全部') {
      filteredData = filteredData.filter(student => student['class'] === filters.class);
    }
    
    if (filters.department && filters.department !== '全部') {
      filteredData = filteredData.filter(student => student['department'] === filters.department);
    }
    
    // 生成 CSV 內容
    if (filteredData.length === 0) {
      return {
        success: false,
        error: '沒有符合條件的資料'
      };
    }
    
    const headers = Object.keys(filteredData[0]);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    // 記錄下載
    logDownloadFromDB(`學測成績報表_${filters.year}`, userEmail, {
      filters: filters,
      recordCount: filteredData.length
    });
    
    return {
      success: true,
      csvContent: csvContent,
      recordCount: filteredData.length,
      fileName: `學測成績報表_${filters.year}_${new Date().toISOString().split('T')[0]}.csv`
    };
    
  } catch (error) {
    debugError('生成學測成績報表失敗:', error);
    return {
      success: false,
      error: `生成報表失敗: ${error.message}`
    };
  }
}

function generateSTScoreReport(filters, userEmail) {
  try {
    debugLog('生成分科成績報表, 過濾條件:', filters);
    
    const dataResult = getSTScoresFromDB(filters.year);
    if (!dataResult.success) {
      return {
        success: false,
        error: '無法取得分科成績資料: ' + dataResult.error
      };
    }
    
    let filteredData = dataResult.students || [];
    
    // 應用過濾條件
    if (filters.class && filters.class !== '全部') {
      filteredData = filteredData.filter(student => student['class'] === filters.class);
    }
    
    if (filters.department && filters.department !== '全部') {
      filteredData = filteredData.filter(student => student['department'] === filters.department);
    }
    
    // 生成 CSV 內容
    if (filteredData.length === 0) {
      return {
        success: false,
        error: '沒有符合條件的資料'
      };
    }
    
    const headers = Object.keys(filteredData[0]);
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    // 記錄下載
    logDownloadFromDB(`分科成績報表_${filters.year}`, userEmail, {
      filters: filters,
      recordCount: filteredData.length
    });
    
    return {
      success: true,
      csvContent: csvContent,
      recordCount: filteredData.length,
      fileName: `分科成績報表_${filters.year}_${new Date().toISOString().split('T')[0]}.csv`
    };
    
  } catch (error) {
    debugError('生成分科成績報表失敗:', error);
    return {
      success: false,
      error: `生成報表失敗: ${error.message}`
    };
  }
}

// 跨功能查詢函數
function getCrossFunctionalData(selectedStudentData) {
  try {
    if (!selectedStudentData || selectedStudentData.length === 0) {
      return {
        success: false,
        error: '未選擇學生資料'
      };
    }
    
    // 從不同資料源收集資料
    const results = {
      success: true,
      data: {
        students: [],
        graduates: [],
        examScores: [],
        stScores: []
      }
    };
    
    // 處理每個選中的學生
    selectedStudentData.forEach(student => {
      const studentId = student.studentId || student.nationalId;
      const studentName = student.name;
      
      if (studentId || studentName) {
        // 這裡可以實作複雜的跨資料庫查詢邏輯
        // 由於現在都是 Firebase，可以直接查詢
        debugLog(`查詢學生資料: ${studentName} (${studentId})`);
      }
    });
    
    return results;
    
  } catch (error) {
    debugError('跨功能查詢失敗:', error);
    return {
      success: false,
      error: `查詢失敗: ${error.message}`
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
    
    // 從 Firebase 讀取 ID 對應表
    const properties = PropertiesService.getScriptProperties();
    const firebaseUrl = properties.getProperty('firebaseDB');
    
    if (!firebaseUrl) {
      return {
        success: false,
        error: 'Firebase 配置未設定'
      };
    }
    
    const mappingUrl = `${firebaseUrl}/idNumberMapping.json`;
    const mappingData = fetchFromFirebase(mappingUrl);
    
    if (!mappingData || !Array.isArray(mappingData)) {
      return {
        success: false,
        error: '無法讀取 ID 對應表資料'
      };
    }
    
    // 搜尋匹配的記錄
    const matches = mappingData.filter(record => {
      return record.name?.includes(searchTerm) || 
             record.nationalId?.includes(searchTerm) ||
             record.registrationNumber?.toString().includes(searchTerm) ||
             record.classInfo?.toString().includes(searchTerm);
    });
    
    return {
      success: true,
      data: matches,
      totalFound: matches.length
    };
    
  } catch (error) {
    debugError('ID 對應搜尋失敗:', error);
    return {
      success: false,
      error: `搜尋失敗: ${error.message}`
    };
  }
}

// ========== 測試函數 ==========

/**
 * 測試函數 - 用於在 GAS 編輯器中觸發權限授權
 */
function triggerPermissionAuthorization() {
  try {
    console.log('測試 UrlFetch 權限...');
    // 使用 Google OAuth API (已在白名單中)
    const response = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v2/userinfo?access_token=invalid', {
      muteHttpExceptions: true
    });
    console.log('✅ UrlFetch 權限正常，狀態碼:', response.getResponseCode());
    
    console.log('測試 Firebase 連接...');
    const firebaseResult = testFirebaseConnection();
    console.log('Firebase 測試結果:', firebaseResult);
    
    console.log('測試完成 - 所有權限已授權');
    return true;
  } catch (error) {
    console.error('權限測試失敗:', error.toString());
    return false;
  }
}

/**
 * handleAPIRequest 函數 - 作為 executeAPI 的別名，用於兼容前端 apiService
 */
function handleAPIRequest(action, params = {}) {
  debugLog('=== handleAPIRequest 被呼叫 ===');
  debugLog('接收的 action:', action);
  debugLog('接收的 params:', params);
  
  const request = { action: action, params: params };
  debugLog('組合的 request 物件:', request);
  
  const result = executeAPI(request);
  debugLog('handleAPIRequest 返回結果:', result);
  
  return result;
}

/**
 * 測試 API 函數
 */
function testAPI() {
  const testRequest = {
    action: 'checkDatabaseStatus'
  };
  
  const result = executeAPI(testRequest);
  console.log('API 測試結果:', result);
  return result;
}

/**
 * 效能測試函數 - 模擬前端數據載入流程
 */
function performanceTest() {
  console.log('=== 開始效能測試 ===');
  
  const tests = [
    // 年份查詢測試
    {
      name: '獲取分科成績年份',
      action: 'getSTScoreYears',
      params: {}
    },
    {
      name: '獲取學測成績年份', 
      action: 'getExamScoreYears',
      params: {}
    },
    {
      name: '獲取學生年份',
      action: 'getStudentListYears', 
      params: {}
    },
    {
      name: '獲取畢業生年份',
      action: 'getGraduateListYears',
      params: {}
    },
    
    // 實際名單數據測試
    {
      name: '獲取最新年份分科成績',
      action: 'getSTScores',
      params: { year: 'latest' }
    },
    {
      name: '獲取最新年份學測成績',
      action: 'getExamScores',
      params: { year: 'latest' }
    },
    {
      name: '獲取最新年份學生名單',
      action: 'getStudentList',
      params: { year: 'latest' }
    },
    {
      name: '獲取最新年份畢業生名單',
      action: 'getGraduateList',
      params: { year: 'latest' }
    }
  ];
  
  const results = {};
  
  tests.forEach(test => {
    console.log(`\n--- 測試: ${test.name} ---`);
    const startTime = Date.now();
    
    try {
      const result = executeAPI({
        action: test.action,
        params: test.params
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results[test.name] = {
        duration: duration,
        success: result.success,
        dataCount: result.years ? result.years.length : 
                   result.students ? result.students.length :
                   result.graduates ? result.graduates.length :
                   result.data ? result.data.length : 0,
        error: result.error,
        hasData: !!(result.years || result.students || result.graduates || result.data)
      };
      
      console.log(`✅ ${test.name} 完成`);
      console.log(`   耗時: ${duration}ms`);
      console.log(`   成功: ${result.success}`);
      console.log(`   資料量: ${results[test.name].dataCount}`);
      if (result.benchmarks) {
        console.log(`   五標資料: 有`)
      }
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results[test.name] = {
        duration: duration,
        success: false,
        dataCount: 0,
        error: error.toString()
      };
      
      console.log(`❌ ${test.name} 失敗`);
      console.log(`   耗時: ${duration}ms`);
      console.log(`   錯誤: ${error.toString()}`);
    }
  });
  
  // 總結報告
  console.log('\n=== 效能測試結果總結 ===');
  const totalTime = Object.values(results).reduce((sum, r) => sum + r.duration, 0);
  const successCount = Object.values(results).filter(r => r.success).length;
  const hasDataCount = Object.values(results).filter(r => r.hasData).length;
  
  console.log(`總耗時: ${totalTime}ms`);
  console.log(`平均耗時: ${Math.round(totalTime / tests.length)}ms`);
  console.log(`成功率: ${successCount}/${tests.length} (${Math.round(successCount/tests.length*100)}%)`);
  console.log(`有數據: ${hasDataCount}/${tests.length} (${Math.round(hasDataCount/tests.length*100)}%)`);
  console.log('');
  
  Object.entries(results).forEach(([name, result]) => {
    const status = result.success ? 
      (result.hasData ? `成功✅ (${result.dataCount}筆)` : `成功但無數據⚠️`) : 
      `失敗❌`;
    console.log(`${name}: ${result.duration}ms ${status}`);
  });
  
  return results;
}

// ========== UID 過濾 API 函數 ==========

/**
 * 設定 UID 過濾 API
 * @param {Array<string>} uids - UID 陣列
 */
function setUIDFilterAPI(uids) {
  try {
    setUIDFilter(uids);
    return {
      success: true,
      message: `已設定 UID 過濾: ${uids ? uids.length : 0} 筆`,
      filterCount: uids ? uids.length : 0
    };
  } catch (error) {
    debugError('setUIDFilterAPI 錯誤:', error);
    return {
      success: false,
      error: `設定 UID 過濾失敗: ${error.message}`
    };
  }
}

/**
 * 取得 UID 過濾 API
 */
function getUIDFilterAPI() {
  try {
    const currentFilter = getUIDFilter();
    return {
      success: true,
      data: currentFilter,
      filterCount: currentFilter ? currentFilter.length : 0,
      isActive: !!(currentFilter && currentFilter.length > 0)
    };
  } catch (error) {
    debugError('getUIDFilterAPI 錯誤:', error);
    return {
      success: false,
      error: `取得 UID 過濾失敗: ${error.message}`
    };
  }
}

/**
 * 清除 UID 過濾 API
 */
function clearUIDFilterAPI() {
  try {
    setUIDFilter(null);
    return {
      success: true,
      message: '已清除 UID 過濾'
    };
  } catch (error) {
    debugError('clearUIDFilterAPI 錯誤:', error);
    return {
      success: false,
      error: `清除 UID 過濾失敗: ${error.message}`
    };
  }
}

/**
 * 測試 UID 過濾系統
 * 這個函數會測試整個 UID 過濾流程，包含 LEFT JOIN 功能：
 * 1. 設定測試 UID 過濾
 * 2. 查詢學生數據（會自動過濾）
 * 3. 查詢學測成績數據，測試 LEFT JOIN UID 功能
 * 4. 查詢分科成績數據，測試 LEFT JOIN UID 功能
 * 5. 清除過濾
 * 6. 再次查詢確認沒有過濾
 */
function testUIDFilterSystem() {
  debugLog('=== 開始 UID 過濾系統測試 ===');
  
  const testResults = {
    success: true,
    steps: [],
    summary: {}
  };
  
  try {
    // 步驟 1: 獲取一些測試數據
    debugLog('步驟 1: 獲取測試數據...');
    const dbOps = new DatabaseOperations();
    const allStudents = dbOps.getStudentList('latest');
    
    if (!allStudents || allStudents.length === 0) {
      throw new Error('無法獲取學生數據進行測試');
    }
    
    // 取前 3 筆數據的 UID 作為測試過濾
    const testUIDs = allStudents.slice(0, 3).map(student => student.uid).filter(uid => uid);
    
    if (testUIDs.length === 0) {
      throw new Error('找不到有效的 UID 進行測試，請確認數據已被更新為包含 UID');
    }
    
    testResults.steps.push({
      step: 1,
      name: '獲取測試數據',
      success: true,
      data: {
        totalStudents: allStudents.length,
        testUIDs: testUIDs,
        testUIDCount: testUIDs.length
      }
    });
    
    // 步驟 2: 設定 UID 過濾
    debugLog(`步驟 2: 設定 UID 過濾 (${testUIDs.length} 筆)...`);
    const setFilterResult = setUIDFilterAPI(testUIDs);
    
    if (!setFilterResult.success) {
      throw new Error(`設定 UID 過濾失敗: ${setFilterResult.error}`);
    }
    
    testResults.steps.push({
      step: 2,
      name: '設定 UID 過濾',
      success: true,
      data: setFilterResult
    });
    
    // 步驟 3: 檢查 UID 過濾狀態
    debugLog('步驟 3: 檢查 UID 過濾狀態...');
    const getFilterResult = getUIDFilterAPI();
    
    if (!getFilterResult.success || !getFilterResult.isActive) {
      throw new Error(`UID 過濾狀態異常: ${JSON.stringify(getFilterResult)}`);
    }
    
    testResults.steps.push({
      step: 3,
      name: '檢查 UID 過濾狀態',
      success: true,
      data: getFilterResult
    });
    
    // 步驟 4: 測試學生名單過濾效果
    debugLog('步驟 4: 測試學生名單過濾效果...');
    const filteredStudents = dbOps.getStudentList('latest');
    
    if (!filteredStudents) {
      throw new Error('過濾後無法獲取學生數據');
    }
    
    const expectedCount = testUIDs.length;
    const studentFilteredCount = filteredStudents.length;
    
    // 檢查學生過濾結果是否符合預期
    const studentFilterWorksCorrectly = studentFilteredCount <= expectedCount;
    
    testResults.steps.push({
      step: 4,
      name: '測試學生名單過濾效果',
      success: studentFilterWorksCorrectly,
      data: {
        originalCount: allStudents.length,
        expectedMaxCount: expectedCount,
        actualFilteredCount: studentFilteredCount,
        filterWorksCorrectly: studentFilterWorksCorrectly
      }
    });
    
    // 步驟 5: 測試學測成績 LEFT JOIN UID 過濾效果
    debugLog('步驟 5: 測試學測成績 LEFT JOIN UID 過濾效果...');
    const filteredExamScores = dbOps.getExamScores('latest');
    
    if (!filteredExamScores) {
      throw new Error('過濾後無法獲取學測成績數據');
    }
    
    const examScoresFilteredCount = filteredExamScores.length;
    
    // 檢查學測成績是否都包含 UID 欄位
    const examScoresHaveUID = filteredExamScores.every(score => score.uid !== null && score.uid !== undefined);
    
    testResults.steps.push({
      step: 5,
      name: '測試學測成績 LEFT JOIN UID 過濾',
      success: examScoresHaveUID && (examScoresFilteredCount >= 0), // 允許0筆，因為可能沒有對應的成績
      data: {
        examScoresCount: examScoresFilteredCount,
        examScoresHaveUID: examScoresHaveUID,
        sampleUID: filteredExamScores.length > 0 ? filteredExamScores[0].uid : null
      }
    });
    
    // 步驟 6: 測試分科成績 LEFT JOIN UID 過濾效果
    debugLog('步驟 6: 測試分科成績 LEFT JOIN UID 過濾效果...');
    const filteredSTScores = dbOps.getSTScores('latest');
    
    if (!filteredSTScores) {
      throw new Error('過濾後無法獲取分科成績數據');
    }
    
    const stScoresFilteredCount = filteredSTScores.length;
    
    // 檢查分科成績是否都包含 UID 欄位
    const stScoresHaveUID = filteredSTScores.every(score => score.uid !== null && score.uid !== undefined);
    
    testResults.steps.push({
      step: 6,
      name: '測試分科成績 LEFT JOIN UID 過濾',
      success: stScoresHaveUID && (stScoresFilteredCount >= 0), // 允許0筆，因為可能沒有對應的成績
      data: {
        stScoresCount: stScoresFilteredCount,
        stScoresHaveUID: stScoresHaveUID,
        sampleUID: filteredSTScores.length > 0 ? filteredSTScores[0].uid : null
      }
    });
    
    // 步驟 7: 清除 UID 過濾
    debugLog('步驟 7: 清除 UID 過濾...');
    const clearFilterResult = clearUIDFilterAPI();
    
    if (!clearFilterResult.success) {
      throw new Error(`清除 UID 過濾失敗: ${clearFilterResult.error}`);
    }
    
    testResults.steps.push({
      step: 7,
      name: '清除 UID 過濾',
      success: true,
      data: clearFilterResult
    });
    
    // 步驟 8: 驗證清除效果
    debugLog('步驟 8: 驗證清除效果...');
    const finalStudents = dbOps.getStudentList('latest');
    const finalCount = finalStudents ? finalStudents.length : 0;
    
    const clearWorksCorrectly = finalCount === allStudents.length;
    
    testResults.steps.push({
      step: 8,
      name: '驗證清除效果',
      success: clearWorksCorrectly,
      data: {
        originalCount: allStudents.length,
        finalCount: finalCount,
        clearWorksCorrectly: clearWorksCorrectly
      }
    });
    
    // 結果總結
    const allStepsSuccess = testResults.steps.every(step => step.success);
    testResults.success = allStepsSuccess;
    testResults.summary = {
      totalSteps: testResults.steps.length,
      successfulSteps: testResults.steps.filter(step => step.success).length,
      failedSteps: testResults.steps.filter(step => !step.success).length,
      allTestsPassed: allStepsSuccess,
      testData: {
        originalDataCount: allStudents.length,
        testUIDCount: testUIDs.length,
        studentFilteringWorked: testResults.steps[3]?.success || false,
        examScoreLeftJoinWorked: testResults.steps[4]?.success || false,
        stScoreLeftJoinWorked: testResults.steps[5]?.success || false,
        clearingWorked: testResults.steps[6]?.success || false
      }
    };
    
    debugLog('=== UID 過濾系統測試完成 ===');
    debugLog('測試結果:', JSON.stringify(testResults.summary, null, 2));
    
    return {
      success: true,
      message: allStepsSuccess ? 'UID 過濾系統測試全部通過✅' : 'UID 過濾系統測試部分失敗⚠️',
      data: testResults
    };
    
  } catch (error) {
    debugError('UID 過濾系統測試失敗:', error);
    
    // 嘗試清除過濾（避免影響後續操作）
    try {
      setUIDFilter(null);
    } catch (cleanupError) {
      debugError('清理過濾失敗:', cleanupError);
    }
    
    testResults.success = false;
    testResults.error = error.message;
    
    return {
      success: false,
      error: `UID 過濾系統測試失敗: ${error.message}`,
      data: testResults
    };
  }
}

// ========== 翻譯服務函數 ==========

/**
 * 獲取欄位翻譯對應表
 * 從 translateSheet 讀取中文-英文欄位對應關係
 * @returns {Object} 包含翻譯對應的結果物件
 */
function getFieldTranslationMappings() {
  try {
    debugLog('開始獲取欄位翻譯對應表...');
    
    const properties = PropertiesService.getScriptProperties();
    const translateSheetId = properties.getProperty('translateSheet');
    
    if (!translateSheetId) {
      console.warn('未設定翻譯工作表 ID');
      return {
        success: true,
        translations: {},
        message: '未設定翻譯工作表 ID，前端將使用預設對應'
      };
    }
    
    const sheet = SpreadsheetApp.openById(translateSheetId).getSheetByName('翻譯列表');
    if (!sheet) {
      console.warn('找不到翻譯列表工作表');
      return {
        success: true,
        translations: {},
        message: '找不到翻譯列表工作表，前端將使用預設對應'
      };
    }
    
    // 讀取翻譯對應資料
    const data = sheet.getDataRange().getValues();
    const mappings = {};
    
    // 第一行是標題行，從第二行開始處理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[1]) { // 第一欄是中文欄位名，第二欄是英文欄位名
        const chineseField = row[0].toString().trim();
        const englishField = row[1].toString().trim();
        mappings[chineseField] = englishField;
      }
    }
    
    if (!mappings || Object.keys(mappings).length === 0) {
      console.warn('未獲取到翻譯對應表，使用預設對應');
      return {
        success: true,
        translations: {},
        message: '未設定翻譯對應表，前端將使用預設對應'
      };
    }
    
    debugLog(`成功載入 ${Object.keys(mappings).length} 個翻譯對應`);
    
    return {
      success: true,
      translations: mappings,
      message: `成功載入 ${Object.keys(mappings).length} 個翻譯對應`
    };
    
  } catch (error) {
    debugError('獲取翻譯對應表失敗:', error);
    
    // 返回空的翻譯表，讓前端使用預設對應
    return {
      success: true,
      translations: {},
      message: '載入翻譯對應表失敗，前端將使用預設對應',
      error: error.message
    };
  }
}

// ========== 新生資料 - 完整資料集 API ==========

/**
 * 獲取完整新生名單資料（所有年份）
 */
function getAllStudentData() {
  try {
    debugLog('開始獲取完整新生名單資料（所有年份）');
    
    // 使用 BackendAdapter 或直接從 Google Sheets 讀取
    const dbOps = getDbOps();
    const students = dbOps.getAllStudentData();
    
    debugLog(`成功獲取 ${students.length} 筆完整新生資料`);
    
    return {
      success: true,
      data: students
    };
  } catch (error) {
    debugError('獲取完整新生名單失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 獲取完整學生住址座標資料
 */
function getAllStudentCoordinates() {
  try {
    debugLog('開始獲取完整學生住址座標資料');
    
    const dbOps = getDbOps();
    const coordinates = dbOps.getAllStudentCoordinates();
    
    debugLog(`成功獲取 ${coordinates.length} 筆完整住址座標資料`);
    
    return {
      success: true,
      data: coordinates
    };
  } catch (error) {
    debugError('獲取完整住址座標資料失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 獲取國中地理資訊位置資料
 */
function getJuniorHighSchoolGeoInfo() {
  try {
    debugLog('開始獲取國中地理資訊位置資料');
    
    const dbOps = getDbOps();
    const geoInfo = dbOps.getJuniorHighSchoolGeoInfo();
    
    debugLog(`成功獲取 ${geoInfo.length} 筆國中地理資訊`);
    
    return {
      success: true,
      data: geoInfo
    };
  } catch (error) {
    debugError('獲取國中地理資訊失敗:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}