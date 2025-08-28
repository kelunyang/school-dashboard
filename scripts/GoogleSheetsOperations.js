// Google Sheets 數據庫操作
// 取代 Firestore/Supabase，使用 Google Sheets API 進行所有數據操作

// 全域快取物件 - 延長快取時間以減少 Google Sheets API 查詢
const CACHE_DURATION = 30 * 60 * 1000; // 30分鐘快取
var globalCache = {
  studentYears: { data: null, timestamp: 0 },
  graduateYears: { data: null, timestamp: 0 },
  examScoreYears: { data: null, timestamp: 0 },
  stScoreYears: { data: null, timestamp: 0 },
  idNumberMapping: { data: null, timestamp: 0 },
  filters: { data: null, timestamp: 0 }
};

// UID 過濾系統已移除，改用身分證字號作為統一 UID

// 快取輔助函數
function getCachedData(cacheKey) {
  const cached = globalCache[cacheKey];
  if (cached && cached.data && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    // this.log(`使用快取資料: ${cacheKey}`);
    return cached.data;
  }
  return null;
}

function setCachedData(cacheKey, data) {
  globalCache[cacheKey] = {
    data: data,
    timestamp: Date.now()
  };
  // this.log(`快取資料已更新: ${cacheKey}`);
}

function clearCache(cacheKey = null) {
  if (cacheKey) {
    if (globalCache[cacheKey]) {
      globalCache[cacheKey] = { data: null, timestamp: 0 };
      // this.log(`已清除快取: ${cacheKey}`);
    }
  } else {
    Object.keys(globalCache).forEach(key => {
      globalCache[key] = { data: null, timestamp: 0 };
    });
    // this.log('已清除所有快取');
  }
}

class GoogleSheetsOperations {
  // 內部日誌輸出函數
  log(...args) {
    if (!this.manualDebug) {
      console.log(...args);
    }
  }
  
  warn(...args) {
    if (!this.manualDebug) {
      console.warn(...args);
    }
  }
  
  constructor() {
    // 從 PropertiesService 獲取各種工作表配置
    const properties = PropertiesService.getScriptProperties();
    
    // 獲取manualDebug參數
    const manualDebugStr = properties.getProperty('manualDebug');
    this.manualDebug = manualDebugStr === 'true';
    
    this.config = {
      newbieSheet: properties.getProperty('newbieSheet'),
      graduateSheet: properties.getProperty('graduateSheet'),
      gsatSheet: properties.getProperty('gsatSheet'),
      stScoreSheet: properties.getProperty('stSheet'), // 使用 stSheet 而非 stScoreSheet
      authSheet: properties.getProperty('authSheet'),
      currentStudentSheet: properties.getProperty('currentstudentSheet'),
      geoInfoSheet: properties.getProperty('geoInfoSheet'),
      downloadLogsSheet: properties.getProperty('downloadLogsSheet'),
      universityListSheet: properties.getProperty('universityListSheet'),
      universityRankingSheet: properties.getProperty('universityRankingSheet'),
      gsatBenchmarksSheet: properties.getProperty('gsatBenchmarksSheet'),
      stBenchmarksSheet: properties.getProperty('stBenchmarksSheet'),
      idNumberMappingSheet: properties.getProperty('idNumberMappingSheet'),
      tabcontrolSheet: properties.getProperty('tabcontrolSheet'),
      schemaSheet: properties.getProperty('schemaSheet')
    };
    
    this.log('初始化 GoogleSheetsOperations...');
    this.log('配置的工作表數量:', Object.keys(this.config).filter(key => this.config[key]).length);
    
    // 檢查必要的配置
    const requiredSheets = ['newbieSheet', 'authSheet'];
    const missingSheets = requiredSheets.filter(sheet => !this.config[sheet]);
    
    if (missingSheets.length > 0) {
      this.warn('缺少必要的工作表配置:', missingSheets.join(', '));
    }
  }

  // ========== 工作表讀取輔助函數 ==========

  /**
   * 安全地開啟並讀取工作表資料
   * @param {string} sheetId - 工作表 ID
   * @param {string} worksheetName - 工作表分頁名稱
   * @param {boolean} includeHeaders - 是否包含標題行
   * @returns {Array} 工作表資料陣列
   */
  readSheetData(sheetId, worksheetName = null, includeHeaders = true) {
    if (!sheetId) {
      this.warn('工作表 ID 為空');
      return [];
    }

    try {
      const sheet = SpreadsheetApp.openById(sheetId);
      const worksheet = worksheetName ? 
        sheet.getSheetByName(worksheetName) : 
        sheet.getActiveSheet();

      if (!worksheet) {
        this.warn(`找不到工作表: ${worksheetName || '預設工作表'}`);
        return [];
      }

      const range = worksheet.getDataRange();
      if (range.getNumRows() === 0) {
        this.warn(`工作表 ${worksheetName || '預設'} 無資料`);
        return [];
      }

      const data = range.getValues();
      
      if (!includeHeaders && data.length > 0) {
        return data.slice(1);
      }
      
      return data;
    } catch (error) {
      console.error(`讀取工作表失敗 (${sheetId}/${worksheetName}):`, error);
      return [];
    }
  }

  /**
   * 將工作表資料轉換為物件陣列
   * @param {Array} rawData - 原始工作表資料
   * @param {boolean} hasHeaders - 第一行是否為標題
   * @returns {Array} 物件陣列
   */
  convertToObjects(rawData, hasHeaders = true) {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    if (!hasHeaders || rawData.length < 2) {
      return rawData;
    }

    const headers = rawData[0];
    const records = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const record = {};
      let hasData = false;

      headers.forEach((header, index) => {
        const value = row[index];
        if (value !== undefined && value !== null && value !== '') {
          record[header] = value;
          hasData = true;
        }
      });

      if (hasData) {
        records.push(record);
      }
    }

    return records;
  }

  // ========== 年度資料查詢 ==========

  /**
   * 獲取新生資料的可用年度
   */
  getStudentListYears() {
    const cacheKey = 'studentYears';
    let cachedYears = getCachedData(cacheKey);
    
    if (cachedYears) {
      return cachedYears;
    }

    try {
      const data = this.readSheetData(this.config.newbieSheet, '新生名單彙總表[不輸出]');
      if (data.length === 0) {
        return [];
      }

      const yearSet = new Set();
      const headers = data[0];
      const yearIndex = headers.indexOf('入學年分');

      if (yearIndex === -1) {
        this.warn('新生資料中找不到入學年分欄位');
        return [];
      }

      for (let i = 1; i < data.length; i++) {
        const year = data[i][yearIndex];
        if (year && !isNaN(year)) {
          yearSet.add(parseInt(year));
        }
      }

      const years = Array.from(yearSet).sort((a, b) => b - a);
      setCachedData(cacheKey, years);
      
      this.log(`找到新生資料年度: ${years.join(', ')}`);
      return years;
    } catch (error) {
      console.error('獲取新生年度失敗:', error);
      return [];
    }
  }

  /**
   * 獲取畢業生資料的可用年度
   */
  getGraduateListYears() {
    const cacheKey = 'graduateYears';
    let cachedYears = getCachedData(cacheKey);
    
    if (cachedYears) {
      return cachedYears;
    }

    try {
      const data = this.readSheetData(this.config.graduateSheet, '榜單彙總表[不輸出]');
      if (data.length === 0) {
        return [];
      }

      const yearSet = new Set();
      const headers = data[0];
      const yearIndex = headers.indexOf('榜單年分');

      if (yearIndex === -1) {
        this.warn('榜單彙總表中找不到榜單年分欄位');
        return [];
      }

      for (let i = 1; i < data.length; i++) {
        const year = data[i][yearIndex];
        if (year && !isNaN(year)) {
          yearSet.add(parseInt(year));
        }
      }

      const years = Array.from(yearSet).sort((a, b) => b - a);
      setCachedData(cacheKey, years);
      
      this.log(`找到畢業生榜單年度: ${years.join(', ')}`);
      return years;
    } catch (error) {
      console.error('獲取畢業生年度失敗:', error);
      return [];
    }
  }

  /**
   * 獲取學測成績的可用年度
   */
  getExamScoreYears() {
    const cacheKey = 'examScoreYears';
    let cachedYears = getCachedData(cacheKey);
    
    if (cachedYears) {
      return cachedYears;
    }

    try {
      const data = this.readSheetData(this.config.gsatSheet, '歷年學測成績彙總表[不輸出]');
      if (data.length === 0) {
        return [];
      }

      const yearSet = new Set();
      const headers = data[0];
      const yearIndex = headers.indexOf('年度');

      if (yearIndex === -1) {
        this.warn('學測成績彙總表中找不到年度欄位');
        return [];
      }

      for (let i = 1; i < data.length; i++) {
        const year = data[i][yearIndex];
        if (year && !isNaN(year)) {
          yearSet.add(parseInt(year));
        }
      }

      const years = Array.from(yearSet).sort((a, b) => b - a);
      setCachedData(cacheKey, years);
      
      this.log(`找到學測成績年度: ${years.join(', ')}`);
      return years;
    } catch (error) {
      console.error('獲取學測成績年度失敗:', error);
      return [];
    }
  }

  /**
   * 獲取分科成績的可用年度
   */
  getSTScoreYears() {
    const cacheKey = 'stScoreYears';
    let cachedYears = getCachedData(cacheKey);
    
    if (cachedYears) {
      return cachedYears;
    }

    try {
      const data = this.readSheetData(this.config.stScoreSheet, '歷年分科成績彙總表[不輸出]');
      if (data.length === 0) {
        return [];
      }

      const yearSet = new Set();
      const headers = data[0];
      const yearIndex = headers.indexOf('年度');

      if (yearIndex === -1) {
        this.warn('分科成績彙總表中找不到年度欄位');
        return [];
      }

      for (let i = 1; i < data.length; i++) {
        const year = data[i][yearIndex];
        if (year && !isNaN(year)) {
          yearSet.add(parseInt(year));
        }
      }

      const years = Array.from(yearSet).sort((a, b) => b - a);
      setCachedData(cacheKey, years);
      
      this.log(`找到分科成績年度: ${years.join(', ')}`);
      return years;
    } catch (error) {
      console.error('獲取分科成績年度失敗:', error);
      return [];
    }
  }

  // ========== 學生資料查詢 ==========

  /**
   * 獲取指定年度的新生名單
   * @param {number} year - 年度
   * @returns {Array} 學生資料陣列
   */
  getStudentList(year) {
    this.log(`獲取 ${year} 年度新生名單`);
    
    try {
      // 讀取基本學生資料
      const studentData = this.readSheetData(this.config.newbieSheet, '新生名單彙總表[不輸出]');
      const studentRecords = this.convertToObjects(studentData);
      
      // 讀取地理座標資料
      let coordinateRecords = [];
      try {
        const coordinateData = this.readSheetData(this.config.newbieSheet, '學生住址座標[不輸出]');
        coordinateRecords = this.convertToObjects(coordinateData);
        this.log(`讀取到 ${coordinateRecords.length} 筆座標資料`);
      } catch (coordError) {
        this.warn('無法讀取學生住址座標資料:', coordError);
      }
      
      // 建立座標資料的快速查詢對照表
      const coordinateMap = new Map();
      coordinateRecords.forEach(coord => {
        const idNumber = coord['身分證字號'];
        if (idNumber) {
          coordinateMap.set(idNumber, {
            address: coord['地址'] || '',
            lat: coord['緯度'] || null,
            lng: coord['經度'] || null
          });
        }
      });
      
      // 合併學生資料與地理資訊
      const enrichedRecords = studentRecords.map(student => {
        const idNumber = student['身分證統一編號'] || student['身分證字號'];
        const coordinateInfo = coordinateMap.get(idNumber);
        
        // 住址座標資訊
        const hasAddressGeo = !!(coordinateInfo && coordinateInfo.lat && coordinateInfo.lng);
        
        // TODO: 這裡應該要根據畢業國中代碼查詢學校座標
        // 目前先設為 null，需要另外建立學校座標對照表
        const schoolLng = null;
        const schoolLat = null;
        const hasSchoolGeo = false;
        
        return {
          ...student,
          // 學生住址相關
          住址經度: coordinateInfo ? coordinateInfo.lng : null,
          住址緯度: coordinateInfo ? coordinateInfo.lat : null,
          地址: student['地址'] || (coordinateInfo ? coordinateInfo.address : ''),
          // 畢業國中相關（前端期望的欄位）
          lng: schoolLng,
          lat: schoolLat,
          hasGeoInfo: hasSchoolGeo
        };
      });
      
      // 年份篩選
      if (!year) {
        this.log(`回傳所有新生資料: ${enrichedRecords.length} 筆`);
        return enrichedRecords;
      }

      const yearStr = year.toString();
      const filtered = enrichedRecords.filter(record => 
        record['入學年分'] && record['入學年分'].toString() === yearStr
      );

      const geoCount = filtered.filter(r => r.hasGeoInfo).length;
      this.log(`${year} 年度新生資料: ${filtered.length} 筆，其中 ${geoCount} 筆有地理資訊`);
      return filtered;
    } catch (error) {
      console.error(`獲取 ${year} 年度新生名單失敗:`, error);
      return [];
    }
  }

  /**
   * 獲取完整新生名單資料（所有年份）
   * @returns {Array} 完整新生名單資料陣列
   */
  getAllStudentData() {
    this.log('獲取完整新生名單資料（所有年份）');
    
    try {
      // 讀取基本學生資料
      const studentData = this.readSheetData(this.config.newbieSheet, '新生名單彙總表[不輸出]');
      const studentRecords = this.convertToObjects(studentData);
      
      this.log(`讀取到 ${studentRecords.length} 筆完整新生資料`);
      return studentRecords;
    } catch (error) {
      console.error('獲取完整新生名單失敗:', error);
      return [];
    }
  }

  /**
   * 獲取完整學生住址座標資料
   * @returns {Array} 完整住址座標資料陣列
   */
  getAllStudentCoordinates() {
    this.log('獲取完整學生住址座標資料');
    
    try {
      const coordinateData = this.readSheetData(this.config.newbieSheet, '學生住址座標[不輸出]');
      const coordinateRecords = this.convertToObjects(coordinateData);
      
      this.log(`讀取到 ${coordinateRecords.length} 筆完整住址座標資料`);
      return coordinateRecords;
    } catch (error) {
      console.error('獲取完整住址座標資料失敗:', error);
      return [];
    }
  }

  /**
   * 獲取國中地理資訊位置資料
   * @returns {Array} 國中地理位置資料陣列
   */
  getJuniorHighSchoolGeoInfo() {
    this.log('獲取國中地理資訊位置資料');
    
    try {
      const data = this.readSheetData(this.config.newbieSheet, '國中地理資訊位置[不輸出]');
      const records = this.convertToObjects(data);
      
      // 只回傳需要的欄位：長名稱、經度、緯度
      const geoInfo = records.map(record => ({
        schoolName: record['長名稱'] || '',
        lng: parseFloat(record['經度']) || null,
        lat: parseFloat(record['緯度']) || null
      })).filter(record => record.schoolName && record.lng && record.lat);
      
      this.log(`讀取到 ${geoInfo.length} 筆國中地理資訊`);
      return geoInfo;
    } catch (error) {
      console.error('獲取國中地理資訊失敗:', error);
      return [];
    }
  }

  /**
   * 獲取指定年度的畢業生名單
   * @param {number} year - 年度
   * @returns {Object} 包含資料和過濾器的結果物件
   */
  getGraduateList(year) {
    this.log(`獲取 ${year} 年度畢業生名單`);
    
    try {
      const data = this.readSheetData(this.config.graduateSheet, '榜單彙總表[不輸出]');
      const records = this.convertToObjects(data);
      
      if (!year) {
        return {
          success: true,
          graduates: records,
          filters: this.buildGraduateFilters(records)
        };
      }

      const yearStr = year.toString();
      const filtered = records.filter(record => 
        record['榜單年分'] && record['榜單年分'].toString() === yearStr
      );

      this.log(`${year} 年度畢業生榜單: ${filtered.length} 筆`);
      
      return {
        success: true,
        graduates: filtered,
        filters: this.buildGraduateFilters(filtered)
      };
    } catch (error) {
      console.error(`獲取 ${year} 年度畢業生名單失敗:`, error);
      return {
        success: false,
        error: error.toString(),
        graduates: [],
        filters: {}
      };
    }
  }

  /**
   * 獲取大學權值表
   * @returns {Array} 大學權值資料陣列
   */
  getUniversityRankings() {
    this.log('開始讀取大學權值表');
    
    try {
      const data = this.readSheetData(this.config.graduateSheet, '大學權值表[不輸出]');
      const records = this.convertToObjects(data);
      
      // 處理權值資料，確保完整權值是數字
      const processed = records.map(record => ({
        名稱: record['名稱'],
        完整權值: parseFloat(record['完整權值']) || 0
      })).filter(record => record.名稱); // 過濾掉沒有名稱的記錄
      
      this.log(`大學權值表讀取完成，共 ${processed.length} 筆有效資料`);
      return processed;
    } catch (error) {
      console.error('讀取大學權值表失敗:', error);
      return [];
    }
  }

  /**
   * 獲取大學座標表
   * @returns {Array} 大學座標資料陣列
   */
  getUniversityCoordinates() {
    this.log('開始讀取大學座標表');
    
    try {
      const data = this.readSheetData(this.config.graduateSheet, '大學座標[不輸出]');
      const records = this.convertToObjects(data);
      
      // 處理座標資料，確保經緯度是數字
      const processed = records.map(record => ({
        名稱: record['名稱'],
        E: parseFloat(record['E']) || null,
        N: parseFloat(record['N']) || null
      })).filter(record => record.名稱 && record.E && record.N); // 過濾掉無效資料
      
      this.log(`大學座標表讀取完成，共 ${processed.length} 筆有效資料`);
      return processed;
    } catch (error) {
      console.error('讀取大學座標表失敗:', error);
      return [];
    }
  }

  /**
   * 獲取大學列表（包含公私立資訊）
   * @returns {Array} 大學列表資料陣列
   */
  getUniversityList() {
    this.log('開始讀取大學列表');
    
    try {
      const data = this.readSheetData(this.config.graduateSheet, '大學列表[不輸出]');
      const records = this.convertToObjects(data);
      
      // 處理大學列表資料
      const processed = records.map(record => ({
        名稱: record['名稱'],
        公私立: record['公私立']
      })).filter(record => record.名稱 && record.公私立); // 過濾掉無效資料
      
      this.log(`大學列表讀取完成，共 ${processed.length} 筆有效資料`);
      return processed;
    } catch (error) {
      console.error('讀取大學列表失敗:', error);
      return [];
    }
  }

  /**
   * 獲取指定年度的學測成績
   * @param {number} year - 年度
   * @returns {Array} 學測成績陣列
   */
  getExamScores(year) {
    this.log(`獲取 ${year} 年度學測成績`);
    
    try {
      const data = this.readSheetData(this.config.gsatSheet, '歷年學測成績彙總表[不輸出]');
      const records = this.convertToObjects(data);
      
      if (!year) {
        this.log(`學測成績總計: ${records.length} 筆`);
        return records;
      }

      const yearStr = year.toString();
      const filtered = records.filter(record => 
        record['年度'] && record['年度'].toString() === yearStr
      );

      this.log(`${year} 年度學測成績: ${filtered.length} 筆`);
      return filtered;
    } catch (error) {
      console.error(`獲取 ${year} 年度學測成績失敗:`, error);
      return [];
    }
  }

  /**
   * 獲取指定年度的分科成績
   * @param {number} year - 年度
   * @returns {Array} 分科成績陣列
   */
  getSTScores(year) {
    this.log(`獲取 ${year} 年度分科成績`);
    
    try {
      const data = this.readSheetData(this.config.stScoreSheet, '歷年分科成績彙總表[不輸出]');
      const records = this.convertToObjects(data);
      
      if (!year) {
        this.log(`分科成績總計: ${records.length} 筆`);
        return records;
      }

      const yearStr = year.toString();
      const filtered = records.filter(record => 
        record['年度'] && record['年度'].toString() === yearStr
      );

      this.log(`${year} 年度分科成績: ${filtered.length} 筆`);
      return filtered;
    } catch (error) {
      console.error(`獲取 ${year} 年度分科成績失敗:`, error);
      return [];
    }
  }

  // ========== 過濾器建構 ==========

  /**
   * 建構學生資料的過濾器
   * @param {Array} studentData - 學生資料
   * @returns {Object} 過濾器物件
   */
  getStudentFilters(studentData = null) {
    const cacheKey = 'filters';
    let cachedFilters = getCachedData(cacheKey);
    
    if (cachedFilters && !studentData) {
      return cachedFilters;
    }

    if (!studentData) {
      // 如果沒有提供資料，嘗試從最新年度獲取
      const years = this.getStudentListYears();
      if (years.length > 0) {
        studentData = this.getStudentList(years[0]);
      } else {
        return {};
      }
    }

    const filters = this.buildStudentFilters(studentData);
    setCachedData(cacheKey, filters);
    return filters;
  }

  /**
   * 建構學生過濾器
   */
  buildStudentFilters(data) {
    if (!data || data.length === 0) {
      return {};
    }

    const filters = {};
    
    // 建構各種欄位的過濾選項
    const filterFields = [
      '性別', '入學身分', '學籍狀態', '就讀類別', '原就讀學校',
      '戶籍縣市', '通訊縣市', '父親教育程度', '母親教育程度',
      '家庭年收入', '特殊身分'
    ];

    filterFields.forEach(field => {
      const values = new Set();
      data.forEach(record => {
        const value = record[field];
        if (value && value !== '') {
          values.add(value);
        }
      });
      filters[field] = Array.from(values).sort();
    });

    return filters;
  }

  /**
   * 建構畢業生過濾器
   */
  buildGraduateFilters(data) {
    if (!data || data.length === 0) {
      return {};
    }

    const filters = {};
    
    const filterFields = [
      '性別', '學制', '升學狀況', '錄取學校', '錄取系所',
      '入學管道', '特殊身分'
    ];

    filterFields.forEach(field => {
      const values = new Set();
      data.forEach(record => {
        const value = record[field];
        if (value && value !== '') {
          values.add(value);
        }
      });
      filters[field] = Array.from(values).sort();
    });

    return filters;
  }

  // ========== 權限管理 ==========

  /**
   * 獲取使用者的頁籤權限
   * @param {string} userEmail - 使用者信箱
   * @returns {Array} 允許存取的功能清單
   */
  getUserTabPermissions(userEmail) {
    this.log(`檢查使用者權限: ${userEmail} (已停用權限檢查)`);
    
    // 不再做任何權限檢查，直接返回所有功能權限
    const allowedFunctions = ['新生查詢', '畢業生查詢', '學測成績', '分科成績', '跨功能查詢'];
    
    this.log(`使用者 ${userEmail} 允許存取: ${allowedFunctions.join(', ')}`);
    return allowedFunctions;
    
    /* 原始權限檢查代碼 - 已停用
    try {
      // 讀取授權工作表
      const authData = this.readSheetData(this.config.authSheet, '授權');
      if (authData.length === 0) {
        this.warn('找不到授權資料');
        return [];
      }

      const headers = authData[0];
      const emailIndex = headers.indexOf('Email');
      
      if (emailIndex === -1) {
        this.warn('授權工作表中找不到 Email 欄位');
        return [];
      }

      // 找到使用者記錄
      let userRecord = null;
      for (let i = 1; i < authData.length; i++) {
        if (authData[i][emailIndex] === userEmail) {
          userRecord = authData[i];
          break;
        }
      }

      if (!userRecord) {
        this.log(`使用者 ${userEmail} 未找到授權記錄`);
        return [];
      }

      // 讀取頁籤控制設定
      const tabControlData = this.readSheetData(this.config.tabcontrolSheet, '頁籤控制');
      if (tabControlData.length === 0) {
        this.warn('找不到頁籤控制資料');
        return [];
      }

      // 獲取使用者群組
      const groupIndex = headers.indexOf('群組');
      const userGroup = groupIndex !== -1 ? userRecord[groupIndex] : null;
      
      if (!userGroup) {
        this.log(`使用者 ${userEmail} 沒有設定群組`);
        return [];
      }

      // 檢查頁籤權限
      const tabHeaders = tabControlData[0];
      const groupColumnIndex = tabHeaders.indexOf(userGroup);
      const functionColumnIndex = tabHeaders.indexOf('功能');

      if (groupColumnIndex === -1 || functionColumnIndex === -1) {
        this.warn(`群組 ${userGroup} 或功能欄位不存在`);
        return [];
      }

      const allowedFunctions = [];
      for (let i = 1; i < tabControlData.length; i++) {
        const row = tabControlData[i];
        if (row[groupColumnIndex] === 'v' || row[groupColumnIndex] === 'V') {
          allowedFunctions.push(row[functionColumnIndex]);
        }
      }

      this.log(`使用者 ${userEmail} (群組: ${userGroup}) 允許存取: ${allowedFunctions.join(', ')}`);
      return allowedFunctions;
      
    } catch (error) {
      console.error(`檢查使用者權限失敗 (${userEmail}):`, error);
      return [];
    }
    */
  }

  // ========== 身分證號對應查詢 ==========

  /**
   * 獲取完整的身分證准考證對應表
   * @returns {Array} 身分證對應資料陣列
   */
  getIdNumberMapping() {
    this.log('開始讀取身分證准考證對應表');
    
    try {
      // 從 gsatSheet 讀取身分證准考證對應表
      const data = this.readSheetData(this.config.gsatSheet, '身分證准考證對應表[不輸出]');
      const records = this.convertToObjects(data);
      
      // 處理資料，確保關鍵欄位存在
      const processed = records.filter(record => 
        record['報名序號'] && 
        record['考試年份'] && 
        record['身分證字號']
      );
      
      this.log(`身分證准考證對應表讀取完成，共 ${processed.length} 筆有效資料`);
      return processed;
    } catch (error) {
      console.error('讀取身分證准考證對應表失敗:', error);
      return [];
    }
  }

  /**
   * 搜尋身分證號對應
   * @param {string} query - 搜尋關鍵字
   * @returns {Array} 搜尋結果
   */
  searchIdMapping(query) {
    if (!query || query.trim() === '') {
      return [];
    }

    const cacheKey = 'idNumberMapping';
    let cachedData = getCachedData(cacheKey);
    
    if (!cachedData) {
      try {
        // 從 gsatSheet 讀取身分證准考證對應表
        const data = this.readSheetData(this.config.gsatSheet, '身分證准考證對應表[不輸出]');
        cachedData = this.convertToObjects(data);
        setCachedData(cacheKey, cachedData);
      } catch (error) {
        console.error('讀取身分證對應表失敗:', error);
        return [];
      }
    }

    const queryLower = query.toLowerCase().trim();
    
    const results = cachedData.filter(record => {
      return Object.values(record).some(value => {
        if (value && typeof value === 'string') {
          return value.toLowerCase().includes(queryLower);
        }
        return false;
      });
    });

    this.log(`身分證號搜尋 "${query}": ${results.length} 筆結果`);
    return results;
  }

  // ========== 跨功能資料查詢 ==========

  /**
   * 獲取跨功能資料 (學測、分科、畢業生等)
   * @param {Array} selectedStudentData - 已選擇的學生資料
   * @returns {Object} 跨功能資料物件
   */
  getCrossFunctionalData(selectedStudentData) {
    if (!selectedStudentData || selectedStudentData.length === 0) {
      return { success: false, error: '沒有選擇的學生資料' };
    }

    try {
      const result = {
        success: true,
        students: selectedStudentData,
        examScores: [],
        stScores: [],
        graduates: []
      };

      // 提取身分證號
      const idNumbers = selectedStudentData
        .map(student => student['身分證字號'])
        .filter(id => id);

      if (idNumbers.length === 0) {
        this.warn('所選學生資料中沒有身分證字號');
        return result;
      }

      // 獲取學測成績
      try {
        const examData = this.readSheetData(this.config.examScoreSheet, '學測成績');
        const examRecords = this.convertToObjects(examData);
        result.examScores = examRecords.filter(record => 
          record['身分證字號'] && idNumbers.includes(record['身分證字號'])
        );
      } catch (error) {
        this.warn('獲取學測成績失敗:', error);
      }

      // 獲取分科成績
      try {
        const stData = this.readSheetData(this.config.stScoreSheet, '歷年分科成績匯總表[不輸出]');
        const stRecords = this.convertToObjects(stData);
        result.stScores = stRecords.filter(record => 
          record['身分證字號'] && idNumbers.includes(record['身分證字號'])
        );
      } catch (error) {
        this.warn('獲取分科成績失敗:', error);
      }

      // 獲取畢業生資料
      try {
        const graduateData = this.readSheetData(this.config.graduateSheet, '榜單彙總表[不輸出]');
        const graduateRecords = this.convertToObjects(graduateData);
        result.graduates = graduateRecords.filter(record => 
          record['身分證字號'] && idNumbers.includes(record['身分證字號'])
        );
      } catch (error) {
        this.warn('獲取畢業生榜單失敗:', error);
      }

      this.log(`跨功能資料查詢完成: 學測 ${result.examScores.length}, 分科 ${result.stScores.length}, 畢業生 ${result.graduates.length}`);
      return result;

    } catch (error) {
      console.error('獲取跨功能資料失敗:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  // ========== 當前學生資料查詢（分片工作表） ==========

  /**
   * 獲取當前學生資料的可用年份（從工作表名稱解析）
   * 工作表格式："學生名單總表[114-1]"
   */
  /**
   * 民國年轉西元年和學期轉換輔助函數
   * @param {string} rocYear - 民國年 (3位數)
   * @param {string} semester - 學期 (1 或 2)
   * @returns {Object} 包含西元年和學期資訊
   */
  convertRocToGregorian(rocYear, semester) {
    const gregorianYear = parseInt(rocYear) + 1911;
    const semesterName = semester === '1' ? '第一學期' : '第二學期';
    
    return {
      gregorianYear,
      semester: parseInt(semester),
      semesterName,
      displayName: `${gregorianYear}${semesterName}`,
      originalFormat: `${rocYear}-${semester}`
    };
  }

  getCurrentStudentYears() {
    this.log('獲取當前學生資料年份');
    
    try {
      if (!this.config.currentStudentSheet) {
        this.warn('未設定 currentStudentSheet');
        return [];
      }

      const spreadsheet = SpreadsheetApp.openById(this.config.currentStudentSheet);
      const sheets = spreadsheet.getSheets();
      // 主要模式：學生名單總表[114-1]
      const yearSemesterPattern = /學生名單總表\[(\d{3})-(\d)\]/;
      // 備用模式：可能有空格或其他變化
      const alternativePatterns = [
        /學生名單總表\s*\[(\d{3})-(\d)\]/, // 有空格
        /學生名單總表［(\d{3})-(\d)］/, // 全角括號
      ];
      const yearSemesters = new Set();
      
      // 調試：顯示所有工作表名稱
      this.log('所有工作表名稱:');
      const allSheetNames = sheets.map(sheet => sheet.getName());
      this.log(allSheetNames);

      sheets.forEach(sheet => {
        const sheetName = sheet.getName();
        
        let match = sheetName.match(yearSemesterPattern);
        let matchedPattern = '主要模式';
        
        // 如果主要模式不符合，嘗試備用模式
        if (!match) {
          for (let i = 0; i < alternativePatterns.length; i++) {
            match = sheetName.match(alternativePatterns[i]);
            if (match) {
              matchedPattern = `備用模式${i + 1}`;
              break;
            }
          }
        }
        
        if (match) {
          const year = parseInt(match[1]);
          const semester = parseInt(match[2]);
          const yearSemester = `${year}-${semester}`;
          yearSemesters.add(yearSemester);
          this.log(`✅ 符合${matchedPattern}: ${sheetName} -> ${yearSemester}`);
        }
      });

      const sortedYearSemesters = Array.from(yearSemesters).sort((a, b) => {
        const [yearA, semA] = a.split('-').map(Number);
        const [yearB, semB] = b.split('-').map(Number);
        
        if (yearA !== yearB) {
          return yearB - yearA; // 年份降序
        }
        return semB - semA; // 學期降序
      });

      // 轉換為包含西元年資訊的物件陣列
      const convertedYearSemesters = sortedYearSemesters.map(yearSemester => {
        const [rocYear, semester] = yearSemester.split('-');
        const converted = this.convertRocToGregorian(rocYear, semester);
        return {
          ...converted,
          value: yearSemester, // 用於 API 呼叫的值
          label: converted.displayName // 顯示用的標籤
        };
      });

      this.log(`找到當前學生資料年度學期: ${sortedYearSemesters.join(', ')}`);
      this.log('轉換後的年度學期:', convertedYearSemesters.map(item => item.label).join(', '));
      return convertedYearSemesters;
    } catch (error) {
      console.error('獲取當前學生年份失敗:', error);
      return [];
    }
  }

  /**
   * 獲取指定年度學期的當前學生名單
   * @param {string} yearSemester - 年度學期，格式如 "114-1" 或 "latest" 表示最新
   * @returns {Object} 包含資料和按年級分類的結果
   */
  getCurrentStudentList(yearSemester = 'latest') {
    this.log(`獲取當前學生名單: ${yearSemester}`);
    
    try {
      if (!this.config.currentStudentSheet) {
        this.warn('未設定 currentStudentSheet');
        return { data: [], byYearSemester: {} };
      }

      // 如果是 latest，先獲取最新的年度學期
      if (yearSemester === 'latest') {
        const availableYears = this.getCurrentStudentYears();
        if (availableYears.length === 0) {
          this.warn('找不到任何當前學生資料');
          return { data: [], byYearSemester: {} };
        }
        // 取得最新年度學期的原始格式 (e.g., "114-1")
        yearSemester = availableYears[0].value;
        this.log(`使用最新年度學期: ${yearSemester} (${availableYears[0].label})`);
      }

      // 構建工作表名稱
      const sheetName = `學生名單總表[${yearSemester}]`;
      const data = this.readSheetData(this.config.currentStudentSheet, sheetName);
      
      if (data.length === 0) {
        this.warn(`工作表 ${sheetName} 無資料`);
        return { data: [], byYearSemester: {} };
      }

      const records = this.convertToObjects(data);
      
      // 解析年度學期資訊
      const [rocYear, semester] = yearSemester.split('-');
      const yearSemesterInfo = this.convertRocToGregorian(rocYear, semester);
      
      // 為每筆學生記錄添加資料年份和學期資訊
      records.forEach(record => {
        record['資料年份'] = yearSemesterInfo.gregorianYear; // ROC年 + 1911 轉換為西元年
        record['學期'] = yearSemesterInfo.semester; // 學期數字 (1 或 2)
      });
      
      // 按年級分類
      const byGrade = {};
      let gradeCount = {};
      let noGradeCount = 0;
      
      // 調試：檢查前3筆記錄的欄位
      if (records.length > 0) {
        this.log(`前3筆記錄的欄位:`);
        records.slice(0, 3).forEach((record, index) => {
          this.log(`第${index + 1}筆記錄欄位:`, Object.keys(record));
          this.log(`第${index + 1}筆記錄年班值:`, record['年班']);
        });
      }
      
      records.forEach(record => {
        // 從「年班」欄位提取年級（例如：101 -> 1, 201 -> 2, 301 -> 3）
        const yearClass = record['年班'];
        let grade = null;
        
        if (yearClass && yearClass.length >= 3) {
          // 取第一個字元作為年級
          grade = yearClass.charAt(0);
        }
        
        if (grade && ['1', '2', '3'].includes(grade)) {
          if (!byGrade[grade]) {
            byGrade[grade] = [];
            gradeCount[grade] = 0;
          }
          byGrade[grade].push(record);
          gradeCount[grade]++;
        } else {
          noGradeCount++;
        }
      });
      
      this.log(`年級統計:`, gradeCount);
      this.log(`無年級資料筆數:`, noGradeCount);

      this.log(`${yearSemester} 學期學生資料: ${records.length} 筆`);
      this.log(`年級分佈:`, Object.keys(byGrade).map(grade => `${grade}年級: ${byGrade[grade].length}人`).join(', '));
      
      return {
        data: records,
        byYearSemester: {
          [yearSemester]: byGrade
        }
      };
    } catch (error) {
      console.error(`獲取 ${yearSemester} 學期學生名單失敗:`, error);
      return { data: [], byYearSemester: {} };
    }
  }

  // ========== 五標資料查詢 ==========

  /**
   * 獲取學測五標資料
   * @returns {Array} 學測五標資料陣列
   */
  getGsatBenchmarks() {
    this.log('開始讀取學測全國五標資料');
    
    try {
      const data = this.readSheetData(this.config.gsatSheet, '學測全國五標[不輸出]');
      const records = this.convertToObjects(data);
      
      this.log(`學測全國五標資料讀取完成，共 ${records.length} 筆有效資料`);
      return records;
    } catch (error) {
      console.error('讀取學測全國五標資料失敗:', error);
      return [];
    }
  }

  /**
   * 獲取分科五標資料
   * @returns {Array} 分科五標資料陣列
   */
  getSTBenchmarks() {
    this.log('開始讀取分科全國五標資料');
    
    try {
      const data = this.readSheetData(this.config.stScoreSheet, '分科全國五標[不輸出]');
      const records = this.convertToObjects(data);
      
      this.log(`分科全國五標資料讀取完成，共 ${records.length} 筆有效資料`);
      return records;
    } catch (error) {
      console.error('讀取分科全國五標資料失敗:', error);
      return [];
    }
  }

  // ========== 工具方法 ==========

  /**
   * 測試所有工作表連線
   * @returns {Object} 測試結果
   */
  testConnections() {
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      details: {}
    };

    Object.keys(this.config).forEach(sheetKey => {
      const sheetId = this.config[sheetKey];
      if (!sheetId) {
        results.details[sheetKey] = { status: 'skipped', reason: '未配置' };
        return;
      }

      results.total++;
      
      try {
        const sheet = SpreadsheetApp.openById(sheetId);
        const name = sheet.getName();
        results.success++;
        results.details[sheetKey] = { status: 'success', name: name };
      } catch (error) {
        results.failed++;
        results.details[sheetKey] = { status: 'failed', error: error.toString() };
      }
    });

    this.log(`工作表連線測試完成: ${results.success}/${results.total} 成功`);
    return results;
  }

  // ========== 一次性載入所有年份資料的函數 ==========
  
  /**
   * 獲取所有年份的學測成績和五標資料
   * @returns {Object} 包含學測成績和五標資料的物件
   */
  getAllExamScores() {
    this.log('獲取所有年份學測成績和五標資料');
    
    try {
      // 獲取所有學測成績
      const examScores = this.getExamScores(); // 不傳年份，取得所有資料
      
      // 獲取所有五標資料
      const benchmarksRaw = this.getGsatBenchmarks();
      
      // 處理五標資料
      const benchmarks = {};
      benchmarksRaw.forEach(benchmark => {
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
      
      this.log(`學測資料載入完成：成績 ${examScores.length} 筆，五標 ${Object.keys(benchmarks).length} 年份`);
      
      return {
        success: true,
        data: examScores,
        benchmarks: benchmarks,
        count: examScores.length
      };
    } catch (error) {
      console.error('獲取所有學測成績失敗:', error);
      return {
        success: false,
        error: error.toString(),
        data: [],
        benchmarks: {},
        count: 0
      };
    }
  }
  
  /**
   * 獲取所有年份的分科成績和五標資料
   * @returns {Object} 包含分科成績和五標資料的物件
   */
  getAllSTScores() {
    this.log('獲取所有年份分科成績和五標資料');
    
    try {
      // 獲取所有分科成績
      const stScores = this.getSTScores(); // 不傳年份，取得所有資料
      
      // 獲取所有五標資料
      const benchmarksRaw = this.getSTBenchmarks();
      
      // 處理五標資料
      const benchmarks = {};
      benchmarksRaw.forEach(benchmark => {
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
      
      this.log(`分科資料載入完成：成績 ${stScores.length} 筆，五標 ${Object.keys(benchmarks).length} 年份`);
      
      return {
        success: true,
        data: stScores,
        benchmarks: benchmarks,
        count: stScores.length
      };
    } catch (error) {
      console.error('獲取所有分科成績失敗:', error);
      return {
        success: false,
        error: error.toString(),
        data: [],
        benchmarks: {},
        count: 0
      };
    }
  }
}

// 建立全域實例
var dbOps = new GoogleSheetsOperations();

// 向後相容的函數介面
function getDbOps() {
  return dbOps;
}

// 快速測試函數
function testDatabaseConnections() {
  return dbOps.testConnections();
}

// 清除快取函數
function clearDatabaseCache() {
  clearCache();
  if (dbOps && dbOps.log) {
    dbOps.log('數據庫快取已清除');
  }
}