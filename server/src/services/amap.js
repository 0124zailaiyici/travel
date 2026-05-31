import axios from 'axios'

const AMAP_KEY = process.env.AMAP_KEY
const BASE = 'https://restapi.amap.com/v3'

const BLOCK_TYPES = ['交通设施','政府机构','公司企业','道路附属','地名地址','门牌信息','室内设施','通行设施']

function isRelevant(type) {
  if (!type) return false
  return !BLOCK_TYPES.some(b => type.includes(b))
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
