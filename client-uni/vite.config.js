import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

const uni = uniModule.default?.default || uniModule.default || uniModule

export default defineConfig({
  plugins: [uni()],
  // H5 开发服务器只做静态预览。原来这里把 /api 代理到 localhost:3002 的
  // 那个 Node 后端，后端已删除；客户端现在是直连腾讯地图 / DeepSeek，
  // 不再需要任何代理。
  server: {
    port: 3000
  }
})
