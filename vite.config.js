import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue({
      jsx: true,
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.startsWith('vue-devtools')
        }
      }
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  define: {
    __VUE_PROD_DEVTOOLS__: JSON.stringify(true),
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2015',
    modulePreload: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        globals: {
          'vue': 'Vue',
          'element-plus': 'ElementPlus'
        },
        assetFileNames: '[name][extname]'
      },
      external: ['vue', 'element-plus']
    },
    chunkSizeWarningLimit: 100
  }
})