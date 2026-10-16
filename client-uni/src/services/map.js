import { httpGet } from './http.js'
import { getRuntimeConfig } from './config.js'
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
    // 腾讯 POI 不返回图片；留空让卡片显示主题色占位，
    // 不再用 picsum 随机图（会张冠李戴）。
    image_url: '',
    provider: 'tencent-direct',
  }
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
    if (path === 'nearby') {
      data.boundary = 'nearby(' + params.lat + ',' + params.lng + ',' + (params.radius || 50000) + ')'
    } else if (params.city) {
      data.boundary = 'region(' + params.city + ',0)'
    } else if (params.lat != null && params.lng != null) {
      // 没有城市名但有坐标 -> 用附近搜索。
      // 绝不能再拿关键词当城市名：region(公园,0) 是无效边界，腾讯返回 0 条，
      // 白白消耗配额（地点搜索个人开发者只有 200 次/天）。
      data.boundary = 'nearby(' + params.lat + ',' + params.lng + ',' + (params.radius || 50000) + ')'
    } else {
      // 既没有城市名也没有坐标：boundary 是必填参数（不传报 348），
      // 发了也必然是 0 条，直接不发请求，省配额。
      return { list: [], provider: 'tencent-direct' }
    }
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
      // Tencent direction API: distance is meters, duration is already MINUTES.
      // Do NOT divide duration by 60 -- that understates it 60x.
      return { route: {
        distance: Math.round((route.distance || 0) / 1000),
        duration: Math.round(route.duration || 0),
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
      duration: Math.round(route.duration || 0),
      summary: segs.length ? segs.join(' → ') : '公交/地铁/步行',
      provider: 'tencent-direct',
    } }
  }
  return null
}

async function mapGet(path, params = {}) {
  // 直连腾讯地图。Worker 代理已移除：workers.dev 在国内手机网络不可达。
  if (!mapKey()) return null
  try {
    return await directTencent(path, params)
  } catch (e) {
    console.error('tencent map fail', e)
    return null
  }
}

export async function searchPOI(keyword, city = '', offset = 20, loc = null) {
  if (!keyword) return []
  const lat = loc?.lat
  const lng = loc?.lng
  const locKey = lat != null && lng != null ? Number(lat).toFixed(2) + '_' + Number(lng).toFixed(2) : ''
  const ck = 'search_' + keyword + '_' + city + '_' + locKey + '_' + offset
  const cached = cacheGet('map', ck, (getRuntimeConfig().searchCacheMin || 30) * 60 * 1000)
  if (cached) return cached
  const data = await mapGet('search', { keyword, city, lat, lng, page_size: offset })
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
