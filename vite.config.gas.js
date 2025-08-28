import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  build: {
    target: 'es2015',
    modulePreload: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: '[name][extname]',
        globals: {
          'vue': 'Vue',
          'element-plus': 'ElementPlus',
          'echarts': 'echarts'
        }
      },
      external: ['vue', 'element-plus', 'echarts']
    },
    // 增加文件大小限制，因為 GAS 有文件大小限制
    chunkSizeWarningLimit: 1024, // 1MB
  },
  // 定義全局變量
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __VUE_PROD_DEVTOOLS__: false,
  }
})