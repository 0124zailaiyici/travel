import { httpGet } from './http.js'
import { getProxyBase, hasProxy, getRuntimeConfig } from './config.js'
import { cacheGet, cacheSet } from './cache.js'

function normalizeTencentPoi(p, withDistance = false) {
  return {
    id: 'poi_' + p.id,
    name: p.title,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: 0,
    type: p.category || '',
    distance: withDistance && p._distance ? Math.round(p._distance / 1000) : undefined,
    tags: String(p.category || '').split(';').filter(Boolean).slice(0, 3),
    description: p.address || '',
    image_url: 'https://picsum.photos/seed/' + (p.id || p.title) + '/400/300',
    provider: 'tencent-direct',
  }
}

async function proxyMapGet(path, params = {}) {
  if (!hasProxy()) return null
  return httpGet(getProxyBase() + '/map/' + path, params, {}, 6000)
}

function mapKey() {
  return String(getRuntimeConfig().tencentMapKey || '').trim()
}

async function directTencent(path, params = {}) {
  const key = mapKey()
  if (!key) return null
  if (path === 'search' || path === 'nearby') {
    const data = {
      key,
      keyword: path === 'nearby' ? '景点|公园|景区' : (params.keyword || ''),
      page_size: params.page_size || 20,
    }
    if (path === 'nearby') data.boundary = 'nearby(' + params.lat + ',' + params.lng + ',' + (params.radius || 50000) + ')'
    else if (params.city) data.boundary = 'region(' + params.city + ',0)'
    const res = await httpGet('https://apis.map.qq.com/ws/place/v1/search', data, {}, 7000)
    if (res?.status !== 0) throw new Error(res?.message || '腾讯地图查询失败')
    return { list: (res.data || []).map((p) => normalizeTencentPoi(p, path === 'nearby')), provider: 'tencent-direct' }
  }
  if (path === 'detail') {
    const id = String(params.id || '').replace(/^poi_/, '')
    const res = await httpGet('https://apis.map.qq.com/ws/place/v1/detail', { key, id }, {}, 7000)
    if (res?.status !== 0) throw new Error(res?.message || '腾讯地图详情失败')
    const p = res.result || res.data
    return { item: p ? normalizeTencentPoi(p) : null, provider: 'tencent-direct' }
  }
  if (path === 'route/driving' || path === 'route/transit') {
    const kind = path.endsWith('driving') ? 'driving' : 'transit'
    const res = await httpGet('https://apis.map.qq.com/ws/direction/v1/' + kind, {
      key,
      from: params.fromLat + ',' + params.fromLng,
      to: params.toLat + ',' + params.toLng,
    }, {}, 7000)
    const route = res?.result?.routes?.[0]
    if (res?.status !== 0 || !route) throw new Error(res?.message || '腾讯路线查询失败')
    if (kind === 'driving') {
      return { route: {
        distance: Math.round((route.distance || 0) / 1000),
        duration: Math.round((route.duration || 0) / 60),
        tolls: Math.round((route.tolls || 0) / 100) || 0,
        provider: 'tencent-direct',
      } }
    }
    const segs = []
    for (const step of route.steps || []) {
      if (step.mode === 'BUS') segs.push(step.bus_name || '公交')
      else if (step.mode === 'SUBWAY') segs.push(step.bus_name || '地铁')
      else if (step.mode === 'RAIL') segs.push(step.bus_name || '火车')
      else if (step.mode === 'WALKING') segs.push('步行')
    }
    return { route: {
      distance: route.distance ? Math.round(route.distance / 1000) : 0,
      duration: Math.round((route.duration || 0) / 60),
      summary: segs.length ? segs.join(' → ') : '公交/地铁/步行',
      provider: 'tencent-direct',
    } }
  }
  return null
}

async function mapGet(path, params = {}) {
  // 用户在设置页填了地图 Key 时优先直连，避免代理 Key 额度耗尽
  if (mapKey()) {
    try { return await directTencent(path, params) } catch (e) { console.error('direct tencent map fail', e) }
  }
  try { return await proxyMapGet(path, params) } catch (e) { return null }
}

export async function searchPOI(keyword, city = '', offset = 20) {
  if (!keyword) return []
  const ck = 'search_' + keyword + '_' + city + '_' + offset
  const cached = cacheGet('map', ck, (getRuntimeConfig().searchCacheMin || 30) * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('search', { keyword, city, page_size: offset })
  const list = data?.list || []
  if (list.length) cacheSet('map', ck, list)
  return list
}

export async function searchAround(lat, lng, radius = 50000) {
  if (lat == null || lng == null) return []
  const ck = 'around_' + Number(lat).toFixed(2) + '_' + Number(lng).toFixed(2) + '_' + radius
  const cached = cacheGet('map', ck, (getRuntimeConfig().nearbyCacheMin || 15) * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('nearby', { lat, lng, radius, page_size: 20 })
  const list = data?.list || []
  if (list.length) cacheSet('map', ck, list)
  return list
}

export async function getPOIDetail(id) {
  if (!id) return null
  const ck = 'detail_' + id
  const cached = cacheGet('map', ck, 24 * 60 * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('detail', { id })
  const item = data?.item || null
  if (item) cacheSet('map', ck, item)
  return item
}

export async function getDrivingRoute(originLat, originLng, destLat, destLng) {
  if ([originLat, originLng, destLat, destLng].some((x) => x == null)) return null
  const ck = 'drive_' + Number(originLat).toFixed(2) + '_' + Number(originLng).toFixed(2) + '_' + Number(destLat).toFixed(2) + '_' + Number(destLng).toFixed(2)
  const cached = cacheGet('route', ck, 24 * 60 * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('route/driving', { fromLat: originLat, fromLng: originLng, toLat: destLat, toLng: destLng })
  const route = data?.route || null
  if (route) cacheSet('route', ck, route)
  return route
}

export async function getTransitRoute(originLat, originLng, destLat, destLng) {
  if ([originLat, originLng, destLat, destLng].some((x) => x == null)) return null
  const ck = 'transit_' + Number(originLat).toFixed(2) + '_' + Number(originLng).toFixed(2) + '_' + Number(destLat).toFixed(2) + '_' + Number(destLng).toFixed(2)
  const cached = cacheGet('route', ck, 24 * 60 * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('route/transit', { fromLat: originLat, fromLng: originLng, toLat: destLat, toLng: destLng })
  const route = data?.route || null
  if (route) cacheSet('route', ck, route)
  return route
}
