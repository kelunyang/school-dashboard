// 翻譯服務 - 處理英文欄位名稱與中文顯示名稱的對應
// 從 translateSheet 載入翻譯對應表並提供翻譯功能

import { apiService } from './apiService'

class TranslationService {
  constructor() {
    this.translations = new Map() // 英文欄位名 -> 中文顯示名
    this.reverseTranslations = new Map() // 中文顯示名 -> 英文欄位名
    this.isLoaded = false
    this.loadPromise = null
  }

  /**
   * 載入翻譯對應表
   */
  async loadTranslations() {
    if (this.isLoaded) {
      return
    }

    if (this.loadPromise) {
      return this.loadPromise
    }

    this.loadPromise = this._loadTranslationsFromAPI()
    
    try {
      await this.loadPromise
      this.isLoaded = true
    } catch (error) {
      console.error('載入翻譯對應表失敗:', error)
      this._initializeDefaultTranslations()
      this.isLoaded = true
    } finally {
      this.loadPromise = null
    }
  }

  /**
   * 從 API 載入翻譯對應表
   */
  async _loadTranslationsFromAPI() {
    try {
      // 調用後端 API 獲取翻譯對應表
      const result = await apiService.executeGASFunction('getFieldTranslationMappings')
      
      if (result.success && result.translations) {
        console.log('成功載入翻譯對應表:', Object.keys(result.translations).length, '項')
        
        // 建立英文 -> 中文的映射
        for (const [chinese, english] of Object.entries(result.translations)) {
          this.translations.set(english, chinese)
          this.reverseTranslations.set(chinese, english)
        }
      } else {
        throw new Error('API 未返回有效的翻譯資料')
      }
    } catch (error) {
      console.error('從 API 載入翻譯對應表失敗:', error)
      throw error
    }
  }

  /**
   * 初始化預設翻譯對應（當 API 載入失敗時使用）
   */
  _initializeDefaultTranslations() {
    console.log('使用預設翻譯對應表')
    
    const defaultTranslations = {
      // currentStudents - 學生名單總表
      'studentId': '學號',
      'classCode': '年班(3碼:701)',
      'seatNumber': '座號(2碼:01)',
      'name': '姓名',
      'gender': '性別(男、女)',
      'nationalId': '身分證字號',
      'seatNumberChange': '座號變更',
      'readmission': '復學／重讀',
      'specialEducation': '特教生',
      'indigenous': '原住民',
      'lowIncome': '中低收',
      'homeschool': '自學',
      'photoUrl': '照片連結',
      'birthDate': '出生年月日(民國年月日：960109)',
      'registeredAddress': '戶籍地址',
      'contactAddress': '聯絡地址',
      'parentName': '家長姓名',
      'parentPhone': '家長電話',
      'studentPhone': '學生行動電話',
      
      // graduates - 榜單彙總表
      'satRegistrationNumber': '學測報名序號',
      'class': '班級',
      'admissionChannel': '入學管道',
      'admissionSchool': '錄取學校',
      'schoolType': '公／私立',
      'graduateYear': '榜單年分',
      'admissionDepartment': '錄取系所',
      
      // examScores - 歷年學測成績彙總表
      'registrationNumber': '報名序號',
      'examNumber': '應試號碼',
      'chineseScore': '國文級分',
      'englishScore': '英文級分',
      'mathAScore': '數學A級分',
      'mathBScore': '數學B級分',
      'socialStudiesScore': '社會級分',
      'scienceScore': '自然級分',
      'maskedName': '遮罩姓名',
      'examYear': '考試年分',
      'chineseBenchmarks': '國文五標',
      'englishBenchmarks': '英文五標',
      'mathABenchmarks': '數學A五標',
      'mathBBenchmarks': '數學B五標',
      'socialStudiesBenchmarks': '社會五標',
      'scienceBenchmarks': '自然五標',
      'publicYear': '文檔年份',
      
      // universityList - 大學列表
      'publicPrivate': '公私立',
      
      // universityRanking - 大學權值表
      'integerWeight': '整數權值',
      'decimalWeight': '小數權值',
      'fullWeight': '完整權值',
      
      // students - 新生名單彙總表
      'admissionNumber': '准考證號碼',
      'birthYear': '出生年',
      'birthMonth': '出生月',
      'birthDay': '出生日',
      'studentType': '學生身分別',
      'admissionType': '錄取身分別',
      'graduateSchoolCode': '畢業國中代碼',
      'graduateSchoolName': '畢業國中名稱',
      'graduateYear': '畢業年度',
      'phone': '電話',
      'mobile': '手機',
      'postalCode': '郵遞區號',
      'address': '地址',
      'notes': '備註(補考)',
      'totalScore': '總積分',
      'diversePerformanceScore': '多元學習表現積分',
      'capTotalScore': '會考總積分',
      'chineseLevel': '國文等級加標示',
      'mathLevel': '數學等級加標示',
      'englishLevel': '英語等級加標示',
      'socialStudiesLevel': '社會等級加標示',
      'scienceLevel': '自然等級加標示',
      'writingTestScore': '寫作測驗級分',
      'admissionYear': '入學年分',
      
      // schools - 國中地理資訊位置
      'schoolLevel': '學校級別',
      'code': '代碼',
      'schoolName': '學校名稱',
      'fullName': '長名稱',
      'city': '縣市別',
      'district': '鄉鎮市區',
      'website': '網址',
      
      // stScores - 分科成績
      'mathAScore': '數學甲級分',
      'chemistryScore': '化學級分',
      'physicsScore': '物理級分',
      'biologyScore': '生物級分',
      'historyScore': '歷史級分',
      'geographyScore': '地理級分',
      'civicsScore': '公民與社會級分',
      'chineseGsatScore': '國文學測級分(60級分制)',
      'englishGsatScore': '英文學測級分(60級分制)',
      'mathAGsatScore': '數學A學測級分(60級分制)',
      'mathBGsatScore': '數學B學測級分(60級分制)',
      'socialStudiesGsatScore': '社會學測級分(60級分制)',
      'scienceGsatScore': '自然學測級分(60級分制)',
      
      // idNumberMapping - 身分證准考證對應表
      'classInfo': '年班座號',
      
      // 五標資料 (gsatBenchmarks, stBenchmarks)
      'year': '年份',
      'subject': '科目',
      'top': '頂標',
      'front': '前標',
      'average': '均標',
      'back': '後標',
      'bottom': '底標',
      
      // 通用欄位
      'longitude': 'E',
      'latitude': 'N'
    }

    for (const [english, chinese] of Object.entries(defaultTranslations)) {
      this.translations.set(english, chinese)
      this.reverseTranslations.set(chinese, english)
    }
  }

  /**
   * 將英文欄位名稱翻譯為中文顯示名稱
   * @param {string} englishFieldName - 英文欄位名稱
   * @returns {string} 中文顯示名稱，如果找不到對應則返回原始名稱
   */
  translateToChineseSync(englishFieldName) {
    if (!englishFieldName) return ''
    return this.translations.get(englishFieldName) || englishFieldName
  }

  /**
   * 將英文欄位名稱翻譯為中文顯示名稱（異步版本，確保翻譯表已載入）
   * @param {string} englishFieldName - 英文欄位名稱
   * @returns {Promise<string>} 中文顯示名稱
   */
  async translateToChinese(englishFieldName) {
    await this.loadTranslations()
    return this.translateToChineseSync(englishFieldName)
  }

  /**
   * 將中文顯示名稱翻譯回英文欄位名稱
   * @param {string} chineseDisplayName - 中文顯示名稱
   * @returns {string} 英文欄位名稱，如果找不到對應則返回原始名稱
   */
  translateToEnglishSync(chineseDisplayName) {
    if (!chineseDisplayName) return ''
    return this.reverseTranslations.get(chineseDisplayName) || chineseDisplayName
  }

  /**
   * 將中文顯示名稱翻譯回英文欄位名稱（異步版本）
   * @param {string} chineseDisplayName - 中文顯示名稱
   * @returns {Promise<string>} 英文欄位名稱
   */
  async translateToEnglish(chineseDisplayName) {
    await this.loadTranslations()
    return this.translateToEnglishSync(chineseDisplayName)
  }

  /**
   * 批量翻譯英文欄位名稱為中文
   * @param {string[]} englishFieldNames - 英文欄位名稱陣列
   * @returns {Promise<Object>} 翻譯對應物件 {英文欄位名: 中文顯示名}
   */
  async translateFieldsToChinese(englishFieldNames) {
    await this.loadTranslations()
    
    const translations = {}
    for (const fieldName of englishFieldNames) {
      translations[fieldName] = this.translateToChineseSync(fieldName)
    }
    return translations
  }

  /**
   * 批量翻譯中文顯示名稱為英文
   * @param {string[]} chineseDisplayNames - 中文顯示名稱陣列
   * @returns {Promise<Object>} 翻譯對應物件 {中文顯示名: 英文欄位名}
   */
  async translateFieldsToEnglish(chineseDisplayNames) {
    await this.loadTranslations()
    
    const translations = {}
    for (const displayName of chineseDisplayNames) {
      translations[displayName] = this.translateToEnglishSync(displayName)
    }
    return translations
  }

  /**
   * 翻譯物件的所有鍵名（從英文到中文）
   * @param {Object} obj - 要翻譯鍵名的物件
   * @returns {Promise<Object>} 翻譯後的物件
   */
  async translateObjectKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj
    
    await this.loadTranslations()
    
    const translatedObj = {}
    for (const [key, value] of Object.entries(obj)) {
      const translatedKey = this.translateToChineseSync(key)
      translatedObj[translatedKey] = value
    }
    
    return translatedObj
  }

  /**
   * 翻譯陣列中物件的所有鍵名（從英文到中文）
   * @param {Object[]} arr - 要翻譯鍵名的物件陣列
   * @returns {Promise<Object[]>} 翻譯後的物件陣列
   */
  async translateArrayObjectKeys(arr) {
    if (!Array.isArray(arr)) return arr
    
    await this.loadTranslations()
    
    return arr.map(obj => {
      if (!obj || typeof obj !== 'object') return obj
      
      const translatedObj = {}
      for (const [key, value] of Object.entries(obj)) {
        const translatedKey = this.translateToChineseSync(key)
        translatedObj[translatedKey] = value
      }
      
      return translatedObj
    })
  }

  /**
   * 為表格元件生成欄位配置（TanStack Table 格式）
   * @param {Object[]} sampleData - 示例資料（用於獲取欄位列表）
   * @param {Object} options - 配置選項
   * @returns {Promise<Object[]>} 表格欄位配置陣列
   */
  async generateTableColumns(sampleData, options = {}) {
    if (!sampleData || !sampleData.length) return []
    
    await this.loadTranslations()
    
    const {
      excludeFields = ['uid', 'id'], // 要排除的欄位
      includeFields = null, // 只包含的欄位（如果指定）
      fieldWidths = {}, // 自訂欄位寬度
      sortableFields = [], // 可排序的欄位
      searchableFields = [] // 可搜尋的欄位
    } = options
    
    const sampleRecord = sampleData[0]
    const columns = []
    
    for (const [englishField, value] of Object.entries(sampleRecord)) {
      // 檢查是否要排除此欄位
      if (excludeFields.includes(englishField)) continue
      
      // 如果指定了包含欄位，檢查是否在列表中
      if (includeFields && !includeFields.includes(englishField)) continue
      
      const chineseHeader = this.translateToChineseSync(englishField)
      const config = {
        accessorKey: englishField,
        id: englishField,
        header: chineseHeader,
        size: fieldWidths[englishField] || 120,
        enableSorting: sortableFields.includes(englishField),
        enableGlobalFilter: searchableFields.includes(englishField)
      }
      
      columns.push(config)
    }
    
    return columns
  }

  /**
   * 獲取所有可用的翻譯對應
   * @returns {Promise<Object>} 所有翻譯對應 {英文欄位名: 中文顯示名}
   */
  async getAllTranslations() {
    await this.loadTranslations()
    return Object.fromEntries(this.translations.entries())
  }

  /**
   * 檢查是否已載入翻譯對應表
   * @returns {boolean} 是否已載入
   */
  isTranslationLoaded() {
    return this.isLoaded
  }

  /**
   * 重新載入翻譯對應表（強制重新從 API 載入）
   */
  async reloadTranslations() {
    this.isLoaded = false
    this.translations.clear()
    this.reverseTranslations.clear()
    await this.loadTranslations()
  }
}

// 創建單例實例
export const translationService = new TranslationService()

// 提供便利的快速翻譯函數
export const t = (englishField) => translationService.translateToChineseSync(englishField)
export const tAsync = (englishField) => translationService.translateToChinese(englishField)