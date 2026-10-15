import { getRuntimeConfig, setRuntimeConfig } from './services/config.js'

// 兼容旧调用。直连模式已无代理地址，保留空实现避免调用方报错。
export function getApiBase() {
  return ''
}

export async function ensureBaseDetected() {
  return ''
}

export { getRuntimeConfig, setRuntimeConfig }
