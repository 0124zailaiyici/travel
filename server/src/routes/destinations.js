import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../models/db.js'
import { searchPOI, searchAround, getPOIDetail, getCityFromCoords, getDrivingRoute, getTransitRoute } from '../services/tencent.js'
import { generateItinerary } from '../services/deepseek.js'
import { calculateDistance } from '../utils/distance.js'
import { getWeather } from '../services/weather.js'
import { getLocationByIP } from '../services/iplocation.js'
import NodeCache from 'node-cache'

const router = Router()
const itineraryCache = new NodeCache({ stdTTL: 604800 })
const routeCache = new NodeCache({ stdTTL: 86400 })

const emojiMap = {
  't1':'🌸','t2':'🏔️','t3':'🏖️','t4':'🍁','t5':'🦀',
  't6':'🎆','t7':'🏯','t8':'⛺','t9':'♨️','t10':'🌻'
}

function addImageUrl(d) {
  if (!d.image_url) {
    d.image_url = `https://picsum.photos/seed/${d.id || d.name}/400/300`
  }
  return d
}

function parseDest(d) {
  return { ...d, highlights: JSON.parse(d.highlights || '[]'), tags: JSON.parse(d.tags || '[]') }
}

router.get('/suggestions', (req, res) => {
  const { q = '' } = req.query
  if (!q.trim()) return res.json([])
  const db = getDb()
  const rows = db.prepare(`SELECT id, name FROM destinations WHERE name LIKE ? OR tags LIKE ? LIMIT 8`).all(`%${q}%`, `%${q}%`)
  res.json(rows)
})

router.get('/search', async (req, res) => {
  const { q = '', city = '', lat, lng, theme, minRating, maxDuration, sort: sortBy = 'distance', page = 1, pageSize = 20 } = req.query
  const db = getDb()
  const keyword = q.trim()
  const pg = Math.max(1, parseInt(page))
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 20))

  let sql = 'SELECT DISTINCT d.* FROM destinations d'
  const params = []
  const wheres = []
  if (keyword) {
    sql += ' LEFT JOIN destination_themes dt ON d.id = dt.destination_id LEFT JOIN themes t ON dt.theme_id = t.id'
    wheres.push('(d.name LIKE ? OR d.description LIKE ? OR d.tags LIKE ? OR t.name LIKE ? OR t.query_keywords LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (theme) {
    sql += ' LEFT JOIN destination_themes dt2 ON d.id = dt2.destination_id'
    wheres.push('dt2.theme_id = ?')
    params.push(theme)
  }
  if (minRating) {
    wheres.push('d.rating >= ?')
    params.push(parseFloat(minRating))
  }
  if (maxDuration) {
    wheres.push('d.duration <= ?')
    params.push(parseInt(maxDuration))
  }
  if (city) {
    wheres.push('d.address LIKE ?')
    params.push(`%${city}%`)
  }
  const limit = keyword || theme ? 50 : 20
  let localResults, total
  if (wheres.length) {
    const countSql = sql.replace('SELECT DISTINCT d.*', 'SELECT COUNT(DISTINCT d.id)')
    total = db.prepare(countSql + ' WHERE ' + wheres.join(' AND ')).get(...params)['COUNT(DISTINCT d.id)']
    localResults = db.prepare(`${sql} WHERE ${wheres.join(' AND ')} LIMIT ? OFFSET ?`).all(...params, ps, (pg - 1) * ps)
  } else {
    total = db.prepare('SELECT COUNT(*) as c FROM destinations').get().c
    localResults = db.prepare('SELECT * FROM destinations ORDER BY rating DESC LIMIT ? OFFSET ?').all(ps, (pg - 1) * ps)
  }

  const userLat2 = parseFloat(lat), userLng2 = parseFloat(lng)
  const hasLoc2 = !isNaN(userLat2) && !isNaN(userLng2)
  let results = localResults.map(parseDest).map(d => ({
    ...d, distance: hasLoc2 ? calculateDistance(userLat2, userLng2, d.lat, d.lng) : null
  }))

  // Tencent POI supplement (only on page 1)
  if (keyword && pg === 1) {
    try {
      const apiPois = await searchPOI(keyword, city || keyword)
      const seen = new Set(results.map(d => d.name))
      for (const p of apiPois) {
        if (!seen.has(p.name)) {
          results.push({ ...p, distance: hasLoc2 ? calculateDistance(userLat2, userLng2, p.lat, p.lng) : null })
          seen.add(p.name)
        }
      }
      total += apiPois.filter(p => !results.some(r => r.name === p.name)).length
    } catch {}
  }

  if (sortBy === 'rating') {
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  } else {
    results.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999))
  }
  res.json({ total, page: pg, list: results.map(addImageUrl) })
})

router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query
  const userLat = parseFloat(lat), userLng = parseFloat(lng)
  const hasLoc = !isNaN(userLat) && !isNaN(userLng)
  const db = getDb()

  if (!hasLoc) {
    const dests = db.prepare('SELECT * FROM destinations LIMIT 6').all()
    return res.json(dests.map(parseDest).map(addImageUrl))
  }

  // local curated data sorted by distance
  const dests = db.prepare('SELECT * FROM destinations').all()
  const local = dests.map(parseDest).map(d => ({
    ...d, distance: calculateDistance(userLat, userLng, d.lat, d.lng), source: 'curated'
  })).filter(d => d.distance !== null).sort((a, b) => a.distance - b.distance)

  // nearby POIs from map API
  let apiPois = []
  try { apiPois = await searchAround(userLat, userLng) }
  catch (e) { console.error('Nearby search error:', e.message) }

  // curated within 200km, then API to fill
  const result = []
  const names = new Set()
  for (const d of local) {
    if (result.length >= 20 || d.distance > 200) break
    result.push(d); names.add(d.name)
  }
  for (const p of apiPois) {
    if (result.length >= 20) break
    if (!names.has(p.name)) { result.push(p); names.add(p.name); p.source = 'api' }
  }

  res.json(result.map(addImageUrl))
})

router.get('/in-season', (req, res) => {
  const month = new Date().getMonth() + 1
  const db = getDb()
  const themes = db.prepare('SELECT * FROM themes').all()
  const matched = themes.filter(t => {
    if (!t.season || t.season === '全年') return true
    const seasons = t.season.match(/\d+/g)
    if (!seasons) return true
    for (let i = 0; i < seasons.length; i += 2) {
      const start = parseInt(seasons[i]), end = parseInt(seasons[i + 1] || seasons[i])
      if (start <= end ? (month >= start && month <= end) : (month >= start || month <= end)) return true
    }
    return false
  }).slice(0, 3)
  const dests = db.prepare(`SELECT DISTINCT d.* FROM destinations d
    JOIN destination_themes dt ON d.id = dt.destination_id
    WHERE dt.theme_id IN (${matched.map(t => "'" + t.id + "'").join(',') || "'null'"} )
    LIMIT 6`).all()
  res.json(dests.map(parseDest).map(addImageUrl))
})

router.get('/auto-location', async (req, res) => {
  const ipLoc = await getLocationByIP()
  res.json({ ...ipLoc, city: ipLoc?.city || '' })
})

router.get('/batch', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean)
  if (!ids.length) return res.json([])
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  const dests = db.prepare(`SELECT * FROM destinations WHERE id IN (${placeholders})`).all(...ids)
  res.json(dests.map(parseDest).map(addImageUrl))
})

router.get('/:id', async (req, res) => {
  const { lat, lng } = req.query
  const db = getDb()
  let dest = db.prepare('SELECT * FROM destinations WHERE id = ?').get(req.params.id)
  if (!dest) {
    const amapPOI = await getPOIDetail(req.params.id)
    if (!amapPOI) return res.status(404).json({ error: '目的地不存在' })
    dest = amapPOI
  }
  const highlights = Array.isArray(dest.highlights) ? dest.highlights : JSON.parse(dest.highlights || '[]')
  const tags = Array.isArray(dest.tags) ? dest.tags : JSON.parse(dest.tags || '[]')
  const themes = dest.id?.startsWith('d') ? db.prepare('SELECT t.*, t.id as tid FROM themes t JOIN destination_themes dt ON t.id = dt.theme_id WHERE dt.destination_id = ?').all(dest.id) : []
  const ulat = parseFloat(lat), ulng = parseFloat(lng)
  const hasULoc = !isNaN(ulat) && !isNaN(ulng)
  const distance = hasULoc ? calculateDistance(ulat, ulng, dest.lat, dest.lng) : null

  // real-time route planning from user location to destination (cached 24h)
  let route = null
  if (hasULoc) {
    const rk = `${ulat.toFixed(1)}_${ulng.toFixed(1)}_${dest.lat}_${dest.lng}`
    const cached = routeCache.get(rk)
    if (cached !== undefined) {
      route = cached
    } else {
      const [driving, transit] = await Promise.all([
        getDrivingRoute(ulat, ulng, dest.lat, dest.lng).catch(() => null),
        getTransitRoute(ulat, ulng, dest.lat, dest.lng).catch(() => null)
      ])
      route = driving || transit ? { driving, transit } : null
      routeCache.set(rk, route)
    }
  }

  // cache TTL: regenerate DeepSeek data after N days
  const CACHE_TTL_DAYS = 7
  const cached = dest.id?.startsWith('d') ? db.prepare('SELECT COUNT(*) as c FROM itineraries WHERE destination_id = ? AND updated_at > datetime(\'now\', ?)').get(dest.id, '-' + CACHE_TTL_DAYS + ' days') : { c: 0 }
  let itinerary
  if (!(cached.c > 0) && dest.id?.startsWith('d')) {
    const gen = await generateItinerary({ ...dest, highlights, tags })
    let days = gen.itinerary
    if (days && !Array.isArray(days)) days = Object.values(days)
    const itin = days || []
    // detect fallback: template has "第N天 探索" title, AI has creative titles
    const isFallback = itin.length > 0 && typeof itin[0].title === 'string' && itin[0].title.includes('探索')
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM itineraries WHERE destination_id = ?').run(dest.id)
      db.prepare('DELETE FROM tips WHERE destination_id = ?').run(dest.id)
      db.prepare('DELETE FROM budgets WHERE destination_id = ? AND category IN (?, ?)').run(dest.id, '_detail', '_transport')
      const insertDay = db.prepare('INSERT INTO itineraries (id, destination_id, day_number, title, morning, afternoon, evening, meals, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (let i = 0; i < itin.length; i++) {
        const day = itin[i]
        insertDay.run(uuid(), dest.id, i + 1, day.title || '', day.morning || '', day.afternoon || '', day.evening || '', JSON.stringify(day.meals || []), isFallback ? '2020-01-01' : undefined)
      }
      if (gen.tips) {
        const insertTip = db.prepare('INSERT INTO tips (id, destination_id, content, sort_order) VALUES (?, ?, ?, ?)')
        for (let i = 0; i < gen.tips.length; i++) {
          insertTip.run(uuid(), dest.id, gen.tips[i], i)
        }
      }
      if (gen.budget) {
        db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)').run(uuid(), dest.id, '_detail', JSON.stringify(gen.budget))
      }
      if (gen.transport) {
        db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)').run(uuid(), dest.id, '_transport', JSON.stringify(gen.transport))
      }
    })
    tx()
    itinerary = itin
  }
  if (!itinerary) {
    const dbIt = db.prepare('SELECT * FROM itineraries WHERE destination_id = ? ORDER BY day_number').all(dest.id)
    itinerary = dbIt.map(d => {
      let meals = JSON.parse(d.meals || '[]')
      if (typeof meals === 'string') meals = meals.split(/[；;]/).map(s => s.trim()).filter(Boolean)
      return { title: d.title, morning: d.morning, afternoon: d.afternoon, evening: d.evening, meals }
    })
  }

  // always read fresh from DB
  const tips = db.prepare('SELECT content FROM tips WHERE destination_id = ? ORDER BY sort_order').all(dest.id).map(t => t.content)
  const transportRow = db.prepare('SELECT amount FROM budgets WHERE destination_id = ? AND category = ?').get(dest.id, '_transport')
  let transportDetail = null
  if (transportRow) { try { transportDetail = JSON.parse(transportRow.amount) } catch(e) {} }
  const budgetRows = db.prepare('SELECT category, amount FROM budgets WHERE destination_id = ?').all(dest.id)
  const parseAmt = v => { if (typeof v === 'string') { try { return JSON.parse(v) } catch {} } return v }
  let budget = {}
  const detail = budgetRows.find(b => b.category === '_detail')
  if (detail) {
    budget = parseAmt(detail.amount)
    if (typeof budget !== 'object') budget = {}
  } else {
    for (const b of budgetRows) {
      if (b.category === '_detail' || b.category === '_transport') continue
      budget[b.category] = parseAmt(b.amount)
    }
  }
  const themeIcon = themes.length ? (emojiMap[themes[0].tid] || '📍') : '📍'
  const weather = await getWeather(dest.lat, dest.lng)

  // user rating from comments
  const ratingRow = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM comments WHERE destination_id = ? AND rating IS NOT NULL').get(dest.id)
  const userRating = ratingRow?.avg ? Math.round(ratingRow.avg * 10) / 10 : null
  const userRatingCount = ratingRow?.cnt || 0

  res.json(addImageUrl({
    ...dest, highlights, tags, itinerary,
    tips, budget, themes, distance, themeIcon, weather, transportDetail, route,
    userRating, userRatingCount
  }))
})

export default router
