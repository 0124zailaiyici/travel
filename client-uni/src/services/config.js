// 运行时配置：Proxy / AI / 地图
// 优先读本地 config.local.js，其次读 storage 中用户自定义设置

import localCfg from './config.local.js'

const DEFAULTS = {
  proxyBase: 'https://huaxi-proxy.zailaiyici88.workers.dev',
  tencentMapKey: '',
  // 用户可在设置页覆盖；默认走 Worker 代理，Key 不落客户端
  deepseekKey: '',
  deepseekBase: 'https://sub2api.zailaiyici.xyz',
  aiModel: 'grok-4.5',
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

export function getProxyBase() {
  return (_cfg.proxyBase || '').replace(/\/$/, '')
}

export function hasProxy() {
  return !!getProxyBase()
}

export function getAiModel() {
  return _cfg.aiModel || 'grok-4.5'
}

export function getDefaults() {
  return { ...DEFAULTS }
}
