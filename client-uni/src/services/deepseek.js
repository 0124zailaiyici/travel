import { httpPost, completionContent } from './http.js'
import { getRuntimeConfig, getAiModel } from './config.js'
import { cacheGet, cacheSet, cacheDel } from './cache.js'

function chatEndpoint(base) {
  const clean = String(base || '').replace(/\/$/, '')
  if (/\/chat\/completions$/i.test(clean)) return clean
  if (/\/v1$/i.test(clean)) return clean + '/chat/completions'
  return clean + '/v1/chat/completions'
}

function locKey(userLoc) {
  if (!userLoc || userLoc.lat == null || userLoc.lng == null) return 'noloc'
  return Number(userLoc.lat).toFixed(2) + '_' + Number(userLoc.lng).toFixed(2)
}

function cacheId(destination, userLoc) {
  const id = destination?.id || destination?.name || 'unknown'
  return id + '__' + locKey(userLoc)
}

function fallbackItinerary(destination, userLoc) {
  const days = Math.max(1, Number(destination.duration) || 2)
  const name = destination.name || '目的地'
  const from = userLoc?.city || userLoc?.address || (userLoc?.lat != null ? '你的位置' : '出发地')
  const itinerary = []
  for (let i = 1; i <= days; i++) {
    itinerary.push({
      title: name + ' 深度游 Day' + i,
      morning: '上午抵达并游览' + name + '核心景点，先熟悉环境和动线。',
      afternoon: '下午继续周边打卡，结合当地特色体验，注意留出休息时间。',
      evening: '晚上可安排轻餐饮与夜景/夜市，适度放松。',
      meals: ['当地特色餐厅', '小吃街'],
    })
  }
  return {
    itinerary,
    tips: [
      '出行前查看天气与开放时间',
      '热门时段建议提前预约门票',
      '随身带充电宝与防晒/雨具',
    ],
    budget: {
      transport: 100,
      ticket: 80,
      food: 120,
      hotel: days > 1 ? 250 : 0,
    },
    transport: {
      to_destination: destination.transport_guide
        || ('从' + from + '出发前往' + name + '，优先高铁/自驾，落地后转地铁或打车。'),
      around: '景区内以步行+短途打车/公交为主，热门点之间可提前查路线。',
    },
    _fallback: true,
  }
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

function normalizeTips(tips) {
  if (Array.isArray(tips)) return tips.map((x) => String(x || '').trim()).filter(Boolean)
  if (typeof tips === 'string') {
    return tips.split(/[\n；;。]+/).map((x) => x.trim()).filter(Boolean)
  }
  return []
}

function parseMoney(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const nums = String(value || '').match(/\d+(?:\.\d+)?/g)
  if (!nums?.length) return 0
  // 区间取均值，单值直接使用
  if (nums.length >= 2) return Math.round((Number(nums[0]) + Number(nums[1])) / 2)
  return Number(nums[0]) || 0
}

function normalizeBudget(budget) {
  if (!budget) return {}
  if (typeof budget === 'object' && !Array.isArray(budget)) {
    const out = {}
    Object.entries(budget).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        out[key] = { ...value, total: parseMoney(value.total ?? value.cost ?? 0) }
      } else {
        out[key] = parseMoney(value)
      }
    })
    return out
  }
  if (typeof budget === 'string') {
    const total = parseMoney(budget)
    return total ? { other: { total, items: [{ name: budget, cost: total }] } } : {}
  }
  return {}
}

function normalizeGen(gen, destination, userLoc) {
  if (!gen || typeof gen !== 'object') return fallbackItinerary(destination, userLoc)
  let days = gen.itinerary
  // 兼容：数组 / 单日对象 / 以 day1/day2 为键的对象
  if (days && !Array.isArray(days)) {
    if (days.title || days.morning || days.afternoon || days.evening) {
      days = [days]
    } else {
      days = Object.values(days).filter((d) => d && typeof d === 'object')
    }
  }
  if (!Array.isArray(days) || !days.length) return fallbackItinerary(destination, userLoc)
  return {
    itinerary: days.map((d) => ({
      title: d.title || '',
      morning: d.morning || '',
      afternoon: d.afternoon || '',
      evening: d.evening || '',
      meals: Array.isArray(d.meals) ? d.meals : (d.meals ? [d.meals] : []),
    })),
    tips: normalizeTips(gen.tips),
    budget: normalizeBudget(gen.budget),
    transport: gen.transport || null,
    _fallback: !!gen._fallback,
  }
}

function buildPrompt(destination, userLoc) {
  const days = destination.duration || 2
  const fromText = userLoc?.city
    || userLoc?.address
    || (userLoc?.lat != null ? ('坐标' + Number(userLoc.lat).toFixed(3) + ',' + Number(userLoc.lng).toFixed(3)) : '未知出发地')
  const distText = (destination.distance != null && destination.distance !== '')
    ? (Number(destination.distance).toFixed(1) + 'km')
    : '未知'
  return [
    '你是中国旅行规划助手。请基于用户真实位置，为目的地生成可执行行程。',
    '',
    '目的地：' + (destination.name || ''),
    '地址：' + (destination.address || ''),
    '亮点：' + ((destination.highlights || []).join('、') || '无'),
    '最佳季节：' + (destination.best_season || '全年'),
    '建议天数：' + days + '天',
    '用户出发地：' + fromText,
    '距用户约：' + distText,
    '',
    '请严格输出 JSON，字段：',
    '1. itinerary: 数组，每天含 title/morning/afternoon/evening/meals',
    '2. transport: 对象，含 to_destination（必须结合用户出发地）和 around',
    '3. tips: 3-6条实用建议',
    '4. budget: transport/ticket/food/hotel 数字（人均元）',
    '',
    '要求：只输出 JSON，不要 markdown，不要解释；交通方案必须按用户出发地写，不要写死无关城市。',
  ].join('\n')
}

async function callDirectAi(prompt) {
  const cfg = getRuntimeConfig()
  const key = cfg.deepseekKey
  if (!key) return null
  const base = (cfg.deepseekBase || 'https://api.deepseek.com').replace(/\/$/, '')
  const model = getAiModel()
  const data = await httpPost(chatEndpoint(base), {
    model,
    messages: [
      { role: 'system', content: '你是旅行规划助手，只输出合法 JSON，不要 markdown 代码块。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    // 4000 而不是 1400：推理模型（如 deepseek-v4.1-flash，ClinePass 上就是）
    // 会先花 2000+ token 思考，额度给小了会直接返回 HTTP 500
    // {"error":"empty response content"} —— 看起来像网络故障，实际是 token 不够。
    // 非推理模型（deepseek-chat）给 4000 也只是「允许更长输出」，没有副作用。
    max_tokens: 4000,
  }, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key,
  }, 60000)
  return completionContent(data)
}

export async function generateItinerary(destination, options = {}) {
  const userLoc = options.userLoc || null
  const force = !!options.force
  const id = cacheId(destination, userLoc)
  const ttl = (getRuntimeConfig().aiCacheDays || 7) * 24 * 60 * 60 * 1000

  if (force) {
    cacheDel('ai', id)
    cacheDel('detail_ai', destination?.id || id)
  } else {
    const cached = cacheGet('ai', id, ttl) || cacheGet('detail_ai', destination?.id || '', ttl)
    if (cached && !cached._fallback) return cached
  }

  const prompt = buildPrompt(destination, userLoc)

  try {
    const cfg = getRuntimeConfig()
    // 直连 AI。Worker 代理已移除：workers.dev 在国内手机网络不可达。
    if (!cfg.deepseekKey) return fallbackItinerary(destination, userLoc)
    const content = await callDirectAi(prompt)

    const parsed = extractJson(content)
    if (!parsed) throw new Error('ai json parse fail')
    const normalized = normalizeGen(parsed, destination, userLoc)
    if (!normalized._fallback) {
      cacheSet('ai', id, normalized)
      cacheSet('detail_ai', destination?.id || id, normalized)
    }
    return normalized
  } catch (e) {
    console.error('generateItinerary fail', e)
    return fallbackItinerary(destination, userLoc)
  }
}
