import { ElMessage } from 'element-plus'

export function useChartDownload() {
  const downloadSVG = (svgElement, fileName = 'chart') => {
    try {
      // 獲取 SVG 元素
      if (!svgElement) {
        ElMessage.error('找不到圖表元素')
        return
      }

      // 克隆 SVG 元素以避免修改原始圖表
      const svgClone = svgElement.cloneNode(true)
      
      // 添加 xmlns 屬性
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      
      // 獲取所有樣式
      const styleElement = document.createElement('style')
      const styles = getComputedStyles(svgElement)
      styleElement.textContent = styles
      svgClone.insertBefore(styleElement, svgClone.firstChild)
      
      // 序列化 SVG
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgClone)
      
      // 創建 Blob
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      
      // 創建下載連結
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.svg`
      
      // 觸發下載
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 清理
      URL.revokeObjectURL(url)
      
      ElMessage.success('圖表下載成功')
    } catch (error) {
      console.error('下載圖表失敗:', error)
      ElMessage.error('下載圖表失敗')
    }
  }
  
  // 獲取元素的計算樣式
  const getComputedStyles = (element) => {
    let styles = ''
    const sheets = document.styleSheets
    
    try {
      for (let sheet of sheets) {
        try {
          const rules = sheet.cssRules || sheet.rules
          for (let rule of rules) {
            if (rule.cssText) {
              styles += rule.cssText + '\n'
            }
          }
        } catch (e) {
          // 跨域樣式表可能會拋出錯誤
          console.warn('無法訪問樣式表:', e)
        }
      }
    } catch (e) {
      console.warn('獲取樣式失敗:', e)
    }
    
    // 添加一些基本的 D3 樣式
    styles += `
      .axis { font: 10px sans-serif; }
      .axis path, .axis line { fill: none; stroke: #000; shape-rendering: crispEdges; }
      .bar { fill: steelblue; }
      .bar:hover { fill: orange; }
      .line { fill: none; stroke: steelblue; stroke-width: 2px; }
      .area { fill: steelblue; opacity: 0.6; }
      .pie-slice { stroke: white; stroke-width: 2px; }
      .legend { font: 12px sans-serif; }
    `
    
    return styles
  }
  
  return {
    downloadSVG
  }
}