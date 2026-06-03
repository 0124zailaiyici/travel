let _apiBase = null
export function getApiBase() {
  if (_apiBase) return _apiBase
  try {
    const sys = uni.getSystemInfoSync()
    _apiBase = (sys.platform === 'windows' || sys.platform === 'mac')
      ? 'http://localhost:3002'
      : 'http://192.169.3.14:3002'
  } catch(e) {
    _apiBase = 'http://192.169.3.14:3002'
  }
  return _apiBase
}
