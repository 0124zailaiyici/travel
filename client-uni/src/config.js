let _apiBase = null
let _detectPromise = null

export function getApiBase() {
  return _apiBase
}

async function _detect() {
  const candidates = ['http://10.38.148.114:3002', 'http://192.169.3.14:3002', 'http://localhost:3002']
  for (const url of candidates) {
    try {
      await uni.request({ url: url + '/api/health', timeout: 1000 })
      _apiBase = url
      return
    } catch(e) {}
  }
  _apiBase = candidates[1]
}

export function ensureBaseDetected() {
  if (!_detectPromise) _detectPromise = _detect()
  return _detectPromise
}
