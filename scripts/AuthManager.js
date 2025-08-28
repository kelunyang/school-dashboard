// 認證管理模組
// 處理 passKey 驗證邏輯

// 全域變數儲存已驗證的 sessions
const authenticatedSessions = {};
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24小時

/**
 * 初始化認證系統
 */
function initAuthSystem() {
  try {
    // 清理過期的 sessions
    cleanExpiredSessions();
    console.log('認證系統初始化完成');
  } catch (error) {
    console.error('初始化認證系統失敗:', error);
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
    
    // 驗證成功，記錄 session
    authenticatedSessions[sessionId] = {
      authenticated: true,
      timestamp: Date.now()
    };
    
    return {
      success: true,
      message: '驗證成功'
    };
    
  } catch (error) {
    console.error('驗證 passKey 失敗:', error);
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
  if (!sessionId) return false;
  
  const session = authenticatedSessions[sessionId];
  if (!session || !session.authenticated) return false;
  
  // 檢查是否過期
  const now = Date.now();
  if (now - session.timestamp > SESSION_TIMEOUT) {
    delete authenticatedSessions[sessionId];
    return false;
  }
  
  // 更新最後活動時間
  session.timestamp = now;
  return true;
}

/**
 * 登出 session
 * @param {string} sessionId - 會話標識符
 */
function logout(sessionId) {
  if (sessionId && authenticatedSessions[sessionId]) {
    delete authenticatedSessions[sessionId];
  }
}

/**
 * 清理過期的 sessions
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const sessionId in authenticatedSessions) {
    if (authenticatedSessions.hasOwnProperty(sessionId)) {
      const session = authenticatedSessions[sessionId];
      if (now - session.timestamp > SESSION_TIMEOUT) {
        delete authenticatedSessions[sessionId];
      }
    }
  }
}

/**
 * 獲取認證狀態
 * @param {string} sessionId - 會話標識符
 * @return {Object} 認證狀態資訊
 */
function getAuthStatus(sessionId) {
  const isAuth = isAuthenticated(sessionId);
  return {
    success: true,
    authenticated: isAuth,
    sessionId: sessionId
  };
}