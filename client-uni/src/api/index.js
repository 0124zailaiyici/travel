import {
  getHotThemes as localHotThemes,
  getThemes as localAllThemes,
  searchLocal,
  suggestionsLocal,
  inSeasonLocal,
  getDestinationById,
  getAllDestinations,
  attachDistance,
  sortByDistanceOrRating,
  paginate,
} from '../services/localDb.js'
import { searchPOI, searchAround, getPOIDetail, getDrivingRoute, getTransitRoute } from '../services/map.js'
import { getWeather } from '../services/weather.js'
import { generateItinerary } from '../services/deepseek.js'
import { aiEnhanceSearch, aiEnhanceNearby } from '../services/aiRecommend.js'
import { calculateDistance } from '../services/distance.js'
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js'
import {
  getFavoriteIds,
  toggleFavorite,
  listFavoriteDests,
  postHistory as storeHistory,
  listHistoryDests,
  cacheDestination,
  getCachedDestination,
  getComments as localGetComments,
  postComment as localPostComment,
  deleteComment as localDeleteComment,
} from '../services/userStore.js'

function uniqByName(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = (item.name || item.id || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function withTimeout(promise, ms, fallback = null) {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      resolve(fallback)
    }, ms)
    Promise.resolve(promise).then((v) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(v)
    }).catch(() => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(fallback)
    })
  })
}

function localNearby(loc) {
  const lat = loc?.lat
  const lng = loc?.lng
  // 无定位时退化为「热门推荐」：按评分取前 8。
  // 原实现是 getAllDestinations().slice(0, 8)，即 bundle 原始顺序，
  // 结果既不「附近」也不「热门」（武汉大学/玉渊潭/鼋头渚/玉龙雪山/长白山…）。
  if (lat == null || lng == null) return sortByDistanceOrRating(getAllDestinations(), 'rating').slice(0, 8)
  return sortByDistanceOrRating(attachDistance(getAllDestinations(), lat, lng), 'distance').slice(0, 12)
}

async function enrichNearby(loc, { force = false } = {}) {
  const lat = loc?.lat
  const lng = loc?.lng
  if (lat == null || lng == null) return localNearby(loc)
  const ck = 'nb_' + Number(lat).toFixed(2) + '_' + Number(lng).toFixed(2)
  if (force) cacheDel('nearby', ck)
  else {
    const cached = cacheGet('nearby', ck, 15 * 60 * 1000)
    if (cached) return cached
  }
  const local = localNearby(loc)
  const pois = await withTimeout(searchAround(lat, lng, 50000), 4500, [])
  let merged = local
  if (pois?.length) {
    merged = sortByDistanceOrRating(uniqByName([...local, ...attachDistance(pois, lat, lng)]), 'distance').slice(0, 20)
  } else {
    // 地图额度满时，用 AI 补附近推荐
    const aiRes = await withTimeout(aiEnhanceNearby({ loc, localList: local, force }), 95000, null)
    if (aiRes?.list?.length) merged = aiRes.list.slice(0, 20)
  }
  cacheSet('nearby', ck, merged)
  return merged
}

function buildDetailFast(id, loc) {
  let dest = getDestinationById(id)
  if (!dest) dest = getCachedDestination(id)
  if (!dest) return null

  const lat = loc?.lat
  const lng = loc?.lng
  const distance = (lat != null && lng != null)
    ? calculateDistance(lat, lng, dest.lat, dest.lng)
    : (dest.distance ?? null)

  let itinerary = dest.itinerary || []
  let tips = dest.tips || []
  let budget = dest.budget || {}
  let transportDetail = dest.transportDetail || null
  let generating = false

  const cachedAi = cacheGet('detail_ai', dest.id, 7 * 24 * 60 * 60 * 1000)
  if (cachedAi?.itinerary?.length && !cachedAi._fallback) {
    itinerary = cachedAi.itinerary
    // 必须按「有没有内容」判断，不能用 truthiness：
    // 空数组和空对象在 JS 里都是真值，会把目的地自带的 tips / transportDetail
    // 覆盖成空 —— 结果就是「避坑指南」整块消失、「交通方案」渲染成空白。
    // AI 归一化那边 normalizeTips(undefined) 正好产出 []，transport 也可能为 {}。
    if (Array.isArray(cachedAi.tips) && cachedAi.tips.length) tips = cachedAi.tips
    if (cachedAi.budget && Object.keys(cachedAi.budget).length) budget = cachedAi.budget
    const aiTransport = cachedAi.transport
    if (aiTransport && (aiTransport.to_destination || aiTransport.around || aiTransport.parking)) {
      transportDetail = aiTransport
    }
    generating = false
  } else if (!itinerary.length) {
    generating = true
    const fbDays = Math.max(1, Number(dest.duration) || 2)
    const from = loc?.city || loc?.address || (lat != null ? '你的位置' : '出发地')
    itinerary = Array.from({ length: fbDays }).map((_, i) => ({
      title: dest.name + ' 深度游 Day' + (i + 1),
      morning: '上午抵达并游览' + dest.name + '核心景点。',
      afternoon: '下午继续周边体验，结合当地特色安排。',
      evening: '晚上轻餐饮与夜景，适度放松。',
      meals: ['当地特色餐厅'],
    }))
    if (!tips.length) tips = ['出行前查看天气与开放时间', '热门时段建议提前预约']
    if (!transportDetail) {
      transportDetail = {
        to_destination: dest.transport_guide || ('从' + from + '出发前往' + dest.name + '，优先高铁/自驾。'),
        around: '景区内步行+短途打车/公交。',
      }
    }
  }

  const detail = {
    ...dest,
    distance,
    itinerary,
    tips,
    budget,
    transportDetail,
    weather: null,
    route: null,
    generating,
    themes: (dest.theme_ids || []).map((tid) => ({ tid })),
    userRating: null,
    userRatingCount: 0,
  }
  cacheDestination(detail)
  return detail
}

async function enrichDetail(detail, loc, { force = false } = {}) {
  if (!detail) return null
  const lat = loc?.lat
  const lng = loc?.lng

  // 距离同样依赖位置。调用方可能先不带位置秒开（定位还没回来），
  // 等定位到了再调这里增强——所以距离必须在这里补，否则页面会一直显示 ?km。
  if (lat != null && lng != null && detail.lat != null && detail.lng != null) {
    detail.distance = calculateDistance(lat, lng, detail.lat, detail.lng)
  }

  const tasks = []

  // AI 行程：无行程 / 模板 / 强制刷新时生成；带上用户位置
  if (force || detail.generating || !(detail.itinerary || []).length) {
    detail.generating = true
    tasks.push((async () => {
      try {
        const gen = await withTimeout(generateItinerary(detail, { userLoc: loc, force }), 50000, null)
        if (gen?.itinerary?.length) {
          detail.itinerary = gen.itinerary
          // 同 buildDetailFast：AI 归一化会给空的 tips/budget/transport，
          // 用 truthiness 判断会被空数组/空对象覆盖掉已有内容。
          if (Array.isArray(gen.tips) && gen.tips.length) detail.tips = gen.tips
          if (gen.budget && Object.keys(gen.budget).length) detail.budget = gen.budget
          const gt = gen.transport
          if (gt && (gt.to_destination || gt.around || gt.parking)) detail.transportDetail = gt
          detail.generating = !!gen._fallback
          if (!gen._fallback) cacheSet('detail_ai', detail.id, gen)
        } else {
          detail.generating = false
        }
      } catch {
        detail.generating = false
      }
    })())
  }

  tasks.push((async () => {
    detail.weather = await withTimeout(getWeather(detail.lat, detail.lng), 4000, null)
  })())

  if (lat != null && lng != null) {
    tasks.push((async () => {
      const [driving, transit] = await Promise.all([
        withTimeout(getDrivingRoute(lat, lng, detail.lat, detail.lng), 4500, null),
        withTimeout(getTransitRoute(lat, lng, detail.lat, detail.lng), 4500, null),
      ])
      detail.route = (driving || transit) ? { driving, transit } : null
    })())
  }

  await Promise.all(tasks)
  cacheDestination(detail)
  return detail
}

export const api = {
  getHotThemes: async () => localHotThemes(),
  getAllThemes: async () => localAllThemes(),
  getSuggestions: async (q) => suggestionsLocal(q),
  getInSeason: async () => inSeasonLocal(),

  // 本地秒开 + 可选实时 POI + AI
  searchDestinations: async (params, page = 1) => {
    let query = params
    if (typeof params === 'string' || !params) {
      query = { q: typeof params === 'string' ? params : '', page, pageSize: 20 }
    }
    const {
      q = '', city = '', lat, lng, theme = '', minRating = 0, maxDuration = 0,
      sort = 'distance', page: pg = page, pageSize = 20, realtime = true, ai = false, force = false,
    } = query

    const local = searchLocal({ q, theme, minRating, maxDuration, city })
    let merged = attachDistance(local, lat, lng)
    let summary = ''
    let provider = 'local'

    // 实时地图 POI
    if (realtime && String(q || '').trim() && Number(pg) === 1) {
      // 只传真正的城市名和坐标。原来传的是 city || q，等于把搜索词当城市名，
      // 边界变成 region(公园,0) —— 无效，永远 0 条，还白烧配额。
      const pois = await withTimeout(searchPOI(String(q).trim(), city, 20, { lat, lng }), 4500, [])
      if (pois?.length) {
        merged = uniqByName([...merged, ...attachDistance(pois, lat, lng)])
        provider = 'map'
      }
    }

    // AI 增强
    if (ai && String(q || '').trim() && Number(pg) === 1) {
      const aiRes = await withTimeout(aiEnhanceSearch({
        q,
        loc: { lat, lng },
        localList: merged,
        force,
      }), 95000, null)
      if (aiRes?.list?.length) {
        merged = aiRes.list
        summary = aiRes.summary || ''
        provider = aiRes.provider || 'ai'
      }
    }

    merged = sortByDistanceOrRating(merged, sort)
    // 缓存地图/AI 动态结果，进入详情页时保留地址、坐标和推荐理由
    merged.forEach((d) => {
      if (d?.id && (d.source === 'ai' || d.provider || String(d.id).startsWith('poi_'))) cacheDestination(d)
    })
    const pageData = paginate(merged, pg, pageSize)
    return { ...pageData, summary, provider }
  },

  getNearbyFast: async (loc) => localNearby(loc),
  getNearby: async (loc, opts) => enrichNearby(loc, opts || {}),

  getDetailFast: async (id, loc) => {
    const fast = buildDetailFast(id, loc)
    if (fast) return fast
    if (String(id).startsWith('poi_') || String(id).startsWith('amap_') || String(id).startsWith('bd_') || String(id).startsWith('ai_')) {
      // AI 推荐点可能没有 POI 详情，尽量用缓存
      const cached = getCachedDestination(id)
      if (cached) return buildDetailFast(cached.id, loc) || cached
      if (String(id).startsWith('ai_')) {
        return {
          id,
          name: String(id).replace(/^ai_/, ''),
          lat: null,
          lng: null,
          address: '',
          rating: 0,
          description: 'AI 推荐目的地',
          itinerary: [],
          tips: [],
          budget: {},
          weather: null,
          route: null,
          generating: true,
          themeIcon: '✨',
          source: 'ai',
        }
      }
      const dest = await withTimeout(getPOIDetail(id), 4500, null)
      if (!dest) return null
      cacheDestination(dest)
      return buildDetailFast(dest.id, loc) || {
        ...dest,
        itinerary: [],
        tips: [],
        budget: {},
        weather: null,
        route: null,
        generating: true,
      }
    }
    return null
  },

  enrichDetail: async (detail, loc, opts) => enrichDetail(detail, loc, opts || {}),

  // 强制按用户位置刷新行程/交通
  refreshItinerary: async (detail, loc) => {
    if (!detail) return null
    detail.generating = true
    const gen = await withTimeout(generateItinerary(detail, { userLoc: loc, force: true }), 50000, null)
    if (gen?.itinerary?.length) {
      detail.itinerary = gen.itinerary
      // 同 buildDetailFast / enrichDetail：空数组、空对象都是真值，不能用来判断
      if (Array.isArray(gen.tips) && gen.tips.length) detail.tips = gen.tips
      if (gen.budget && Object.keys(gen.budget).length) detail.budget = gen.budget
      const gt = gen.transport
      if (gt && (gt.to_destination || gt.around || gt.parking)) detail.transportDetail = gt
      detail.generating = !!gen._fallback
      if (!gen._fallback) cacheSet('detail_ai', detail.id, gen)
    } else {
      detail.generating = false
    }
    // 同时刷新实时路线与距离（位置可能已经变了）
    if (loc?.lat != null && loc?.lng != null && detail.lat && detail.lng) {
      detail.distance = calculateDistance(loc.lat, loc.lng, detail.lat, detail.lng)
      const [driving, transit] = await Promise.all([
        withTimeout(getDrivingRoute(loc.lat, loc.lng, detail.lat, detail.lng), 4500, null),
        withTimeout(getTransitRoute(loc.lat, loc.lng, detail.lat, detail.lng), 4500, null),
      ])
      detail.route = (driving || transit) ? { driving, transit } : detail.route
    }
    cacheDestination(detail)
    return detail
  },

  getDetail: async (id, loc) => {
    const fast = await api.getDetailFast(id, loc)
    if (!fast) throw new Error('not found')
    return enrichDetail(fast, loc)
  },

  getFavorites: async (ids) => {
    const arr = Array.isArray(ids) ? ids : String(ids || '').split(',').filter(Boolean)
    return arr.map((id) => getDestinationById(id) || getCachedDestination(id)).filter(Boolean)
  },

  syncGetFavs: async (uid) => {
    const ids = getFavoriteIds(uid)
    const fromStore = listFavoriteDests(uid)
    const map = new Map(fromStore.map((d) => [d.id, d]))
    for (const id of ids) {
      if (!map.has(id)) {
        const d = getDestinationById(id) || getCachedDestination(id)
        if (d) map.set(id, d)
      }
    }
    return ids.map((id) => map.get(id)).filter(Boolean)
  },

  syncToggleFav: async (uid, destId) => {
    const dest = getDestinationById(destId) || getCachedDestination(destId)
    return toggleFavorite(uid, destId, dest)
  },

  postHistory: async (openid, destId) => {
    const dest = getDestinationById(destId) || getCachedDestination(destId)
    storeHistory(openid, destId, dest)
    return { success: true }
  },

  getHistory: async (openid) => listHistoryDests(openid),
  getComments: async (destId, page) => localGetComments(destId, page || 1),
  postComment: async (data) => localPostComment(data),
  deleteComment: async (id, openid, destId) => {
    if (destId) return localDeleteComment(id, openid, destId)
    return { success: false, error: 'missing destId' }
  },
  uploadImage: async (filePath) => filePath || null,
}

export default api
