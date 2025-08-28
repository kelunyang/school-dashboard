// 這個文件是為了支援 Firebase 部署而創建的
// 包含前端需要的 GAS API 代理函數

/**
 * GAS API 代理函數 - 將 google.script.run 調用轉換為 fetch 調用
 */

// 在 Vue 應用中使用的 API 調用函數
function createGASAPI(baseUrl) {
  return {
    // 通用 API 調用函數
    async call(functionName, params = {}) {
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            function: functionName,
            parameters: params
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // 如果 GAS 返回錯誤對象
        if (result.error) {
          throw new Error(result.error);
        }
        
        return result;
      } catch (error) {
        console.error(`GAS API call failed for ${functionName}:`, error);
        throw error;
      }
    },
    
    // 具體的 API 函數（對應 GAS 後端）
    async checkUserAuthorization(userEmail) {
      return this.call('checkUserAuthorization', { userEmail });
    },
    
    async getGoogleClientId() {
      return this.call('getGoogleClientId');
    },
    
    async getStudentList(year) {
      return this.call('getStudentList', { year });
    },
    
    async getGraduateList(year) {
      return this.call('getGraduateList', { year });
    },
    
    async getExamScores(year) {
      return this.call('getExamScores', { year });
    },
    
    async getSTScores(year) {
      return this.call('getSTScores', { year });
    },
    
    async getUserTabPermissions(userEmail) {
      return this.call('getUserTabPermissions', { userEmail });
    },
    
    async getAvailableYears() {
      return this.call('getAvailableYears');
    },
    
    async getGraduateYears() {
      return this.call('getGraduateYears');
    },
    
    async getExamScoreYears() {
      return this.call('getExamScoreYears');
    },
    
    async getSTScoreYears() {
      return this.call('getSTScoreYears');
    },
    
    async generateFilteredReport(filters) {
      return this.call('generateFilteredReport', { filters });
    },
    
    async generateGraduateReport(filters) {
      return this.call('generateGraduateReport', { filters });
    },
    
    async generateExamScoreReport(filters) {
      return this.call('generateExamScoreReport', { filters });
    },
    
    async generateSTScoreReport(filters) {
      return this.call('generateSTScoreReport', { filters });
    },
    
    async getCrossFunctionalData(selectedStudentData) {
      return this.call('getCrossFunctionalData', { selectedStudentData });
    },
    
    async getCrossFunctionalStudentList(selectedStudentData) {
      return this.call('getCrossFunctionalStudentList', { selectedStudentData });
    },
    
    async getCrossFunctionalGraduateList(selectedStudentData) {
      return this.call('getCrossFunctionalGraduateList', { selectedStudentData });
    },
    
    async getCrossFunctionalExamScores(selectedStudentData) {
      return this.call('getCrossFunctionalExamScores', { selectedStudentData });
    },
    
    async getCrossFunctionalSTScores(selectedStudentData) {
      return this.call('getCrossFunctionalSTScores', { selectedStudentData });
    },
    
    async searchIdMapping(query) {
      return this.call('searchIdMapping', { query });
    },
    
    async getSystemConfig() {
      return this.call('getSystemConfig');
    }
  };
}

// 導出給 Vue 應用使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGASAPI };
} else {
  window.createGASAPI = createGASAPI;
}