import axios from 'axios'

const AMAP_KEY = process.env.AMAP_KEY
const BASE = 'https://restapi.amap.com/v3'

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

export async function searchPOI(keyword, city = '', offset = 20, page = 1) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key') return []
  const { data } = await axios.get(`${BASE}/place/text`, {
    params: { key: AMAP_KEY, keywords: keyword, city, offset, page, extensions: 'all' }
  })
  if (data.status !== '1') throw new Error(`高德POI搜索失败: ${data.info}`)
  return data.pois.filter(p => isRelevant(p.type)).map(p => ({
    id: p.id, name: p.name, lat: parseFloat(p.location.split(',')[1]),
    lng: parseFloat(p.location.split(',')[0]), address: p.address,
    rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
    type: p.type, distance: 0
  }))
}

export async function getPOIDetail(id) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key' || !id) return null
  try {
    const { data } = await axios.get(`${BASE}/place/detail`, {
      params: { key: AMAP_KEY, id }
    })
    if (data.status !== '1' || !data.pois?.length) return null
    const p = data.pois[0]
    return {
      id: p.id, name: p.name, lat: parseFloat(p.location.split(',')[1]),
      lng: parseFloat(p.location.split(',')[0]), address: p.address,
      rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
      tags: p.type?.split(';').filter(Boolean).slice(0, 3) || [],
      description: p.address || '',
      best_season: '全年', duration: 1, highlights: [], image_url: '',
      transport_guide: '', itinerary: [], tips: [], budget: {}
    }
  } catch { return null }
}

export async function searchAround(lat, lng, radius = 50000, offset = 20) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key') return []
  const types = '风景名胜|公园广场|动物园|植物园|博物馆|游乐场|海滨沙滩|度假村|温泉'
  const { data } = await axios.get(`${BASE}/place/around`, {
    params: { key: AMAP_KEY, location: `${lng},${lat}`, radius, types, offset, extensions: 'all' }
  })
  if (data.status !== '1') throw new Error(`高德周边搜索失败: ${data.info}`)
  return data.pois.map(p => ({
    id: p.id, name: p.name, lat: parseFloat(p.location.split(',')[1]),
    lng: parseFloat(p.location.split(',')[0]), address: p.address,
    rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
    type: p.type, distance: Math.round(parseInt(p.distance) / 1000),
    tags: p.type?.split(';').filter(Boolean).slice(0, 3) || [],
    image_url: ''
  }))
}

export async function getCityFromCoords(lat, lng) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key' || !lat || !lng) return ''
  try {
    const { data } = await axios.get(`${BASE}/geocode/regeo`, {
      params: { key: AMAP_KEY, location: `${lng},${lat}` }
    })
    if (data.status === '1' && data.regeocode?.addressComponent?.city)
      return data.regeocode.addressComponent.city
    if (data.status === '1' && data.regeocode?.addressComponent?.province)
      return data.regeocode.addressComponent.province
    return ''
  } catch { return '' }
}

export async function getDrivingRoute(originLat, originLng, destLat, destLng) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key') return null
  try {
    const { data } = await axios.get(`${BASE}/direction/driving`, {
      params: {
        key: AMAP_KEY,
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        strategy: 0, extensions: 'base'
      }
    })
    if (data.status !== '1' || !data.route?.paths?.length) return null
    const path = data.route.paths[0]
    return {
      distance: Math.round(path.distance / 1000),
      duration: Math.round(path.duration / 60),
      tolls: path.tolls || 0
    }
  } catch { return null }
}

export async function getTransitRoute(originLat, originLng, destLat, destLng, city = '', cityd = '') {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key') return null
  try {
    const { data } = await axios.get(`${BASE}/direction/transit/integrated`, {
      params: {
        key: AMAP_KEY,
        origin: `${originLng},${originLat}`,
        destination: `${destLng},${destLat}`,
        city, cityd,
        extensions: 'base'
      }
    })
    if (data.status !== '1' || !data.route?.transits?.length) return null
    const t = data.route.transits[0]
    const segs = []
    for (const seg of t.segments || []) {
      if (seg.bus?.buslines?.length) {
        for (const bl of seg.bus.buslines) {
          const label = (bl.type === '地铁' || bl.type === '1') ? bl.name : bl.name
          segs.push(label)
        }
      } else if (seg.rail?.name) {
        const rl = seg.rail.name + (seg.rail.type === '1' ? '(高铁/动车)' : '(火车)')
        segs.push(rl)
      } else if (seg.taxi) {
        segs.push('打车/网约车')
      } else if (seg.walking?.distance && seg.walking.distance > 1000) {
        segs.push('步行' + Math.round(seg.walking.distance / 1000) + 'km')
      }
    }
    return {
      distance: Math.round(t.distance / 1000),
      duration: Math.round(t.duration / 60),
      cost: t.cost || 0,
      walkingDistance: Math.round((t.walking_distance || 0) / 1000),
      summary: segs.length ? segs.join(' → ') : '公交/地铁'
    }
  } catch { return null }
}

export async function getDistanceMatrix(origins, destinations) {
  if (!AMAP_KEY || AMAP_KEY === 'your_amap_key') {
    return destinations.map(() => Math.floor(Math.random() * 300))
  }
  const originsStr = origins.map(p => `${p.lng},${p.lat}`).join('|')
  const destsStr = destinations.map(p => `${p.lng},${p.lat}`).join('|')
  const { data } = await axios.get(`${BASE}/distance`, {
    params: { key: AMAP_KEY, origins: originsStr, destination: destsStr, type: 1 }
  })
  if (data.status !== '1') throw new Error(`距离矩阵失败: ${data.info}`)
  return data.results.map(r => Math.round(r.distance / 1000))
}
