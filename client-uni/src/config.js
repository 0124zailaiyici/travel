// API 服务器地址 — 自动检测环境
// 开发者工具(Windows/Mac) → localhost
// 真机(Android/iOS) → LAN IP
const LAN_IP = 'http://10.38.148.114:3002'
const LOCAL = 'http://localhost:3002'

export function getApiBase() {
  try {
    const info = uni.getSystemInfoSync()
    if (info.platform === 'ios' || info.platform === 'android') {
      return LAN_IP
    }
  } catch (_) {}
  return LOCAL
}
