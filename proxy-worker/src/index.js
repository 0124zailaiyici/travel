/**
 * ??????
 * - /health
 * - /map/search  /map/nearby  /map/detail  /map/route/driving  /map/route/transit
 * - /map/* ???????????????
 * - /ai/itinerary  -> sub2api/Grok
 *
 * ??????amap / tencent / baidu
 * Secret:
 *   AMAP_KEYS=key1,key2
 *   TENCENT_MAP_KEYS=key1,key2   (?? TENCENT_MAP_KEY)
 *   BAIDU_MAP_KEYS=key1,key2
 *   AI_KEY / AI_BASE / AI_MODEL
 */

const DEFAULT_AI_BASE = 'https://sub2api.zailaiyici.xyz'
const DEFAULT_AI_MODEL = 'grok-4.5'
const CACHE_TTL_MS = 15 * 60 * 1000
const COOLDOWN_MS = 30 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

const state = {
  cooldown: new Map(), // provider:key -> untilTs
  cache: new Map(),    // key -> { exp, data }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  })
}

function text(msg, status = 200) {
  return new Response(msg, { status, headers: { ...cors } })
}

function splitKeys(v) {
  return String(v || '')
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function providerKeys(env) {
  return {
    amap: splitKeys(env.AMAP_KEYS || env.AMAP_KEY),
    tencent: splitKeys(env.TENCENT_MAP_KEYS || env.TENCENT_MAP_KEY),
    baidu: splitKeys(env.BAIDU_MAP_KEYS || env.BAIDU_MAP_KEY),
  }
}

function coolKey(provider, key) {
  return provider + ':' + key.slice(0, 6)
}

function isCooling(provider, key) {
  const until = state.cooldown.get(coolKey(provider, key)) || 0
  return Date.now() < until
}

function markCooldown(provider, key, ms = COOLDOWN_MS) {
  state.cooldown.set(coolKey(provider, key), Date.now() + ms)
}

function cacheGet(k) {
  const hit = state.cache.get(k)
  if (!hit) return null
  if (Date.now() > hit.exp) {
    state.cache.delete(k)
    return null
  }
  return hit.data
}

function cacheSet(k, data, ttl = CACHE_TTL_MS) {
  state.cache.set(k, { exp: Date.now() + ttl, data })
}

function aiBase(env) {
  return String(env.AI_BASE || DEFAULT_AI_BASE).replace(/\/$/, '')
}
function aiKey(env) {
  return env.AI_KEY || env.DEEPSEEK_KEY || ''
}
function aiModel(env) {
  return env.AI_MODEL || DEFAULT_AI_MODEL
}

function quotaLike(msg = '') {
  const s = String(msg).toLowerCase()
  return (
    s.includes('limit') ||
    s.includes('quota') ||
    s.includes('exceed') ||
    s.includes('额度') ||
    s.includes('配额') ||
    s.includes('invalid user key') ||
    s.includes('invalid key') ||
    s.includes('userkey') ||
    s.includes('daily') ||
    s.includes('cuqps') ||
    s.includes('developer')
  )
}

function normalizeList(list, provider) {
  return (list || []).map((p) => ({
    id: p.id,
    name: p.name,
    lat: Number(p.lat) || 0,
    lng: Number(p.lng) || 0,
    address: p.address || '',
    rating: Number(p.rating) || 0,
    type: p.type || '',
    distance: p.distance == null ? 0 : Number(p.distance) || 0,
    tags: p.tags || [],
    image_url: p.image_url || '',
    description: p.description || p.address || '',
    best_season: p.best_season || '全年',
    duration: p.duration || 1,
    highlights: p.highlights || [],
    source: provider,
    themeIcon: '📍',
  }))
}

async function amapSearch(key, { keyword, city, page_size = 20 }) {
  const u = new URL('https://restapi.amap.com/v3/place/text')
  u.searchParams.set('key', key)
  u.searchParams.set('keywords', keyword || '')
  if (city) u.searchParams.set('city', city)
  u.searchParams.set('offset', String(page_size))
  u.searchParams.set('page', '1')
  u.searchParams.set('extensions', 'all')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (String(data.status) !== '1') {
    const err = new Error(data.info || 'amap search fail')
    err.quota = quotaLike(data.info || data.infocode)
    throw err
  }
  const list = (data.pois || []).map((p) => {
    const [lng, lat] = String(p.location || ',').split(',')
    return {
      id: 'amap_' + p.id,
      name: p.name,
      lat: parseFloat(lat) || 0,
      lng: parseFloat(lng) || 0,
      address: Array.isArray(p.address) ? p.address.join('') : (p.address || ''),
      rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
      type: p.type || '',
      tags: String(p.type || '').split(';').filter(Boolean).slice(0, 3),
      image_url: p.photos?.[0]?.url || '',
      description: Array.isArray(p.address) ? p.address.join('') : (p.address || ''),
    }
  })
  return normalizeList(list, 'amap')
}

async function amapNearby(key, { lat, lng, radius = 50000, page_size = 20 }) {
  const u = new URL('https://restapi.amap.com/v3/place/around')
  u.searchParams.set('key', key)
  u.searchParams.set('location', `${lng},${lat}`)
  u.searchParams.set('keywords', '景点|公园|景区')
  u.searchParams.set('radius', String(radius))
  u.searchParams.set('offset', String(page_size))
  u.searchParams.set('extensions', 'all')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (String(data.status) !== '1') {
    const err = new Error(data.info || 'amap nearby fail')
    err.quota = quotaLike(data.info || data.infocode)
    throw err
  }
  const list = (data.pois || []).map((p) => {
    const [plng, plat] = String(p.location || ',').split(',')
    return {
      id: 'amap_' + p.id,
      name: p.name,
      lat: parseFloat(plat) || 0,
      lng: parseFloat(plng) || 0,
      address: Array.isArray(p.address) ? p.address.join('') : (p.address || ''),
      rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
      type: p.type || '',
      distance: p.distance ? Math.round(Number(p.distance) / 1000) : 0,
      tags: String(p.type || '').split(';').filter(Boolean).slice(0, 3),
      image_url: p.photos?.[0]?.url || '',
      description: Array.isArray(p.address) ? p.address.join('') : (p.address || ''),
    }
  })
  return normalizeList(list, 'amap')
}

async function amapDetail(key, args) {
  const id = typeof args === 'string' ? args : args.id
  const raw = String(id).replace(/^amap_/, '')
  const u = new URL('https://restapi.amap.com/v3/place/detail')
  u.searchParams.set('key', key)
  u.searchParams.set('id', raw)
  u.searchParams.set('extensions', 'all')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (String(data.status) !== '1' || !(data.pois || []).length) {
    const err = new Error(data.info || 'amap detail fail')
    err.quota = quotaLike(data.info || data.infocode)
    throw err
  }
  const p = data.pois[0]
  const [lng, lat] = String(p.location || ',').split(',')
  return normalizeList([{
    id: 'amap_' + p.id,
    name: p.name,
    lat: parseFloat(lat) || 0,
    lng: parseFloat(lng) || 0,
    address: Array.isArray(p.address) ? p.address.join('') : (p.address || ''),
    rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
    type: p.type || '',
    tags: String(p.type || '').split(';').filter(Boolean).slice(0, 3),
    image_url: p.photos?.[0]?.url || '',
    description: p.biz_ext?.level || p.address || '',
  }], 'amap')[0]
}

async function amapDriving(key, { fromLat, fromLng, toLat, toLng }) {
  const u = new URL('https://restapi.amap.com/v3/direction/driving')
  u.searchParams.set('key', key)
  u.searchParams.set('origin', `${fromLng},${fromLat}`)
  u.searchParams.set('destination', `${toLng},${toLat}`)
  u.searchParams.set('extensions', 'base')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (String(data.status) !== '1' || !data.route?.paths?.length) {
    const err = new Error(data.info || 'amap driving fail')
    err.quota = quotaLike(data.info || data.infocode)
    throw err
  }
  const path = data.route.paths[0]
  return {
    distance: Math.round(Number(path.distance || 0) / 1000),
    duration: Math.round(Number(path.duration || 0) / 60),
    tolls: Math.round(Number(path.tolls || 0)) || 0,
    provider: 'amap',
  }
}

async function amapTransit(key, { fromLat, fromLng, toLat, toLng, city = '全国' }) {
  const u = new URL('https://restapi.amap.com/v3/direction/transit/integrated')
  u.searchParams.set('key', key)
  u.searchParams.set('origin', `${fromLng},${fromLat}`)
  u.searchParams.set('destination', `${toLng},${toLat}`)
  u.searchParams.set('city', city)
  u.searchParams.set('cityd', city)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (String(data.status) !== '1' || !data.route?.transits?.length) {
    const err = new Error(data.info || 'amap transit fail')
    err.quota = quotaLike(data.info || data.infocode)
    throw err
  }
  const t = data.route.transits[0]
  const segs = []
  for (const seg of t.segments || []) {
    if (seg.bus?.buslines?.[0]?.name) segs.push(seg.bus.buslines[0].name)
    else if (seg.railway?.name) segs.push(seg.railway.name)
    else if (seg.walking) segs.push('步行')
  }
  return {
    distance: Math.round(Number(t.distance || 0) / 1000),
    duration: Math.round(Number(t.duration || 0) / 60),
    cost: Number(t.cost || 0) || 0,
    summary: segs.length ? segs.join(' → ') : '公交/地铁',
    provider: 'amap',
  }
}

async function tencentSearch(key, { keyword, city, page_size = 20 }) {
  const u = new URL('https://apis.map.qq.com/ws/place/v1/search')
  u.searchParams.set('key', key)
  u.searchParams.set('keyword', keyword || '')
  u.searchParams.set('page_size', String(page_size))
  if (city) u.searchParams.set('boundary', `region(${city},0)`)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0) {
    const err = new Error(data.message || 'tencent search fail')
    err.quota = data.status === 121 || quotaLike(data.message)
    throw err
  }
  const list = (data.data || []).map((p) => ({
    id: 'poi_' + p.id,
    name: p.title,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: 0,
    type: p.category || '',
    tags: String(p.category || '').split(';').filter(Boolean).slice(0, 3),
    description: p.address || '',
  }))
  return normalizeList(list, 'tencent')
}

async function tencentNearby(key, { lat, lng, radius = 50000, page_size = 20 }) {
  const u = new URL('https://apis.map.qq.com/ws/place/v1/search')
  u.searchParams.set('key', key)
  u.searchParams.set('keyword', '景点|公园|景区')
  u.searchParams.set('boundary', `nearby(${lat},${lng},${radius})`)
  u.searchParams.set('page_size', String(page_size))
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0) {
    const err = new Error(data.message || 'tencent nearby fail')
    err.quota = data.status === 121 || quotaLike(data.message)
    throw err
  }
  const list = (data.data || []).map((p) => ({
    id: 'poi_' + p.id,
    name: p.title,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: 0,
    type: p.category || '',
    distance: p._distance ? Math.round(p._distance / 1000) : 0,
    tags: String(p.category || '').split(';').filter(Boolean).slice(0, 3),
    description: p.address || '',
  }))
  return normalizeList(list, 'tencent')
}

async function tencentDetail(key, args) {
  const id = typeof args === 'string' ? args : args.id
  const raw = String(id).replace(/^poi_/, '')
  const u = new URL('https://apis.map.qq.com/ws/place/v1/detail')
  u.searchParams.set('key', key)
  u.searchParams.set('id', raw)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0) {
    const err = new Error(data.message || 'tencent detail fail')
    err.quota = data.status === 121 || quotaLike(data.message)
    throw err
  }
  const p = data.result || data.data
  return normalizeList([{
    id: 'poi_' + p.id,
    name: p.title,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: 0,
    type: p.category || '',
    tags: String(p.category || '').split(';').filter(Boolean).slice(0, 3),
    description: p.address || '',
    image_url: `https://picsum.photos/seed/${p.id}/400/300`,
  }], 'tencent')[0]
}

async function tencentDriving(key, { fromLat, fromLng, toLat, toLng }) {
  const u = new URL('https://apis.map.qq.com/ws/direction/v1/driving')
  u.searchParams.set('key', key)
  u.searchParams.set('from', `${fromLat},${fromLng}`)
  u.searchParams.set('to', `${toLat},${toLng}`)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0 || !data.result?.routes?.length) {
    const err = new Error(data.message || 'tencent driving fail')
    err.quota = data.status === 121 || quotaLike(data.message)
    throw err
  }
  const route = data.result.routes[0]
  return {
    distance: Math.round(route.distance / 1000),
    duration: Math.round(route.duration / 60),
    tolls: Math.round((route.tolls || 0) / 100) || 0,
    provider: 'tencent',
  }
}

async function tencentTransit(key, { fromLat, fromLng, toLat, toLng }) {
  const u = new URL('https://apis.map.qq.com/ws/direction/v1/transit')
  u.searchParams.set('key', key)
  u.searchParams.set('from', `${fromLat},${fromLng}`)
  u.searchParams.set('to', `${toLat},${toLng}`)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0 || !data.result?.routes?.length) {
    const err = new Error(data.message || 'tencent transit fail')
    err.quota = data.status === 121 || quotaLike(data.message)
    throw err
  }
  const t = data.result.routes[0]
  const segs = []
  for (const step of t.steps || []) {
    if (step.mode === 'BUS') segs.push(step.bus_name || '公交')
    else if (step.mode === 'SUBWAY') segs.push(step.bus_name || '地铁')
    else if (step.mode === 'RAIL') segs.push(step.bus_name || '火车')
    else if (step.mode === 'WALKING') segs.push('步行')
  }
  return {
    distance: t.distance ? Math.round(t.distance / 1000) : 0,
    duration: Math.round((t.duration || 0) / 60),
    summary: segs.length ? segs.join(' → ') : '公交/地铁/步行',
    provider: 'tencent',
  }
}

async function baiduSearch(key, { keyword, city, page_size = 20 }) {
  const u = new URL('https://api.map.baidu.com/place/v2/search')
  u.searchParams.set('ak', key)
  u.searchParams.set('query', keyword || '景点')
  u.searchParams.set('region', city || '全国')
  u.searchParams.set('output', 'json')
  u.searchParams.set('page_size', String(page_size))
  u.searchParams.set('scope', '2')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0) {
    const err = new Error(data.message || 'baidu search fail')
    err.quota = quotaLike(data.message)
    throw err
  }
  const list = (data.results || []).map((p) => ({
    id: 'bd_' + p.uid,
    name: p.name,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: p.detail_info?.overall_rating ? parseFloat(p.detail_info.overall_rating) : 0,
    type: p.detail_info?.tag || '',
    tags: String(p.detail_info?.tag || '').split(',').filter(Boolean).slice(0, 3),
    description: p.address || '',
  }))
  return normalizeList(list, 'baidu')
}

async function baiduNearby(key, { lat, lng, radius = 50000, page_size = 20 }) {
  const u = new URL('https://api.map.baidu.com/place/v2/search')
  u.searchParams.set('ak', key)
  u.searchParams.set('query', '旅游景点')
  u.searchParams.set('location', `${lat},${lng}`)
  u.searchParams.set('radius', String(radius))
  u.searchParams.set('output', 'json')
  u.searchParams.set('page_size', String(page_size))
  u.searchParams.set('scope', '2')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0) {
    const err = new Error(data.message || 'baidu nearby fail')
    err.quota = quotaLike(data.message)
    throw err
  }
  const list = (data.results || []).map((p) => ({
    id: 'bd_' + p.uid,
    name: p.name,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: p.detail_info?.overall_rating ? parseFloat(p.detail_info.overall_rating) : 0,
    type: p.detail_info?.tag || '',
    distance: p.detail_info?.distance ? Math.round(Number(p.detail_info.distance) / 1000) : 0,
    tags: String(p.detail_info?.tag || '').split(',').filter(Boolean).slice(0, 3),
    description: p.address || '',
  }))
  return normalizeList(list, 'baidu')
}

async function baiduDetail(key, args) {
  const id = typeof args === 'string' ? args : args.id
  const raw = String(id).replace(/^bd_/, '')
  const u = new URL('https://api.map.baidu.com/place/v2/detail')
  u.searchParams.set('ak', key)
  u.searchParams.set('uid', raw)
  u.searchParams.set('output', 'json')
  u.searchParams.set('scope', '2')
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0 || !data.result) {
    const err = new Error(data.message || 'baidu detail fail')
    err.quota = quotaLike(data.message)
    throw err
  }
  const p = data.result
  return normalizeList([{
    id: 'bd_' + p.uid,
    name: p.name,
    lat: p.location?.lat || 0,
    lng: p.location?.lng || 0,
    address: p.address || '',
    rating: p.detail_info?.overall_rating ? parseFloat(p.detail_info.overall_rating) : 0,
    type: p.detail_info?.tag || '',
    tags: String(p.detail_info?.tag || '').split(',').filter(Boolean).slice(0, 3),
    description: p.address || '',
  }], 'baidu')[0]
}

async function baiduDriving(key, { fromLat, fromLng, toLat, toLng }) {
  const u = new URL('https://api.map.baidu.com/directionlite/v1/driving')
  u.searchParams.set('ak', key)
  u.searchParams.set('origin', `${fromLat},${fromLng}`)
  u.searchParams.set('destination', `${toLat},${toLng}`)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0 || !data.result?.routes?.length) {
    const err = new Error(data.message || 'baidu driving fail')
    err.quota = quotaLike(data.message)
    throw err
  }
  const r = data.result.routes[0]
  return {
    distance: Math.round(Number(r.distance || 0) / 1000),
    duration: Math.round(Number(r.duration || 0) / 60),
    tolls: 0,
    provider: 'baidu',
  }
}

async function baiduTransit(key, { fromLat, fromLng, toLat, toLng }) {
  const u = new URL('https://api.map.baidu.com/directionlite/v1/transit')
  u.searchParams.set('ak', key)
  u.searchParams.set('origin', `${fromLat},${fromLng}`)
  u.searchParams.set('destination', `${toLat},${toLng}`)
  const resp = await fetch(u.toString())
  const data = await resp.json()
  if (data.status !== 0 || !data.result?.routes?.length) {
    const err = new Error(data.message || 'baidu transit fail')
    err.quota = quotaLike(data.message)
    throw err
  }
  const r = data.result.routes[0]
  return {
    distance: Math.round(Number(r.distance || 0) / 1000),
    duration: Math.round(Number(r.duration || 0) / 60),
    summary: '公交/地铁',
    provider: 'baidu',
  }
}

const adapters = {
  amap: { search: amapSearch, nearby: amapNearby, detail: amapDetail, driving: amapDriving, transit: amapTransit },
  tencent: { search: tencentSearch, nearby: tencentNearby, detail: tencentDetail, driving: tencentDriving, transit: tencentTransit },
  baidu: { search: baiduSearch, nearby: baiduNearby, detail: baiduDetail, driving: baiduDriving, transit: baiduTransit },
}

async function withProviders(env, op, args) {
  const keys = providerKeys(env)
  const order = ['amap', 'tencent', 'baidu']
  const errors = []
  for (const provider of order) {
    const list = keys[provider] || []
    const fn = adapters[provider]?.[op]
    if (!fn || !list.length) continue
    for (const key of list) {
      if (isCooling(provider, key)) {
        errors.push(`${provider}:cooling`)
        continue
      }
      try {
        const data = await fn(key, args)
        return { data, provider, keyHint: key.slice(0, 4) + '***' }
      } catch (e) {
        const msg = e?.message || String(e)
        errors.push(`${provider}:${msg}`)
        if (e?.quota) markCooldown(provider, key, COOLDOWN_MS)
        else markCooldown(provider, key, 2 * 60 * 1000)
      }
    }
  }
  const err = new Error('all providers failed: ' + errors.slice(0, 6).join(' | '))
  err.errors = errors
  throw err
}

function q(url) {
  const o = {}
  url.searchParams.forEach((v, k) => { o[k] = v })
  return o
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return text('', 204)
    const url = new URL(request.url)
    const path = url.pathname
    const keys = providerKeys(env)

    if (path === '/' || path === '/health') {
      return json({
        status: 'ok',
        service: 'huaxi-proxy',
        hasMapKey: !!(keys.amap.length || keys.tencent.length || keys.baidu.length),
        providers: {
          amap: keys.amap.length,
          tencent: keys.tencent.length,
          baidu: keys.baidu.length,
        },
        hasAiKey: !!aiKey(env),
        aiBase: aiBase(env),
        aiModel: aiModel(env),
        time: new Date().toISOString(),
        proxyVersion: '2026-07-15-ai-loc-refresh-v3',
        routes: ['/health','/map/*','/ai/itinerary','/ai/recommend'],
      })
    }

    // ??????
    if (path.startsWith('/map/')) {
      const opPath = path.slice('/map/'.length)
      const params = q(url)
      const cacheKey = path + '?' + url.searchParams.toString()
      const cached = cacheGet(cacheKey)
      if (cached) return json({ ...cached, cached: true })

      try {
        let result
        if (opPath === 'search') {
          const r = await withProviders(env, 'search', {
            keyword: params.keyword || params.q || '',
            city: params.city || '',
            page_size: Number(params.page_size || 20),
          })
          result = { list: r.data, provider: r.provider }
        } else if (opPath === 'nearby') {
          const r = await withProviders(env, 'nearby', {
            lat: Number(params.lat),
            lng: Number(params.lng),
            radius: Number(params.radius || 50000),
            page_size: Number(params.page_size || 20),
          })
          result = { list: r.data, provider: r.provider }
        } else if (opPath === 'detail') {
          const r = await withProviders(env, 'detail', { id: params.id })
          result = { item: r.data, provider: r.provider }
        } else if (opPath === 'route/driving') {
          const r = await withProviders(env, 'driving', {
            fromLat: Number(params.fromLat || params.from_lat),
            fromLng: Number(params.fromLng || params.from_lng),
            toLat: Number(params.toLat || params.to_lat),
            toLng: Number(params.toLng || params.to_lng),
          })
          result = { route: r.data, provider: r.provider }
        } else if (opPath === 'route/transit') {
          const r = await withProviders(env, 'transit', {
            fromLat: Number(params.fromLat || params.from_lat),
            fromLng: Number(params.fromLng || params.from_lng),
            toLat: Number(params.toLat || params.to_lat),
            toLng: Number(params.toLng || params.to_lng),
            city: params.city || '全国',
          })
          result = { route: r.data, provider: r.provider }
        } else if (opPath.startsWith('ws/')) {
          // ????????????? key ???????????????
          if (!keys.tencent.length) return json({ status: 1, message: 'no tencent key; use /map/search' }, 400)
          const target = new URL('https://apis.map.qq.com/' + opPath)
          url.searchParams.forEach((v, k) => { if (k !== 'key') target.searchParams.set(k, v) })
          target.searchParams.set('key', keys.tencent[0])
          const resp = await fetch(target.toString())
          const data = await resp.json()
          return json(data, resp.status)
        } else {
          return json({ error: 'unknown map path', path }, 404)
        }
        cacheSet(cacheKey, result)
        return json(result)
      } catch (e) {
        return json({ error: e.message || String(e), list: [], item: null, route: null }, 200)
      }
    }

    if (path === '/ai/itinerary' && request.method === 'POST') {
      const key = aiKey(env)
      if (!key) return json({ error: 'AI_KEY missing' }, 500)
      let body
      try { body = await request.json() } catch { return json({ error: 'invalid json' }, 400) }
      const prompt = body.prompt || ''
      if (!prompt) return json({ error: 'missing prompt' }, 400)
      const model = body.model || aiModel(env)
      const endpoint = aiBase(env) + '/v1/chat/completions'
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: '你是中国旅行规划助手。只输出合法 JSON，不要 markdown 代码块。交通方案必须结合用户出发地。' },
              { role: 'user', content: prompt + '\n\n只输出 JSON，不要解释。' },
            ],
            temperature: 0.4,
            max_tokens: 1400,
          }),
        })
        const data = await resp.json()
        if (!resp.ok) return json({ error: 'upstream_error', status: resp.status, raw: data }, 502)
        const content = data?.choices?.[0]?.message?.content || ''
        try {
          let cleaned = String(content).trim()
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
          const start = cleaned.indexOf('{')
          const end = cleaned.lastIndexOf('}')
          const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
          const parsed = JSON.parse(slice)
          return json({ ...parsed, content, model })
        } catch {
          return json({ content, model, raw: data })
        }
      } catch (e) {
        return json({ error: String(e) }, 502)
      }
    }


    if (path === '/ai/recommend' && request.method === 'POST') {
      const key = aiKey(env)
      if (!key) return json({ error: 'AI_KEY missing' }, 500)
      let body
      try { body = await request.json() } catch { return json({ error: 'invalid json' }, 400) }
      const prompt = body.prompt || ''
      if (!prompt) return json({ error: 'missing prompt' }, 400)
      const model = body.model || aiModel(env)
      const endpoint = aiBase(env) + '/v1/chat/completions'
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: '你是中国旅行推荐助手。只输出合法 JSON，不要 markdown。优先真实国内目的地。' },
              { role: 'user', content: prompt + '\n\n只输出 JSON。' },
            ],
            temperature: 0.4,
            max_tokens: 900,
          }),
        })
        const data = await resp.json()
        if (!resp.ok) return json({ error: 'upstream_error', status: resp.status, raw: data }, 502)
        const content = data?.choices?.[0]?.message?.content || ''
        try {
          let cleaned = String(content).trim()
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
          const start = cleaned.indexOf('{')
          const end = cleaned.lastIndexOf('}')
          const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
          const parsed = JSON.parse(slice)
          return json({ ...parsed, content, model, type: body.type || 'recommend' })
        } catch {
          return json({ content, model, raw: data, type: body.type || 'recommend' })
        }
      } catch (e) {
        return json({ error: String(e) }, 502)
      }
    }


    return json({ error: 'not found', path }, 404)
  }
}
