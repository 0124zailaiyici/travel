import axios from 'axios'

const KEY = process.env.TENCENT_MAP_KEY
const BASE = 'https://apis.map.qq.com/ws'

const ALLOW_TYPES = [
  '风景名胜','名胜古迹','旅游景点',
  '公园广场','城市广场',
  '动物园','植物园','水族馆','海洋馆',
  '博物馆','美术馆','展览馆','科技馆','纪念馆','陈列馆',
  '游乐场','游乐园','主题乐园','度假村','度假区','温泉','滑雪场',
  '文物古迹','文物保护','自然保护区','地质公园','森林公园',
  '教堂','寺庙','道观','清真寺','历史建筑','名人故居','故居',
  '特色商业街','步行街','历史街区','文化旅游',
  '海滨','沙滩','湖泊','山岳','瀑布','河流','湿地','岛屿','峡谷','洞穴',
  '赏花','采摘','农家乐','田园','农场',
  '登山','徒步','漂流','骑行',
]

function isRelevant(type) {
  if (!type) return false
  return ALLOW_TYPES.some(a => type.includes(a))
}

/**
 * POI keyword search (replaces Amap searchPOI)
 */
export async function searchPOI(keyword, city = '', offset = 20) {
  if (!KEY) return []
  try {
    const params = { keyword, key: KEY, page_size: offset }
    if (city) {
      params.boundary = `region(${city},0)`
    }
    const { data } = await axios.get(`${BASE}/place/v1/search`, { params })
    if (data.status !== 0) return []
    return (data.data || []).filter(p => isRelevant(p.category || '')).map(p => ({
      id: p.id, name: p.title, lat: p.location?.lat || 0,
      lng: p.location?.lng || 0, address: p.address || '',
      rating: 0, type: p.category || '', distance: 0
    }))
  } catch { return [] }
}

/**
 * POI detail (replaces Amap getPOIDetail)
 */
export async function getPOIDetail(id) {
  if (!KEY || !id) return null
  try {
    const { data } = await axios.get(`${BASE}/place/v1/detail`, {
      params: { id, key: KEY }
    })
    if (data.status !== 0 || !data.data) return null
    const p = data.result || data.data
    return {
      id: p.id, name: p.title, lat: p.location?.lat || 0,
      lng: p.location?.lng || 0, address: p.address || '',
      rating: 0,
      tags: (p.category || '').split(';').filter(Boolean).slice(0, 3) || [],
      description: p.address || '',
      best_season: '全年', duration: 1, highlights: [], image_url: '',
      transport_guide: '', itinerary: [], tips: [], budget: {}
    }
  } catch { return null }
}

/**
 * Nearby search (replaces Amap searchAround)
 */
export async function searchAround(lat, lng, radius = 50000) {
  if (!KEY) return []
  try {
    const { data } = await axios.get(`${BASE}/place/v1/search`, {
      params: {
        keyword: '景点|公园|博物馆',
        boundary: `nearby(${lat},${lng},${radius})`,
        key: KEY, page_size: 20
      }
    })
    if (data.status !== 0) return []
    return (data.data || []).filter(p => isRelevant(p.category || '')).map(p => ({
      id: p.id, name: p.title, lat: p.location?.lat || 0,
      lng: p.location?.lng || 0, address: p.address || '',
      rating: 0, type: p.category || '',
      distance: p._distance ? Math.round(p._distance / 1000) : 0,
      tags: (p.category || '').split(';').filter(Boolean).slice(0, 3) || [],
      image_url: ''
    }))
  } catch { return [] }
}

/**
 * Reverse geocode: lat,lng → city name
 */
export async function getCityFromCoords(lat, lng) {
  if (!KEY || !lat || !lng) return ''
  try {
    const { data } = await axios.get(`${BASE}/geocoder/v1`, {
      params: { location: `${lat},${lng}`, key: KEY }
    })
    if (data.status !== 0) return ''
    const comp = data.result?.address_component
    return comp?.city || comp?.district || comp?.province || ''
  } catch { return '' }
}

/**
 * Driving direction
 */
export async function getDrivingRoute(originLat, originLng, destLat, destLng) {
  if (!KEY) return null
  try {
    const { data } = await axios.get(`${BASE}/direction/v1/driving`, {
      params: {
        from: `${originLat},${originLng}`,
        to: `${destLat},${destLng}`,
        key: KEY
      }
    })
    if (data.status !== 0 || !data.result?.routes?.length) return null
    const route = data.result.routes[0]
    return {
      distance: Math.round(route.distance / 1000),
      duration: Math.round(route.duration / 60),
      tolls: Math.round((route.tolls || 0) / 100) || 0
    }
  } catch { return null }
}

/**
 * Transit direction (公交/地铁/高铁)
 */
export async function getTransitRoute(originLat, originLng, destLat, destLng, city = '', cityd = '') {
  if (!KEY) return null
  try {
    const params = {
      from: `${originLat},${originLng}`,
      to: `${destLat},${destLng}`,
      key: KEY
    }
    if (city) params.city = city
    if (cityd) params.cityd = cityd
    const { data } = await axios.get(`${BASE}/direction/v1/transit`, { params })
    if (data.status !== 0 || !data.result?.routes?.length) return null
    const t = data.result.routes[0]
    const segs = []
    for (const step of t.steps || []) {
      if (step.mode === 'BUS') {
        segs.push(step.bus_name || '公交')
      } else if (step.mode === 'SUBWAY') {
        segs.push(step.bus_name || '地铁')
      } else if (step.mode === 'RAIL') {
        segs.push((step.bus_name || '高铁'))
      } else if (step.mode === 'TAXI') {
        segs.push('打车')
      } else if (step.mode === 'WALKING') {
        segs.push('步行')
      }
    }
    const distance = t.distance ? Math.round(t.distance / 1000) : 0
    return {
      distance,
      duration: Math.round((t.duration || 0) / 60),
      cost: 0,
      walkingDistance: 0,
      summary: segs.length ? segs.join(' → ') : '公交/地铁/高铁'
    }
  } catch { return null }
}
