// tabControl 功能名稱映射表
// 用於統一前後端功能名稱的對應關係

/**
 * 功能名稱映射配置
 * 
 * key: 前端顯示的功能名稱 (用於 UI 權限控制)
 * value: tabControl 集合中的實際功能名稱 (用於資料庫查詢)
 */
const TAB_CONTROL_MAPPING = {
  // 前端名稱 => tabControl 中的名稱
  '歷年新生統計': '新生資料查詢',
  '畢業生流向統計': '畢業生流向統計', 
  '學測分數統計': '學測分數統計',
  '分科成績統計': '分科成績統計',
  '跨功能查詢名單': '跨功能查詢名單',
  '當學期學生名單查詢': '當學期學生名單查詢'
};

/**
 * 建議的 tabControl 集合完整設定
 * 請在 Firestore 中確認這些功能的設定是否正確
 * 
 * 注意：群組欄位格式說明
 * - 單一群組：直接寫群組名稱，如 "行政人員"
 * - 多個群組：使用逗號分隔，如 "行政人員,三年級導師,二年級導師,一年級導師"  
 * - 開放所有人：使用特殊值 "所有人"
 */
const RECOMMENDED_TAB_CONTROL_SETTINGS = [
  { 功能: '新生資料查詢', 群組: '行政人員' },        // 限制新生資料查詢給行政人員
  { 功能: '畢業生流向統計', 群組: '所有人' },       // 開放給所有人
  { 功能: '學測分數統計', 群組: '所有人' },         // 開放給所有人  
  { 功能: '分科成績統計', 群組: '所有人' },         // 開放給所有人
  { 功能: '跨功能查詢名單', 群組: '所有人' },        // 開放給所有人
  { 功能: '當學期學生名單查詢', 群組: '行政人員,三年級導師,二年級導師,一年級導師' } // 導師和行政人員可查看
];

/**
 * 多群組權限設定範例
 * 如果某功能需要多個群組都能存取，可以使用逗號分隔的格式
 */
const EXAMPLE_MULTI_GROUP_SETTINGS = [
  { 功能: '歷年新生統計', 群組: '行政人員,三年級導師,二年級導師,一年級導師' }, // 多群組範例
  { 功能: '特殊功能', 群組: '行政人員,教務處' },  // 兩個群組範例
];

/**
 * 檢查功能權限的標準化函數
 * @param {string} frontendFunctionName - 前端功能名稱
 * @param {Array<string>} userGroups - 用戶群組列表
 * @returns {boolean} 是否有權限
 */
function checkTabAccess(frontendFunctionName, userGroups) {
  // 獲取對應的 tabControl 功能名稱
  const tabControlFunctionName = TAB_CONTROL_MAPPING[frontendFunctionName] || frontendFunctionName;
  
  console.log(`權限檢查: 前端名稱="${frontendFunctionName}", tabControl名稱="${tabControlFunctionName}"`);
  
  // 呼叫實際的權限檢查函數
  return checkTabAccessFromDB(tabControlFunctionName, userGroups);
}

// 導出映射配置（供其他文件使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TAB_CONTROL_MAPPING,
    RECOMMENDED_TAB_CONTROL_SETTINGS,
    checkTabAccess
  };
}