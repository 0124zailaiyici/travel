// 运行时配置：AI / 地图
// 优先级（后者覆盖前者）：DEFAULTS < config.local.js < config.local.private.js < storage
//
// config.local.js        —— 提交进仓库的空模板，保证 clone 下来直接能构建
// config.local.private.js —— 本机真实 Key，已 gitignore，可能不存在
//
// 用 import.meta.glob 而不是直接 import：直接 import 一个被 gitignore 的文件，
// 全新 clone 会因为「找不到模块」导致构建失败（不是配置为空，是编译不过）。

import committedCfg from './config.local.js'

const privateModules = import.meta.glob('./config.local.private.js', { eager: true })
const privateCfg = privateModules['./config.local.private.js']?.default || {}

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
  ...(committedCfg || {}),
  ...(privateCfg || {}),
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
