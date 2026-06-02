// API 服务器地址 — 自动检测环境
const LOCAL = 'http://localhost:3002'
const LAN = 'http://192.169.3.14:3002'

let _base = null

export function getApiBase() {
  if (_base) return _base
  try {
    const p = typeof __wxConfig__ !== 'undefined' ? __wxConfig__.platform : ''
    _base = (p === 'ios' || p === 'android') ? LAN : LOCAL
  } catch (_) {
    _base = LOCAL
  }
  return _base
}
