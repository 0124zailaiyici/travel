import { httpPost } from './http.js'
import { getProxyBase, hasProxy, getRuntimeConfig, getAiModel } from './config.js'
import { cacheGet, cacheSet, cacheDel } from './cache.js'
import { getAllDestinations, getDestinationByName, attachDistance, sortByDistanceOrRating } from './localDb.js'

function chatEndpoint(base) {
  const clean = String(base || '').replace(/\/$/, '')
  if (/\/chat\/completions$/i.test(clean)) return clean
  if (/\/v1$/i.test(clean)) return clean + '/chat/completions'
  return clean + '/v1/chat/completions'
}

function extractJson(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  const fence = String.fromCharCode(96, 96, 96)
  const cleaned = raw
    .replace(new RegExp('^' + fence + 'json\\s*', 'i'), '')
    .replace(new RegExp('^' + fence + '\\s*', 'i'), '')
    .replace(new RegExp('\\s*' + fence + '$'), '')
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) } catch {}
  }
  return null
}

function monthText() {
  return (new Date().getMonth() + 1) + '月'
}

function catalogBrief(limit = 40) {
  return getAllDestinations().slice(0, limit).map((d) => ({
    id: d.id,
    name: d.name,
    tags: (d.tags || []).slice(0, 3),
    best_season: d.best_season || '全年',
    rating: d.rating || 0,
    address: (d.address || '').slice(0, 24),
  }))
}

function matchLocalByName(name) {
  if (!name) return null
  const all = getAllDestinations()
  const exact = all.find((d) => d.name === name)
  if (exact) return exact
  const soft = all.find((d) => d.name.includes(name) || name.includes(d.name))
  return soft || getDestinationByName(name)
}

function normalizeAiItems(items, loc) {
  const out = []
  for (const it of (items || [])) {
    const name = (it.name || it.title || '').trim()
    if (!name) continue
    const local = matchLocalByName(name)
    if (local) {
      out.push({
        ...local,
        ai_reason: it.reason || it.why || '',
        ai_matched: true,
        source: local.source || 'curated',
        description: it.reason || local.description || '',
      })
    } else {
      out.push({
        id: 'ai_' + name,
        name,
        lat: Number.isFinite(Number(it.lat)) && Number(it.lat) !== 0 ? Number(it.lat) : null,
        lng: Number.isFinite(Number(it.lng)) && Number(it.lng) !== 0 ? Number(it.lng) : null,
        address: it.address || it.city || '',
        rating: Number(it.rating) || 0,
        best_season: it.best_season || '全年',
        description: it.reason || it.description || 'AI 推荐',
        tags: it.tags || ['AI推荐'],
        image_url: '',
        duration: Number(it.duration) || 1,
        highlights: it.highlights || [],
        themeIcon: '✨',
        ai_reason: it.reason || '',
        ai_matched: false,
        source: 'ai',
      })
    }
  }
  return attachDistance(out, loc?.lat, loc?.lng)
}

async function callDirectAi(prompt) {
  const cfg = getRuntimeConfig()
  const key = cfg.deepseekKey
  if (!key) return null
  const base = (cfg.deepseekBase || 'https://sub2api.zailaiyici.xyz').replace(/\/$/, '')
  const data = await httpPost(chatEndpoint(base), {
    model: getAiModel(),
    messages: [
      { role: 'system', content: '你是中国旅行推荐助手，只输出合法 JSON，不要 markdown。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 900,
  }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key,
  }, 45000)
  return { content: data?.choices?.[0]?.message?.content || '' }
}

async function callRecommend(payload) {
  const cfg = getRuntimeConfig()
  // 用户自定义 Key 优先直连
  if (cfg.deepseekKey) {
    return callDirectAi(payload.prompt)
  }
  if (!hasProxy()) throw new Error('no_proxy')
  let lastErr = null
  for (let i = 0; i < 2; i++) {
    try {
      return await httpPost(getProxyBase() + '/ai/recommend', payload, { 'Content-Type': 'application/json' }, 45000)
    } catch (e) {
      lastErr = e
      // 短等后重试一次
      await new Promise((r) => setTimeout(r, 600 + i * 800))
    }
  }
  throw lastErr || new Error('ai_recommend_fail')
}

/**
 * AI 增强搜索
 * @param {{ q:string, loc?:object, localList?:array, force?:boolean }} opts
 */
export async function aiEnhanceSearch({ q, loc, localList = [], force = false } = {}) {
  const query = String(q || '').trim()
  if (!query) return { list: localList, summary: '', provider: 'local' }

  const ck = 'ai_search_' + query + '_' + (loc?.lat ? Number(loc.lat).toFixed(1) : '') + '_' + (loc?.lng ? Number(loc.lng).toFixed(1) : '')
  if (force) cacheDel('ai_rec', ck)
  else {
    const cached = cacheGet('ai_rec', ck, 12 * 60 * 60 * 1000)
    if (cached) return cached
  }

  const localNames = (localList || []).slice(0, 12).map((d) => d.name)
  const prompt = [
    '你是中国旅行推荐助手。根据搜索词推荐真实可去的目的地。',
    '搜索词：' + query,
    '当前月份：' + monthText(),
    '用户位置：' + (loc?.lat || '未知') + ',' + (loc?.lng || '未知'),
    '本地已有：' + (localNames.join('、') || '无'),
    '',
    '只输出 JSON：',
    '{',
    '  "summary": "一句话总结",',
    '  "items": [',
    '    {"name":"地点名","reason":"20字内理由","city":"城市","tags":["标签"],"best_season":"季节"}',
    '  ]',
    '}',
    '规则：',
    '1) 8-10 个推荐',
    '2) 优先真实国内目的地',
    '3) 尽量覆盖搜索意图',
    '4) 只输出 JSON，不要 markdown',
  ].join('\n')

  try {
    const data = await callRecommend({
      type: 'search',
      query,
      month: monthText(),
      lat: loc?.lat,
      lng: loc?.lng,
      localNames,
      catalog: catalogBrief(40),
      force,
      model: getAiModel(),
      prompt,
    })
    const parsed = data?.items ? data : extractJson(data?.content || '')
    const items = normalizeAiItems(parsed?.items || [], loc)
    const map = new Map()
    for (const d of items) map.set(d.name, d)
    for (const d of localList) {
      if (!map.has(d.name)) map.set(d.name, d)
      else map.set(d.name, { ...d, ...map.get(d.name), ai_matched: true })
    }
    let merged = [...map.values()]
    const order = new Map((parsed?.items || []).map((it, i) => [(it.name || it.title || '').trim(), i]))
    merged.sort((a, b) => {
      const aiA = order.has(a.name) ? order.get(a.name) : 999
      const aiB = order.has(b.name) ? order.get(b.name) : 999
      if (aiA !== aiB) return aiA - aiB
      return (b.rating || 0) - (a.rating || 0)
    })
    const result = {
      list: merged,
      summary: parsed?.summary || data?.summary || '',
      provider: 'ai',
    }
    cacheSet('ai_rec', ck, result)
    return result
  } catch (e) {
    console.error('aiEnhanceSearch fail', e)
    const msg = (e && (e.message || e.errMsg)) ? String(e.message || e.errMsg) : 'unknown'
    return {
      list: localList,
      summary: 'AI 暂时失败：' + msg.slice(0, 40) + '（可点刷新重试）',
      provider: 'local',
      error: msg,
    }
  }
}

/**
 * AI 增强附近推荐
 */
export async function aiEnhanceNearby({ loc, localList = [], force = false } = {}) {
  if (!loc?.lat || !loc?.lng) return { list: localList, summary: '', provider: 'local' }
  const ck = 'ai_nearby_' + Number(loc.lat).toFixed(1) + '_' + Number(loc.lng).toFixed(1)
  if (force) cacheDel('ai_rec', ck)
  else {
    const cached = cacheGet('ai_rec', ck, 6 * 60 * 60 * 1000)
    if (cached) return cached
  }

  const localNames = (localList || []).slice(0, 12).map((d) => d.name)
  const prompt = [
    '你是中国旅行推荐助手。根据用户坐标推荐附近可去目的地。',
    '坐标：' + loc.lat + ',' + loc.lng,
    '月份：' + monthText(),
    '本地已有：' + (localNames.join('、') || '无'),
    '',
    '只输出 JSON：',
    '{',
    '  "summary": "一句话总结",',
    '  "city": "推断城市",',
    '  "items": [',
    '    {"name":"地点","reason":"理由","tags":["标签"],"best_season":"季节"}',
    '  ]',
    '}',
    '输出 8-10 个附近推荐，只输出 JSON。',
  ].join('\n')

  try {
    const data = await callRecommend({
      type: 'nearby',
      lat: loc.lat,
      lng: loc.lng,
      month: monthText(),
      localNames,
      catalog: catalogBrief(40),
      force,
      model: getAiModel(),
      prompt,
    })
    const parsed = data?.items ? data : extractJson(data?.content || '')
    const aiItems = normalizeAiItems(parsed?.items || [], loc)
    const merged = sortByDistanceOrRating(
      [...(localList || []), ...aiItems.filter((x) => !(localList || []).some((l) => l.name === x.name))],
      'distance'
    )
    const result = {
      list: merged.slice(0, 20),
      summary: parsed?.summary || data?.summary || '',
      city: parsed?.city || data?.city || '',
      provider: 'ai',
    }
    cacheSet('ai_rec', ck, result)
    return result
  } catch (e) {
    console.error('aiEnhanceNearby fail', e)
    return { list: localList, summary: '', provider: 'local' }
  }
}
