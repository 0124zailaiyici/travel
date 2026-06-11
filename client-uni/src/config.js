let _apiBase = null
let _detectPromise = null

export function getApiBase() {
  return _apiBase
}

async function _detect() {
  const candidates = ['http://47.106.126.50:3002', 'http://localhost:3002', 'http://192.169.3.14:3002', 'http://10.38.148.114:3002']
  for (const url of candidates) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        await uni.request({ url: url + '/api/health', timeout: 2000 })
        _apiBase = url
        return
      } catch(e) {}
    }
  }
  _apiBase = candidates[0]
}

export function ensureBaseDetected() {
  if (!_detectPromise) _detectPromise = _detect()
  return _detectPromise
}
