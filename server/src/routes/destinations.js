import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../models/db.js'
import { searchPOI, searchAround, getPOIDetail, getCityFromCoords } from '../services/amap.js'
import { generateItinerary } from '../services/deepseek.js'
import { calculateDistance } from '../utils/distance.js'
import { getWeather } from '../services/weather.js'
import { getLocationByIP } from '../services/iplocation.js'
import NodeCache from 'node-cache'

const router = Router()
const itineraryCache = new NodeCache({ stdTTL: 604800 })

const emojiMap = {
  't1':'🌸','t2':'🏔️','t3':'🏖️','t4':'🍁','t5':'🦀',
  't6':'🎆','t7':'🏯','t8':'⛺','t9':'♨️','t10':'🌻'
}

function addImageUrl(d) {
  if (!d.image_url) {
    d.image_url = `https://picsum.photos/seed/${d.id || d.name}/600/400`
  }
  return d
}

function parseDest(d) {
  return { ...d, highlights: JSON.parse(d.highlights || '[]'), tags: JSON.parse(d.tags || '[]') }
}

router.get('/search', async (req, res) => {
  const { q = '', city = '', lat, lng } = req.query
  const db = getDb()
  const keyword = q.trim()
  let localResults = []
  if (keyword) {
    localResults = db.prepare(`
      SELECT DISTINCT d.* FROM destinations d
      LEFT JOIN destination_themes dt ON d.id = dt.destination_id
      LEFT JOIN themes t ON dt.theme_id = t.id
      WHERE d.name LIKE ? OR d.description LIKE ? OR d.tags LIKE ? OR t.name LIKE ? OR t.query_keywords LIKE ?
    `).all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  } else {
    localResults = db.prepare('SELECT * FROM destinations LIMIT 20').all()
  }
  const userLat2 = parseFloat(lat), userLng2 = parseFloat(lng)
  const hasLoc2 = !isNaN(userLat2) && !isNaN(userLng2)
  const parsed = localResults.map(parseDest).map(d => ({
    ...d, distance: hasLoc2 ? calculateDistance(userLat2, userLng2, d.lat, d.lng) : null
  }))
  let amapResults = []
  try {
    const searchCity = city || (lat && lng ? await getCityFromCoords(lat, lng) : '')
    if (searchCity) {
      amapResults = await searchPOI(keyword || '旅游景点', searchCity)
      // if keyword is generic (city name) and no amap results, search by attraction types
      if (amapResults.length < 3 && keyword === searchCity) {
        for (const t of ['公园','博物馆','景点','广场','步行街','乐园']) {
          const more = await searchPOI(t, searchCity)
          for (const m of more) {
            if (!amapResults.find(a => a.name === m.name)) amapResults.push(m)
          }
        }
      }
    }
  } catch (e) { console.error('Amap search error:', e.message) }
  const seen = new Set(parsed.map(d => d.name))
  const merged = [...parsed]
  for (const a of amapResults) {
    if (!seen.has(a.name)) {
      const dist = calculateDistance(parseFloat(lat), parseFloat(lng), a.lat, a.lng)
      merged.push({ ...a, distance: dist })
      seen.add(a.name)
    }
  }
  merged.sort((a, b) => (a.distance || 9999) - (b.distance || 9999))
  res.json(merged.map(addImageUrl))
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

  // amap nearby POIs
  let amapPois = []
  try { amapPois = await searchAround(userLat, userLng) }
  catch (e) { console.error('Amap around error:', e.message) }

  // curated within 200km, then amap to fill
  const result = []
  const names = new Set()
  for (const d of local) {
    if (d.distance > 200) break
    result.push(d); names.add(d.name)
  }
  for (const p of amapPois) {
    if (result.length >= 8) break
    if (!names.has(p.name)) { result.push(p); names.add(p.name); p.source = 'amap' }
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
  if (!ipLoc) return res.json({ error: '无法定位' })
  const city = await getCityFromCoords(ipLoc.lat, ipLoc.lng)
  res.json({ ...ipLoc, city })
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
  const tips = db.prepare('SELECT content FROM tips WHERE destination_id = ? ORDER BY sort_order').all(dest.id)
  const budgets = db.prepare('SELECT category, amount FROM budgets WHERE destination_id = ?').all(dest.id)
  const budget = {}
  for (const b of budgets) budget[b.category] = b.amount
  const themes = dest.id?.startsWith('d') ? db.prepare('SELECT t.*, t.id as tid FROM themes t JOIN destination_themes dt ON t.id = dt.theme_id WHERE dt.destination_id = ?').all(dest.id) : []
  const ulat = parseFloat(lat), ulng = parseFloat(lng)
  const distance = !isNaN(ulat) && !isNaN(ulng) ? calculateDistance(ulat, ulng, dest.lat, dest.lng) : null

  const dbIt = dest.id?.startsWith('d') ? db.prepare('SELECT * FROM itineraries WHERE destination_id = ? ORDER BY day_number').all(dest.id) : []
  let itinerary
  if (dbIt.length > 0) {
    itinerary = dbIt.map(d => {
      let meals = JSON.parse(d.meals || '[]')
      if (typeof meals === 'string') meals = meals.split(/[；;]/).map(s => s.trim()).filter(Boolean)
      return { title: d.title, morning: d.morning, afternoon: d.afternoon, evening: d.evening, meals }
    })
  } else {
    const gen = await generateItinerary({ ...dest, highlights, tags })
    let days = gen.itinerary
    if (days && !Array.isArray(days)) days = Object.values(days)
    itinerary = days || []
    if (itinerary.length) {
      const insertDay = db.prepare('INSERT INTO itineraries (id, destination_id, day_number, title, morning, afternoon, evening, meals) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      for (let i = 0; i < itinerary.length; i++) {
        const day = itinerary[i]
        insertDay.run(uuid(), dest.id, i + 1, day.title || '', day.morning || '', day.afternoon || '', day.evening || '', JSON.stringify(day.meals || []))
      }
    }
    if (gen.tips) {
      for (let i = 0; i < gen.tips.length; i++) {
        db.prepare('INSERT OR IGNORE INTO tips (id, destination_id, content, sort_order) VALUES (?, ?, ?, ?)').run(uuid(), dest.id, gen.tips[i], i)
      }
    }
  }

  const themeIcon = themes.length ? (emojiMap[themes[0].tid] || '📍') : '📍'
  const weather = await getWeather(dest.lat, dest.lng)

  res.json(addImageUrl({
    ...dest, highlights, tags, itinerary,
    tips: tips.map(t => t.content), budget, themes, distance, themeIcon, weather
  }))
})

export default router
