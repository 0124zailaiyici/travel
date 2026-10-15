import { getRuntimeConfig, setRuntimeConfig, getProxyBase, hasProxy } from './services/config.js'

// 兼容旧调用：返回当前代理地址
export function getApiBase() {
  return getProxyBase() || ''
}

export async function ensureBaseDetected() {
  return getApiBase()
}

export { getRuntimeConfig, setRuntimeConfig, getProxyBase, hasProxy }
