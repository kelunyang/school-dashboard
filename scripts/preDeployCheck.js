#!/usr/bin/env node

// Firebase 部署前環境檢查腳本
import fs from 'fs'
import path from 'path'

const ENV_FILE = '.env.production'

console.log('🔍 檢查 Firebase 部署環境設定...\n')

// 檢查 .env.production 檔案是否存在
if (!fs.existsSync(ENV_FILE)) {
  console.error(`❌ 找不到 ${ENV_FILE} 檔案`)
  console.log(`請創建 ${ENV_FILE} 並設定以下變數：`)
  console.log('VITE_GAS_SCRIPT_ID=your_gas_script_id')
  console.log('VITE_GOOGLE_CLIENT_ID=your_google_client_id')
  process.exit(1)
}

// 讀取環境變數檔案
const envContent = fs.readFileSync(ENV_FILE, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, value] = line.split('=')
    if (key && value) {
      envVars[key.trim()] = value.trim()
    }
  }
})

// 檢查必要的環境變數
const requiredVars = ['VITE_GAS_SCRIPT_ID', 'VITE_GOOGLE_CLIENT_ID']
let missingVars = []

requiredVars.forEach(varName => {
  if (!envVars[varName] || envVars[varName] === 'YOUR_GAS_SCRIPT_ID' || envVars[varName] === 'YOUR_GOOGLE_CLIENT_ID') {
    missingVars.push(varName)
  }
})

if (missingVars.length > 0) {
  console.error('❌ 以下環境變數未正確設定：')
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`)
  })
  console.log('\n請在 .env.production 中設定正確的值')
  process.exit(1)
}

// 檢查 Firebase 配置
const firebaseRcPath = 'firebase-deploy/.firebaserc'
if (!fs.existsSync(firebaseRcPath)) {
  console.error(`❌ 找不到 ${firebaseRcPath}`)
  console.log('請先執行 firebase init hosting 來設定專案')
  process.exit(1)
}

const firebaseRcContent = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf-8'))
if (firebaseRcContent.projects?.default === 'your-firebase-project-id') {
  console.error('❌ Firebase 專案 ID 未設定')
  console.log('請在 firebase-deploy/.firebaserc 中設定正確的專案 ID')
  process.exit(1)
}

console.log('✅ 環境設定檢查通過！')
console.log(`📋 GAS Script ID: ${envVars.VITE_GAS_SCRIPT_ID}`)
console.log(`📋 Firebase 專案: ${firebaseRcContent.projects.default}`)
console.log('\n🚀 準備開始部署...\n')