let cachedLocation = null
const LOC_KEY = 'huaxi_last_loc'
const LOC_TTL = 10 * 60 * 1000

function readStoredLoc() {
  try {
    const raw = uni.getStorageSync(LOC_KEY)
    if (!raw) return null
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || !obj.ts || obj.lat == null || obj.lng == null) return null
    if (Date.now() - obj.ts > LOC_TTL) return null
    return { lat: obj.lat, lng: obj.lng }
  } catch {
    return null
  }
}

function writeStoredLoc(loc) {
  try { uni.setStorageSync(LOC_KEY, JSON.stringify({ ...loc, ts: Date.now() })) } catch {}
}

export function clearLocationCache() {
  cachedLocation = null
  try { uni.removeStorageSync(LOC_KEY) } catch {}
}

export async function getLocation(options = {}) {
  const { timeout = 2500, allowCache = true } = options
  if (allowCache && cachedLocation) return cachedLocation
  if (allowCache) {
    const stored = readStoredLoc()
    if (stored) {
      cachedLocation = stored
      // 先返回缓存，同时后台刷新定位
      refreshLocation(timeout).catch(() => {})
      return stored
    }
  }
  // allowCache=false 时强制重新调用系统定位
  return refreshLocation(timeout)
}

async function refreshLocation(timeout = 2500) {
  const loc = await new Promise((resolve) => {
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeout)
    try {
      uni.getLocation({
        type: 'wgs84',
        altitude: false,
        isHighAccuracy: false,
        highAccuracyExpireTime: Math.min(timeout, 2000),
        success: (res) => {
          clearTimeout(timer)
          finish({ lat: res.latitude, lng: res.longitude })
        },
        fail: () => {
          clearTimeout(timer)
          finish(null)
        }
      })
    } catch {
      clearTimeout(timer)
      finish(null)
    }
  })
  if (loc) {
    cachedLocation = loc
    writeStoredLoc(loc)
  }
  return loc
}
