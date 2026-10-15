function uidKey() { return 'huaxi_uid' }
function favKey(uid) { return `huaxi_favs_${uid}` }
function histKey(uid) { return `huaxi_hist_${uid}` }
function cmtKey(destId) { return `huaxi_cmts_${destId}` }
function destCacheKey() { return 'huaxi_dest_cache' }

function readJson(key, fallback) {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return fallback
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return fallback
  }
}

function writeJson(key, val) {
  try { uni.setStorageSync(key, JSON.stringify(val)) } catch {}
}

export function getOrCreateUserId() {
  let uid = ''
  try { uid = uni.getStorageSync(uidKey()) } catch {}
  if (uid) return uid
  uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
  try { uni.setStorageSync(uidKey(), uid) } catch {}
  return uid
}

export function setUserId(uid) {
  try { uni.setStorageSync(uidKey(), uid) } catch {}
}

export function getFavoriteIds(uid) {
  return readJson(favKey(uid), [])
}

export function toggleFavorite(uid, destId, destObj) {
  const ids = getFavoriteIds(uid)
  const idx = ids.indexOf(destId)
  let favorited
  if (idx >= 0) {
    ids.splice(idx, 1)
    favorited = false
  } else {
    ids.unshift(destId)
    favorited = true
  }
  writeJson(favKey(uid), ids)
  if (destObj) cacheDestination(destObj)
  return { favorited, ids }
}

export function listFavoriteDests(uid) {
  const ids = getFavoriteIds(uid)
  const cache = readJson(destCacheKey(), {})
  return ids.map((id) => cache[id]).filter(Boolean)
}

export function postHistory(uid, destId, destObj) {
  const arr = readJson(histKey(uid), [])
  const next = [{ id: destId, ts: Date.now() }, ...arr.filter((x) => x.id !== destId)].slice(0, 30)
  writeJson(histKey(uid), next)
  if (destObj) cacheDestination(destObj)
  return true
}

export function listHistoryDests(uid) {
  const arr = readJson(histKey(uid), [])
  const cache = readJson(destCacheKey(), {})
  return arr.map((x) => cache[x.id]).filter(Boolean)
}

export function cacheDestination(dest) {
  if (!dest?.id) return
  const cache = readJson(destCacheKey(), {})
  cache[dest.id] = {
    id: dest.id,
    name: dest.name,
    description: dest.description || '',
    rating: dest.rating || 0,
    best_season: dest.best_season || '全年',
    image_url: dest.image_url || '',
    address: dest.address || '',
    lat: dest.lat,
    lng: dest.lng,
    tags: dest.tags || [],
    themeIcon: dest.themeIcon || '📍',
    duration: dest.duration || 1,
  }
  writeJson(destCacheKey(), cache)
}

export function getCachedDestination(id) {
  const cache = readJson(destCacheKey(), {})
  return cache[id] || null
}

const AVATAR_COLORS = ['#C4817A', '#5B7B5A', '#E8C4A0', '#8BA88A', '#9A5E58', '#E8B4AE', '#5B7B8A', '#C4917A']

function pickColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function getComments(destId, page = 1, limit = 10) {
  const all = readJson(cmtKey(destId), [])
  const pg = Math.max(1, Number(page) || 1)
  const ps = Math.min(50, Math.max(1, Number(limit) || 10))
  const start = (pg - 1) * ps
  return {
    list: all.slice(start, start + ps),
    total: all.length,
    page: pg,
    limit: ps,
  }
}

export function postComment(data) {
  const destId = data.destination_id
  const all = readJson(cmtKey(destId), [])
  const name = (data.nickname || '匿名').trim().slice(0, 12) || '匿名'
  const item = {
    id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    openid: data.openid,
    nickname: name,
    avatar_color: pickColor(name),
    rating: data.rating ? Math.min(Math.max(parseInt(data.rating), 1), 5) : null,
    content: String(data.content || '').trim(),
    image_url: data.image_url || data.image_data || null,
    parent_id: data.parent_id || null,
    created_at: new Date().toISOString(),
  }
  all.unshift(item)
  writeJson(cmtKey(destId), all)
  return { success: true, id: item.id }
}

export function deleteComment(id, openid, destId) {
  // destId optional: scan all if missing is expensive; require destId from caller when possible
  if (destId) {
    const all = readJson(cmtKey(destId), [])
    const row = all.find((c) => c.id === id)
    if (!row) return { success: false, error: 'not found' }
    if (row.openid !== openid) return { success: false, error: 'forbidden' }
    const next = all.filter((c) => c.id !== id && c.parent_id !== id)
    writeJson(cmtKey(destId), next)
    return { success: true }
  }
  return { success: false, error: 'missing destId' }
}
