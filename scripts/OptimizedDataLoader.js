// 優化版資料載入器 - 一次性載入完整數據包
// 目標：將 Firestore 查詢從每日數千次降低到數十次

/**
 * 新架構：最少化 Firestore 查詢
 * 
 * 舊架構問題：
 * - 每個組件都查詢數據庫
 * - 年份變更觸發多次重複查詢  
 * - 圖表計算也查詢數據庫
 * - 估算每日查詢：1000+ 次
 * 
 * 新架構優勢：
 * - 只在必要時查詢數據庫
 * - 一次載入完整數據包
 * - 前端純計算，無需再查詢
 * - 估算每日查詢：< 50 次
 */

class OptimizedDataLoader {
  constructor() {
    this.cachedDataPackage = null;
    this.currentYear = null;
    this.availableYears = null;
  }

  /**
   * 步驟 1: 獲取所有可用年份
   * 只需要查詢一次，結果可快取很久（年份很少變動）
   */
  getAvailableYears() {
    if (this.availableYears) {
      console.log('使用快取的年份資料');
      return this.availableYears;
    }

    try {
      console.log('載入所有可用年份...');
      
      // 查詢所有集合的年份（同步操作）
      const studentYears = getDbOps().getStudentYears();
      const graduateYears = getDbOps().getGraduateYears();
      const examYears = getDbOps().getExamScoreYears();
      const stYears = getDbOps().getSTScoreYears();
      const currentStudentYears = getDbOps().getCurrentStudentYears();

      this.availableYears = {
        students: studentYears,
        graduates: graduateYears,
        examScores: examYears,
        stScores: stYears,
        currentStudents: currentStudentYears,
        // 取所有年份的聯集，按降序排列
        all: [...new Set([...studentYears, ...graduateYears, ...examYears, ...stYears, ...currentStudentYears])]
             .sort((a, b) => b - a)
      };

      console.log('可用年份載入完成:', this.availableYears);
      return this.availableYears;

    } catch (error) {
      console.error('載入年份失敗:', error);
      throw error;
    }
  }

  /**
   * 步驟 2: 按需載入數據包
   * 根據功能類型載入對應的數據
   */
  loadCompleteDataPackage(year = 'latest', dashboardType = null) {
    try {
      console.log(`載入 ${year} 年度數據包，功能類型: ${dashboardType}`);
      const startTime = Date.now();

      // 初始化基本數據包結構
      if (!this.cachedDataPackage || this.currentYear !== year) {
        this.cachedDataPackage = {
          year: year,
          loadTime: new Date().toISOString(),
          metadata: {
            totalRecords: 0,
            loadDuration: 0,
            queries: 0
          }
        };
        this.currentYear = year;
      }

      let queries = 0;
      let newRecords = 0;

      // 根據 dashboard 類型按需載入數據
      switch (dashboardType) {
        case 'newbie':
          if (!this.cachedDataPackage.students) {
            console.log('載入新生數據...');
            const studentsResult = this.loadStudentData(year);
            this.cachedDataPackage.students = {
              data: studentsResult.data || [],
              filters: studentsResult.filters || {},
              count: studentsResult.data?.length || 0
            };
            newRecords += studentsResult.data?.length || 0;
            queries += 1;
          }
          break;

        case 'graduate':
          if (!this.cachedDataPackage.graduates) {
            console.log('載入畢業生數據...');
            const graduatesResult = this.loadGraduateData(year);
            this.cachedDataPackage.graduates = {
              data: graduatesResult.data || [],
              filters: graduatesResult.filters || {},
              count: graduatesResult.data?.length || 0
            };
            newRecords += graduatesResult.data?.length || 0;
            queries += 1;
          }
          break;

        case 'examScore':
          if (!this.cachedDataPackage.examScores || !this.cachedDataPackage.idMapping) {
            console.log('載入所有年份的學測數據和 ID 映射...');
            
            let examScoresResult = null;
            let benchmarksResult = null;
            let idMappingResult = null;
            
            if (!this.cachedDataPackage.examScores) {
              examScoresResult = this.loadAllExamScoreData(); // 載入所有年份
              benchmarksResult = this.loadAllBenchmarks(); // 載入所有年份的五標
            }
            
            if (!this.cachedDataPackage.idMapping) {
              idMappingResult = this.loadIdMapping();
            }
            
            if (examScoresResult) {
              this.cachedDataPackage.examScores = {
                data: examScoresResult.students || [],
                benchmarks: benchmarksResult?.gsat || {},
                count: examScoresResult.students?.length || 0,
                allYears: true // 標記為包含所有年份
              };
              newRecords += examScoresResult.students?.length || 0;
              queries += 2; // examScores + benchmarks
            }
            
            if (idMappingResult) {
              this.cachedDataPackage.idMapping = idMappingResult || [];
              queries += 1;
            }
          }
          break;

        case 'stScore':
          if (!this.cachedDataPackage.stScores || !this.cachedDataPackage.idMapping) {
            console.log('載入所有年份的分科數據和 ID 映射...');
            
            let stScoresResult = null;
            let benchmarksResult = null;
            let idMappingResult = null;
            
            if (!this.cachedDataPackage.stScores) {
              stScoresResult = this.loadAllSTScoreData(); // 載入所有年份
              benchmarksResult = this.loadAllBenchmarks(); // 載入所有年份的五標
            }
            
            if (!this.cachedDataPackage.idMapping) {
              idMappingResult = this.loadIdMapping();
            }
            
            if (stScoresResult) {
              this.cachedDataPackage.stScores = {
                data: stScoresResult.students || [],
                benchmarks: benchmarksResult?.st || {},
                count: stScoresResult.students?.length || 0,
                allYears: true // 標記為包含所有年份
              };
              newRecords += stScoresResult.students?.length || 0;
              queries += 2; // stScores + benchmarks
            }
            
            if (idMappingResult) {
              this.cachedDataPackage.idMapping = idMappingResult || [];
              queries += 1;
            }
          }
          break;

        case 'currentStudent':
          if (!this.cachedDataPackage.currentStudents) {
            console.log('載入當前學生數據...');
            const currentStudentsResult = this.loadCurrentStudentData(year);
            this.cachedDataPackage.currentStudents = {
              data: currentStudentsResult.data || [],
              byYearSemester: currentStudentsResult.byYearSemester || {},
              count: currentStudentsResult.data?.length || 0
            };
            newRecords += currentStudentsResult.data?.length || 0;
            queries += 1;
          }
          break;

        default:
          console.log('未知的 dashboard 類型:', dashboardType);
      }

      // 更新 metadata
      this.cachedDataPackage.metadata.totalRecords += newRecords;
      this.cachedDataPackage.metadata.queries += queries;
      this.cachedDataPackage.metadata.loadDuration = Date.now() - startTime;

      const endTime = Date.now();
      
      console.log(`✅ ${dashboardType} 數據載入完成！`);
      console.log(`📊 新增記錄數: ${newRecords}`);
      console.log(`🔍 查詢次數: ${queries}`);
      console.log(`⏱️  載入時間: ${endTime - startTime}ms`);
      
      return this.cachedDataPackage;

    } catch (error) {
      console.error(`載入 ${dashboardType} 數據失敗:`, error);
      throw error;
    }
  }

  // 載入學生資料
  loadStudentData(year) {
    const students = getDbOps().getStudentList(year);
    const filters = getDbOps().getStudentFilters();
    return { data: students, filters };
  }

  // 載入學生名單總表資料
  loadCurrentStudentData(year) {
    try {
      const result = getDbOps().getCurrentStudentList(year);
      return result || { data: [], byYearSemester: {} };
    } catch (error) {
      console.error('載入學生名單總表失敗:', error);
      return { data: [], byYearSemester: {} };
    }
  }

  // 載入畢業生資料
  loadGraduateData(year) {
    const result = getDbOps().getGraduateListFromDB(year);
    return result;
  }

  // 載入單一年份學測成績（保留向後相容性）
  loadExamScoreData(year) {
    return getDbOps().getExamScoresFromDB(year);
  }

  // 載入所有年份學測成績
  loadAllExamScoreData() {
    return getDbOps().getAllExamScores();
  }

  // 載入單一年份分科成績（保留向後相容性）
  loadSTScoreData(year) {
    return getDbOps().getSTScoresFromDB(year);
  }

  // 載入所有年份分科成績  
  loadAllSTScoreData() {
    return getDbOps().getAllSTScores();
  }

  // 載入身分證對照表
  loadIdMapping() {
    return getDbOps().buildIdNumberMappingCache();
  }

  // 載入單一年份五標資料（保留向後相容性）
  loadBenchmarks(year) {
    const gsatBenchmarks = getDbOps().getGsatBenchmarks(year);
    const stBenchmarks = getDbOps().getSTBenchmarks(year);
    
    return {
      gsat: gsatBenchmarks,
      st: stBenchmarks
    };
  }

  // 載入所有年份五標資料
  loadAllBenchmarks() {
    const gsatBenchmarks = getDbOps().getGsatBenchmarks();
    const stBenchmarks = getDbOps().getSTBenchmarks();
    
    return {
      gsat: gsatBenchmarks,
      st: stBenchmarks
    };
  }

  /**
   * 獲取當前數據包
   */
  getCurrentDataPackage() {
    return this.cachedDataPackage;
  }

  /**
   * 清除快取（當需要重新載入時）
   */
  clearCache() {
    this.cachedDataPackage = null;
    this.currentYear = null;
    console.log('數據包快取已清除');
  }

  /**
   * 檢查是否需要重新載入
   */
  needsReload(requestedYear) {
    return !this.cachedDataPackage || this.currentYear !== requestedYear;
  }
}

// 建立全域實例
const dataLoader = new OptimizedDataLoader();

// 新的 API 介面，供前端使用
async function getOptimizedDataPackage(year = 'latest') {
  return dataLoader.loadCompleteDataPackage(year);
}

async function getAvailableYearsOptimized() {
  return dataLoader.getAvailableYears();
}

// 導出給其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OptimizedDataLoader,
    getOptimizedDataPackage,
    getAvailableYearsOptimized
  };
}