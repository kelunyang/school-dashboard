# 學校儀表板系統 (School Dashboard System)

一個基於 Vue 3 + Google Apps Script 的學校學生資訊統計系統，提供新生入學、畢業流向、學測成績、分科成績等多維度數據分析與視覺化功能。

## 📋 功能特色

### 核心功能
- 🎓 **歷年新生統計** - 錄取管道分布、會考成績分析、性別統計
- 🎯 **畢業生流向統計** - 升學路徑分析、學校分布、公私立統計
- 📊 **學測分數統計** - 各科成績分析、級分分布統計
- 📈 **分科成績統計** - 分科測驗成績分析與比較
- 🔍 **跨功能查詢** - 追蹤學生完整學習歷程

### 技術特色
- ⚡ **高性能表格** - 基於 TanStack Table 的進階表格功能
- 📊 **互動式圖表** - D3.js 驅動的資料視覺化
- 📱 **響應式設計** - 支援各種裝置螢幕
- 🎨 **現代化 UI** - Element Plus 組件庫
- 💾 **本地化儲存** - 用戶偏好設定持久化
- 📥 **資料匯出** - 支援名單下載與圖表 SVG 匯出

## 🚀 快速開始

### 前置需求
- Node.js (v16 或更高版本)
- npm 或 yarn
- Google Apps Script 帳號
- Google Clasp CLI 工具

### 本地開發環境設置

1. **克隆專案**
```bash
git clone <repository-url>
cd school-dashboard
```

2. **安裝依賴**
```bash
npm install
```

3. **配置環境變數**

複製環境變數範例檔案：
```bash
cp .env.example .env.development
cp .env.example .env.production
```

編輯 `.env.development` 和 `.env.production`：
```env
# GAS API Execute Mode 配置
VITE_GAS_SCRIPT_ID=你的_GAS_SCRIPT_ID

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=你的_GOOGLE_CLIENT_ID

# 部署環境設定
NODE_ENV=development  # 或 production
```

4. **安裝 Google Clasp CLI**
```bash
npm install -g @google/clasp
```

5. **登入 Google Apps Script**
```bash
clasp login
```

6. **啟動開發服務器**
```bash
npm run dev
```

開發服務器將在 `http://localhost:3000` 啟動。

## ⚙️ 配置說明

### 環境變數配置 (.env)

| 變數名稱 | 說明 | 必要性 | 範例值 |
|---------|------|--------|--------|
| `VITE_GAS_SCRIPT_ID` | Google Apps Script 部署 ID | 必要 | `AKfycbyrL...` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | 必要 | `146068362249-...` |
| `NODE_ENV` | 運行環境 | 可選 | `development` / `production` |

**取得方法：**
- **GAS Script ID**：部署 Web 應用程式後，從部署 URL 中取得
- **Google Client ID**：從 Google Cloud Console OAuth 2.0 設定中取得

### Google Apps Script PropertiesService 配置

在 GAS 專案中設置以下屬性（專案設定 → 腳本資訊 → 指令碼屬性）：

#### 認證與系統設定

| 屬性名稱 | 說明 | 範例值 | 必要性 |
|---------|------|--------|--------|
| `passKey` | 系統通行金鑰 | `your_secret_key` | 必要 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `146068362249-...` | 必要 |
| `activeTime` | 快取存活時間（分鐘） | `30` | 可選 |
| `manualDebug` | 除錯模式開關 | `false` | 可選 |

#### Firebase/Firestore 設定 (如使用)

| 屬性名稱 | 說明 | 範例值 | 必要性 |
|---------|------|--------|--------|
| `firebaseDB` | Firebase Database URL | `https://project.firebaseio.com/` | 可選 |
| `firebaseID` | Firebase Project ID | `schooldashboard-467219` | 可選 |
| `firestoreKey` | Firestore API Key | `AIzaSyC...` | 可選 |

#### Google Sheets 資料源設定

| 屬性名稱 | 說明 | 必要性 |
|---------|------|--------|
| `newbieSheet` | 新生資料表 ID | 必要 |
| `graduateSheet` | 畢業生流向表 ID | 必要 |
| `gsatSheet` | 學測成績表 ID | 必要 |
| `stSheet` | 分科成績表 ID | 必要 |
| `authSheet` | 權限管理表 ID | 必要 |
| `currentstudentSheet` | 在校學生表 ID | 必要 |
| `geoInfoSheet` | 地理資訊表 ID | 可選 |
| `downloadLogsSheet` | 下載記錄表 ID | 可選 |
| `universityListSheet` | 大學清單表 ID | 可選 |
| `universityRankingSheet` | 大學排名表 ID | 可選 |
| `gsatBenchmarksSheet` | 學測基準表 ID | 可選 |
| `stBenchmarksSheet` | 分科基準表 ID | 可選 |
| `idNumberMappingSheet` | 身分證對應表 ID | 可選 |
| `tabcontrolSheet` | 頁籤控制表 ID | 可選 |
| `schemaSheet` | 資料結構表 ID | 可選 |
| `translateSheet` | 翻譯對照表 ID | 可選 |

**設定方式：**
1. 複製 `properitiesService.json.example` 為 `properitiesService.json`
2. 填入實際值
3. 在 GAS 專案的「專案設定」中手動輸入各項屬性

## 🛠 部署指南

### Google Apps Script 部署

#### 1. 準備 GAS 專案

1. **創建新的 GAS 專案**：
```bash
npm run setup:gas
```
或手動在 [Google Apps Script](https://script.google.com) 創建新專案。

2. **設置 Clasp 配置**：
在專案根目錄創建 `.clasp.json`：
```json
{
  "scriptId": "你的GAS專案ID",
  "rootDir": "./gas-deploy"
}
```

#### 2. 建置並部署

```bash
# 建置 GAS 版本
npm run build:gas

# 準備部署檔案
npm run prepare:gas

# 部署到 GAS
npm run deploy:gas

# 或一次完成
npm run deploy:gas
```

#### 3. 發布為 Web 應用程式

1. 在 GAS 編輯器中點擊「部署」→「新增部署」
2. 選擇類型：「網頁應用程式」
3. 設定：
   - **說明**：學校儀表板系統 v1.0
   - **執行身分**：我
   - **具有存取權的使用者**：僅限組織內的使用者
4. 點擊「部署」並複製 Web 應用程式 URL
5. 將 URL 中的 Script ID 填入環境變數 `VITE_GAS_SCRIPT_ID`

### 資料表結構要求

#### 新生資料表 (newbieSheet)
| 欄位名稱 | 資料類型 | 說明 |
|---------|---------|------|
| 身分證字號 | 文字 | 學生唯一識別碼 |
| 姓名 | 文字 | 學生姓名 |
| 性別 | 文字 | 男/女 |
| 班級 | 文字 | 就讀班級 |
| 座號 | 數字 | 班級座號 |
| 學號 | 文字 | 學校學號 |
| 會考總積分 | 數字 | 會考成績 |
| 錄取管道 | 文字 | 入學管道 |
| 畢業國中名稱 | 文字 | 畢業學校 |
| 學生身分別 | 文字 | 學生身分類別 |
| 入學年分 | 數字 | 入學年度 |

#### 畢業生流向表 (graduateSheet)
| 欄位名稱 | 資料類型 | 說明 |
|---------|---------|------|
| 學測報名序號 | 文字 | 學測報名號碼 |
| 姓名 | 文字 | 學生姓名 |
| 班級 | 文字 | 就讀班級 |
| 座號 | 數字 | 班級座號 |
| 入學管道 | 文字 | 升學管道 |
| 錄取學校 | 文字 | 錄取大學 |
| 公私立 | 文字 | 公立/私立 |
| 錄取系所 | 文字 | 錄取科系 |
| 榜單年分 | 數字 | 錄取年度 |
| 經度 | 數字 | 學校地理座標 |
| 緯度 | 數字 | 學校地理座標 |

#### 學測成績表 (gsatSheet)
| 欄位名稱 | 資料類型 | 說明 |
|---------|---------|------|
| 報名序號 | 文字 | 學測報名號碼 |
| 姓名 | 文字 | 學生姓名 |
| 應試號碼 | 文字 | 考試座號 |
| 國文 | 數字 | 國文級分 (1-15) |
| 英文 | 數字 | 英文級分 (1-15) |
| 數學A | 數字 | 數學A級分 (1-15) |
| 數學B | 數字 | 數學B級分 (1-15) |
| 社會 | 數字 | 社會級分 (1-15) |
| 自然 | 數字 | 自然級分 (1-15) |
| 考試年分 | 數字 | 考試年度 |

#### 分科成績表 (stSheet)
| 欄位名稱 | 資料類型 | 說明 |
|---------|---------|------|
| 報名序號 | 文字 | 分科報名號碼 |
| 姓名 | 文字 | 學生姓名 |
| 應試號碼 | 文字 | 考試座號 |
| 數學甲 | 數字 | 數學甲分數 (0-60) |
| 化學 | 數字 | 化學分數 (0-60) |
| 物理 | 數字 | 物理分數 (0-60) |
| 生物 | 數字 | 生物分數 (0-60) |
| 歷史 | 數字 | 歷史分數 (0-60) |
| 地理 | 數字 | 地理分數 (0-60) |
| 公民與社會 | 數字 | 公民分數 (0-60) |
| 考試年分 | 數字 | 考試年度 |

## 🔧 開發工具

### 可用的 npm 腳本

```bash
# 開發
npm run dev          # 啟動開發服務器
npm run build        # 建置一般版本  
npm run build:gas    # 建置 GAS 版本
npm run preview      # 預覽建置結果

# 部署
npm run prepare:gas  # 準備 GAS 部署檔案
npm run deploy:gas   # 完整部署到 GAS
npm run setup:gas    # 創建新的 GAS 專案

# GAS 管理
npm run watch:gas    # 監控並自動推送變更
npm run logs:gas     # 查看 GAS 執行日誌
npm run open:gas     # 開啟 GAS Web 應用程式
```

### 專案結構

```
school-dashboard/
├── src/
│   ├── components/          # Vue 組件
│   │   ├── *Chart.vue      # 圖表組件
│   │   ├── *List*.vue      # 表格組件
│   │   └── *Dashboard.vue  # 儀表板組件
│   ├── composables/        # Vue 組合式函數
│   ├── services/           # API 服務
│   ├── styles/            # 樣式檔案
│   └── utils/             # 工具函數
├── scripts/               # 後端腳本（GAS 使用）
│   ├── Backend.js         # 主要後端邏輯
│   ├── AuthManager.js     # 認證管理
│   ├── GoogleSheetsOperations.js  # Sheets 操作
│   └── WebApp.js          # Web 應用程式入口
├── gas-deploy/            # GAS 部署檔案
├── .env.example           # 環境變數範例
├── properitiesService.json.example  # GAS 屬性範例
└── dist/                  # 建置輸出
```

## 🔒 安全性注意事項

1. **環境變數**：請勿將 `.env.production` 提交至版本控制
2. **GAS 屬性**：敏感資訊僅存放在 GAS PropertiesService 中
3. **API 金鑰**：定期更新 Google API 金鑰
4. **存取權限**：確保 Google Sheets 僅授權給必要人員

## 🐛 疑難排解

### 常見問題

**Q: 部署後無法存取資料？**  
A: 檢查 PropertiesService 設定是否正確，確認試算表 ID 和權限設定。

**Q: 環境變數無法載入？**  
A: 確認 `.env` 檔案格式正確，變數名稱以 `VITE_` 開頭。

**Q: GAS 部署失敗？**  
A: 檢查 `.clasp.json` 設定，確認已登入 `clasp login`。

**Q: 圖表無法顯示？**  
A: 確認資料格式是否符合要求，檢查瀏覽器控制台是否有錯誤訊息。

**Q: 跨功能查詢無結果？**  
A: 檢查不同資料表中的學生 ID 格式是否一致。

### 除錯模式

在 PropertiesService 中設定 `manualDebug = true` 啟用除錯模式：
- 詳細的錯誤訊息
- API 調用日誌  
- 效能監控資訊
- 顯示完整學生資訊（僅限開發環境）

## 📄 授權條款

本專案採用 MIT 授權條款。

---

✨ **開發完成！**

如有任何問題或建議，歡迎開啟 Issue 或聯繫開發團隊。