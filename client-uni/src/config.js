// API 服务器地址 — 自动检测环境
const LOCAL = 'http://localhost:3002'
const LAN = 'http://10.38.148.114:3002'

let _base = null

export function getApiBase() {
  if (_base) return _base
  try {
    // __wxConfig__ 是微信原生全局，不经过 uni-app 编译转换，模块加载时即可用
    const p = typeof __wxConfig__ !== 'undefined' ? __wxConfig__.platform : ''
    _base = (p === 'ios' || p === 'android') ? LAN : LOCAL
  } catch (_) {
    _base = LOCAL
  }
  return _base
}
