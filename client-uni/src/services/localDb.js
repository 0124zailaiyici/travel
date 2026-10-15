import bundle from '../data/bundle.json'
import { calculateDistance } from './distance.js'

const MONTH_CN = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

const THEME_IDS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']

/**
 * 按主题取本地配图。
 * 原实现用 picsum.photos 随机图兜底，会给出与目的地完全无关的照片
 * （九寨沟显示饺子、西湖显示风力发电机），比没有图更糟。
 * 现在按 theme_ids[0] 取 static/themes 下风格统一的主题图。
 */
function themeImage(d) {
  const tid = (d.theme_ids || [])[0]
  return THEME_IDS.includes(tid) ? ('/static/themes/' + tid + '.jpg') : '/static/themes/t1.jpg'
}

function ensureImage(d) {
  if (!d.image_url || /picsum\.photos/.test(d.image_url)) d.image_url = themeImage(d)
  return d
}

export function getThemes() {
  return clone(bundle.themes || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

export function getHotThemes() {
  return getThemes().slice(0, 10)
}

export function getAllDestinations() {
  return (bundle.destinations || []).map((d) => ensureImage(clone(d)))
}

export function getDestinationById(id) {
  if (!id) return null
  const hit = (bundle.destinations || []).find((d) => d.id === id)
  return hit ? ensureImage(clone(hit)) : null
}

export function getDestinationByName(name) {
  if (!name) return null
  const hit = (bundle.destinations || []).find((d) => d.name === name)
  return hit ? ensureImage(clone(hit)) : null
}

function textOf(d) {
  return [
    d.name,
    d.address,
    d.description,
    ...(d.tags || []),
    ...(d.highlights || []),
    ...(d.theme_ids || []),
  ].join(' ').toLowerCase()
}

function themeMatch(d, themeName) {
  if (!themeName) return true
  const themes = bundle.themes || []
  const t = themes.find((x) => x.id === themeName || x.name === themeName)
  if (!t) return textOf(d).includes(String(themeName).toLowerCase())
  if ((d.theme_ids || []).includes(t.id)) return true
  const kws = [t.name, ...(t.query_keywords || [])].map((x) => String(x).toLowerCase())
  const blob = textOf(d)
  return kws.some((k) => k && blob.includes(k))
}

export function searchLocal({ q = '', theme = '', minRating = 0, maxDuration = 0, city = '' } = {}) {
  const keyword = String(q || '').trim().toLowerCase()
  let list = getAllDestinations()
  if (keyword) {
    // 先尝试整句匹配；整句无结果时按“城市 + 主题”等组合词匹配
    const exact = list.filter((d) => textOf(d).includes(keyword) || themeMatch(d, keyword))
    if (exact.length) {
      list = exact
    } else {
      const themes = bundle.themes || []
      const semanticTokens = []
      for (const themeItem of themes) {
        const words = [themeItem.name, ...(themeItem.query_keywords || [])]
        if (words.some((word) => word && keyword.includes(String(word).toLowerCase()))) {
          semanticTokens.push({ type: 'theme', value: themeItem.id })
        }
      }
      // 去掉识别出的主题词，剩余部分通常是城市/地区/目的地名
      let placeToken = keyword
      for (const themeItem of themes) {
        for (const word of [themeItem.name, ...(themeItem.query_keywords || [])]) {
          if (word) placeToken = placeToken.split(String(word).toLowerCase()).join('')
        }
      }
      placeToken = placeToken.replace(/[\s，,、的去游玩旅行推荐]+/g, '')
      list = list.filter((d) => {
        const placeOk = !placeToken || textOf(d).includes(placeToken)
        const themeOk = !semanticTokens.length || semanticTokens.some((token) => themeMatch(d, token.value))
        return placeOk && themeOk
      })
    }
  }
  if (theme) list = list.filter((d) => themeMatch(d, theme))
  if (minRating) list = list.filter((d) => (d.rating || 0) >= Number(minRating))
  if (maxDuration) list = list.filter((d) => (d.duration || 99) <= Number(maxDuration))
  if (city) list = list.filter((d) => (d.address || '').includes(city))
  return list
}

export function suggestionsLocal(q = '') {
  const keyword = String(q || '').trim().toLowerCase()
  if (!keyword) return []
  return getAllDestinations()
    .filter((d) => (d.name || '').toLowerCase().includes(keyword) || textOf(d).includes(keyword))
    .slice(0, 8)
    .map((d) => ({ id: d.id, name: d.name }))
}

export function inSeasonLocal(month = new Date().getMonth() + 1) {
  const m = Number(month)
  const labels = [MONTH_CN[m], String(m) + '月', String(m)]
  const all = getAllDestinations()
  const matched = all.filter((d) => {
    const s = d.best_season || ''
    if (!s || s.includes('全年')) return true
    return labels.some((lab) => s.includes(lab))
  })
  const scored = matched.map((d) => {
    const s = d.best_season || ''
    const exact = labels.some((lab) => s.includes(lab))
    return { d, score: exact ? 2 : 1, rating: d.rating || 0 }
  })
  scored.sort((a, b) => b.score - a.score || b.rating - a.rating)
  return scored.slice(0, 12).map((x) => x.d)
}

export function attachDistance(list, lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return list.map((d) => ({ ...d, distance: d.distance ?? null }))
  }
  return list.map((d) => ({
    ...d,
    distance: d.distance || calculateDistance(lat, lng, d.lat, d.lng)
  }))
}

export function sortByDistanceOrRating(list, sortBy = 'distance') {
  const arr = [...list]
  if (sortBy === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  else arr.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999))
  return arr
}

export function paginate(list, page = 1, pageSize = 20) {
  const pg = Math.max(1, Number(page) || 1)
  const ps = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const start = (pg - 1) * ps
  return {
    total: list.length,
    page: pg,
    pageSize: ps,
    list: list.slice(start, start + ps),
    hasMore: start + ps < list.length,
  }
}
