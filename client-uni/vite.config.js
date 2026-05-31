import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

const uni = uniModule.default?.default || uniModule.default || uniModule

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true }
    }
  }
})
