/**
 * 前端 CSV 導出工具
 * 支持帶 BOM 的 CSV 生成，確保中文在 Excel 中正確顯示
 */

/**
 * 將數據導出為 CSV 文件
 * @param {Array} data - 要導出的數據數組
 * @param {string} filename - 文件名（不含擴展名）
 * @param {Object} options - 選項
 * @param {Array} options.headers - 自定義標題行
 * @param {Object} options.fieldMapping - 字段映射 {原字段名: 顯示名稱}
 */
export function exportToCSV(data, filename, options = {}) {
  if (!data || data.length === 0) {
    console.warn('沒有數據可以導出');
    return;
  }

  const { headers, fieldMapping } = options;
  
  // 如果沒有自定義標題，使用數據的第一個對象的鍵
  const dataHeaders = headers || Object.keys(data[0]);
  
  // 應用字段映射
  const displayHeaders = dataHeaders.map(header => 
    fieldMapping && fieldMapping[header] ? fieldMapping[header] : header
  );

  // 生成 CSV 內容
  const csvContent = generateCSVContent(data, dataHeaders, displayHeaders);
  
  // 下載文件
  downloadCSVFile(csvContent, filename);
}

/**
 * 生成 CSV 內容
 */
function generateCSVContent(data, dataHeaders, displayHeaders) {
  const rows = [];
  
  // 添加標題行
  rows.push(displayHeaders.map(header => escapeCSVField(header)).join(','));
  
  // 添加數據行
  data.forEach(row => {
    const csvRow = dataHeaders.map(header => {
      const value = row[header];
      return escapeCSVField(value);
    });
    rows.push(csvRow.join(','));
  });
  
  return rows.join('\n');
}

/**
 * 轉義 CSV 字段
 */
function escapeCSVField(field) {
  if (field == null) return '';
  
  const stringField = String(field);
  
  // 如果包含逗號、雙引號、換行符，需要用雙引號包圍
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // 將雙引號轉義為兩個雙引號
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * 下載 CSV 文件
 */
function downloadCSVFile(csvContent, filename) {
  // 添加 UTF-8 BOM，確保中文在 Excel 中正確顯示
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csvContent;
  
  // 創建 Blob
  const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
  
  // 創建下載鏈接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  // 觸發下載
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 清理 URL
  URL.revokeObjectURL(url);
  
  console.log(`CSV 文件 "${filename}.csv" 已下載`);
}

/**
 * 學測成績導出預設配置
 */
export function exportExamScores(data, customFilename = null) {
  const filename = customFilename || '學測成績';
  
  const fieldMapping = {
    '考試年分': '考試年份',
    '准考證號': '准考證號',
    '姓名': '姓名',
    '國文': '國文',
    '英文': '英文',
    '數學': '數學A',
    '數學B': '數學B',
    '社會': '社會',
    '自然': '自然',
    '總分': '總分',
    '班級': '班級',
    '座號': '座號'
  };
  
  exportToCSV(data, filename, { fieldMapping });
}

/**
 * 分科測驗導出預設配置
 */
export function exportSTScores(data, customFilename = null) {
  const filename = customFilename || '分科測驗成績';
  
  const fieldMapping = {
    '考試年分': '考試年份',
    '准考證號': '准考證號',
    '姓名': '姓名',
    '物理': '物理',
    '化學': '化學',
    '生物': '生物',
    '數學甲': '數學甲',
    '歷史': '歷史',
    '地理': '地理',
    '公民與社會': '公民與社會',
    '班級': '班級',
    '座號': '座號'
  };
  
  exportToCSV(data, filename, { fieldMapping });
}

/**
 * 學生名單導出預設配置
 */
export function exportStudentList(data, customFilename = null) {
  const filename = customFilename || '學生名單';
  
  const fieldMapping = {
    '入學年分': '入學年份',
    '學號': '學號',
    '姓名': '姓名',
    '班級': '班級',
    '座號': '座號',
    '性別': '性別',
    '入學管道': '入學管道',
    '畢業國中': '畢業國中',
    '聯絡電話': '聯絡電話',
    '地址': '地址'
  };
  
  exportToCSV(data, filename, { fieldMapping });
}

/**
 * 畢業生名單導出預設配置
 */
export function exportGraduateList(data, customFilename = null) {
  const filename = customFilename || '畢業生名單';
  
  const fieldMapping = {
    '畢業年度': '畢業年度',
    '學號': '學號',
    '姓名': '姓名',
    '班級': '班級',
    '座號': '座號',
    '性別': '性別',
    '升學學校': '升學學校',
    '升學科系': '升學科系',
    '入學方式': '入學方式',
    '備註': '備註'
  };
  
  exportToCSV(data, filename, { fieldMapping });
}

/**
 * 通用數據統計導出
 */
export function exportStatistics(data, title) {
  const filename = `${title}_統計報表_${new Date().toISOString().slice(0, 10)}`;
  exportToCSV(data, filename);
}