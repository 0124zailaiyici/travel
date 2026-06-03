let _apiBase = 'http://192.169.3.14:3002'
let _detectPromise = null

export function getApiBase() {
  return _apiBase
}

async function _detect() {
  for (const url of ['http://localhost:3002', 'http://192.169.3.14:3002']) {
    try {
      await uni.request({ url: url + '/api/health', timeout: 1500 })
      _apiBase = url
      return
    } catch(e) {}
  }
}

export function ensureBaseDetected() {
  if (!_detectPromise) _detectPromise = _detect()
  return _detectPromise
}
