/**
 * 跨功能查詢UID工廠方法
 * 提供統一的UID提取邏輯，確保各功能間的數據互通
 */

/**
 * 通用UID提取函數
 * @param {Object} student - 學生對象
 * @param {string} functionType - 功能類型 ('newbie', 'graduate', 'examScore', 'stScore', 'currentStudent')
 * @returns {string|null} - 提取到的UID或null
 */
export function getStudentUID(student, functionType = 'default') {
  if (!student) return null
  
  // 根據功能類型使用不同的UID提取策略
  switch (functionType) {
    case 'currentStudent':
      // 當學期名單：優先使用身分證字號
      return student['身分證字號'] || 
             student['身分證統一編號'] || 
             student.nationalId || 
             student.idNumber || 
             student['學號'] || 
             student.studentId
    
    case 'newbie':
      // 新生統計：優先使用身分證相關字段
      return student['身分證統一編號'] || 
             student['身分證字號'] || 
             student.nationalId || 
             student.idNumber ||
             student['學號'] || 
             student.studentId
    
    case 'graduate':
      // 畢業生流向：使用身分證號或已經處理過的idNumber
      return student.idNumber || 
             student['身分證字號'] || 
             student['身分證統一編號'] || 
             student.nationalId ||
             student['學號'] || 
             student.studentId
    
    case 'examScore':
    case 'stScore':
      // 學測/分科：透過idMapping查找後的idNumber，或直接的身分證字號
      return student.idNumber || 
             student.registrationNumber || 
             student['身分證字號'] || 
             student['身分證統一編號'] || 
             student.nationalId
    
    default:
      // 通用提取策略：優先身分證相關字段
      return student['身分證字號'] || 
             student['身分證統一編號'] || 
             student.nationalId || 
             student.idNumber || 
             student.registrationNumber ||
             student['學號'] || 
             student.studentId
  }
}

/**
 * 驗證UID是否有效
 * @param {string} uid - 要驗證的UID
 * @returns {boolean} - UID是否有效
 */
export function isValidUID(uid) {
  return uid && typeof uid === 'string' && uid.trim().length > 0
}

/**
 * 獲取功能顯示名稱
 * @param {string} functionType - 功能類型
 * @returns {string} - 功能的中文顯示名稱
 */
export function getFunctionDisplayName(functionType) {
  const functionNames = {
    'newbie': '新生統計',
    'graduate': '畢業生統計', 
    'examScore': '學測成績',
    'stScore': '分科成績',
    'currentStudent': '當學期名單'
  }
  return functionNames[functionType] || functionType
}