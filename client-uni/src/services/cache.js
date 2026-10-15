function keyOf(ns, key) {
  return 'hxcache:' + ns + ':' + key
}

export function cacheGet(ns, key, ttlMs) {
  try {
    const raw = uni.getStorageSync(keyOf(ns, key))
    if (!raw) return null
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!obj || !obj.ts) return null
    if (ttlMs && Date.now() - obj.ts > ttlMs) return null
    return obj.data
  } catch {
    return null
  }
}

export function cacheSet(ns, key, data) {
  try {
    uni.setStorageSync(keyOf(ns, key), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

export function cacheDel(ns, key) {
  try { uni.removeStorageSync(keyOf(ns, key)) } catch {}
}

export function cacheClearNs(ns) {
  try {
    const info = uni.getStorageInfoSync()
    const keys = (info && info.keys) || []
    const prefix = 'hxcache:' + ns + ':'
    keys.forEach((k) => {
      if (String(k).startsWith(prefix)) {
        try { uni.removeStorageSync(k) } catch {}
      }
    })
  } catch {}
}
