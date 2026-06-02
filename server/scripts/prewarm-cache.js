import 'dotenv/config'
import { getDb, seedData } from '../src/models/db.js'
import { generateItinerary } from '../src/services/deepseek.js'
import { v4 as uuid } from 'uuid'

const db = getDb()
seedData()

const TOP_N = 50
const CACHE_TTL_DAYS = 7

const destinations = db.prepare(
  'SELECT * FROM destinations ORDER BY rating DESC LIMIT ?'
).all(TOP_N)

const cached = db.prepare(`
  SELECT COUNT(*) as c FROM itineraries
  WHERE destination_id = ? AND updated_at > datetime('now', ?)
`)
const total = destinations.length
console.log(`评分前 ${total} 个热度目的地，检查缓存状态...`)

const toGenerate = destinations.filter(d => {
  const row = cached.get(d.id, '-' + CACHE_TTL_DAYS + ' days')
  if (row.c > 0) {
    console.log(`  [跳过] ${d.name} — 缓存有效`)
    return false
  }
  return true
})

console.log(`\n需要生成: ${toGenerate.length}/${total} 个, 预计 DeepSeek 费用 ~¥${(toGenerate.length * 0.05).toFixed(1)}`)
if (!toGenerate.length) { console.log('无需生成'); process.exit(0) }

let success = 0
let fail = 0

for (let i = 0; i < toGenerate.length; i++) {
  const dest = toGenerate[i]
  const highlights = JSON.parse(dest.highlights || '[]')
  const tags = JSON.parse(dest.tags || '[]')
  console.log(`[${i + 1}/${toGenerate.length}] ${dest.name} (评分${dest.rating})...`)

  try {
    const gen = await generateItinerary({ ...dest, highlights, tags })
    let days = gen.itinerary
    if (days && !Array.isArray(days)) days = Object.values(days)
    if (!days || days.length === 0) throw new Error('空行程')

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM itineraries WHERE destination_id = ?').run(dest.id)
      db.prepare('DELETE FROM tips WHERE destination_id = ?').run(dest.id)
      db.prepare('DELETE FROM budgets WHERE destination_id = ? AND category IN (?, ?)').run(dest.id, '_detail', '_transport')

      const insertDay = db.prepare('INSERT INTO itineraries (id, destination_id, day_number, title, morning, afternoon, evening, meals) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      for (let j = 0; j < days.length; j++) {
        const day = days[j]
        insertDay.run(uuid(), dest.id, j + 1, day.title || '', day.morning || '', day.afternoon || '', day.evening || '', JSON.stringify(day.meals || []))
      }

      if (gen.tips) {
        const insertTip = db.prepare('INSERT INTO tips (id, destination_id, content, sort_order) VALUES (?, ?, ?, ?)')
        for (let j = 0; j < gen.tips.length; j++) {
          insertTip.run(uuid(), dest.id, gen.tips[j], j)
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

    success++
    const tipCount = gen.tips?.length || 0
    console.log(`  ✅ ${days.length}天, ${tipCount}条避坑, ${gen.budget ? '有预算' : '无预算'}` + (gen.transport ? ', 有交通' : ''))
  } catch (e) {
    fail++
    console.log(`  ❌ ${e.message}`)
  }

  if (i < toGenerate.length - 1) {
    await new Promise(r => setTimeout(r, 1500))
  }
}

console.log(`\n=== 完成: ${success}成功, ${fail}失败 ===`)
if (success > 0) {
  console.log(`总花费约 ~¥${(success * 0.05).toFixed(1)}`)
}
