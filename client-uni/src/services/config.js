// 运行时配置：Proxy / AI / 地图
// 优先读本地 config.local.js，其次读 storage 中用户自定义设置

import localCfg from './config.local.js'

const DEFAULTS = {
  // 直连模式：Key 存在客户端。个人自用可接受；若将来要公开分发，需改回服务端代理。
  tencentMapKey: '',
  deepseekKey: '',
  deepseekBase: 'https://api.deepseek.com',
  aiModel: 'deepseek-chat',
  openMeteoBase: 'https://api.open-meteo.com',
  tencentMapBase: 'https://apis.map.qq.com',
  aiCacheDays: 7,
  searchCacheMin: 30,
  nearbyCacheMin: 15,
  ...(localCfg || {}),
}

let _cfg = { ...DEFAULTS }

try {
  const saved = uni.getStorageSync('huaxi_runtime_cfg')
  if (saved) Object.assign(_cfg, typeof saved === 'string' ? JSON.parse(saved) : saved)
} catch {}

export function getRuntimeConfig() {
  return { ..._cfg }
}

export function setRuntimeConfig(partial = {}) {
  const next = { ...partial }
  Object.keys(next).forEach((k) => {
    if (typeof next[k] === 'string') next[k] = next[k].trim()
  })
  _cfg = { ..._cfg, ...next }
  try { uni.setStorageSync('huaxi_runtime_cfg', JSON.stringify(_cfg)) } catch {}
  return getRuntimeConfig()
}

export function resetRuntimeConfig() {
  _cfg = { ...DEFAULTS }
  try { uni.removeStorageSync('huaxi_runtime_cfg') } catch {}
  return getRuntimeConfig()
}

export function getAiModel() {
  return _cfg.aiModel || 'deepseek-chat'
}

export function getDefaults() {
  return { ...DEFAULTS }
}
