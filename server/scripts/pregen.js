import 'dotenv/config'
import { getDb, seedData } from '../src/models/db.js'
import { generateItinerary } from '../src/services/deepseek.js'
import { v4 as uuid } from 'uuid'

const db = getDb()
seedData()

const destinations = db.prepare('SELECT * FROM destinations').all()
console.log(`开始预生成 ${destinations.length} 个目的地的行程...`)

let success = 0
let fail = 0

for (const dest of destinations) {
  const existing = db.prepare('SELECT COUNT(*) as c FROM itineraries WHERE destination_id = ?').get(dest.id)
  if (existing.c > 3) {
    console.log(`  [跳过] ${dest.name} — 已有行程`)
    continue
  }

  const highlights = JSON.parse(dest.highlights || '[]')
  const tags = JSON.parse(dest.tags || '[]')
  console.log(`  [生成] ${dest.name} (${dest.duration}天)...`)

  try {
    const gen = await generateItinerary({ ...dest, highlights, tags })

    // normalize itinerary to array
    let itineraryDays = gen.itinerary
    if (itineraryDays && !Array.isArray(itineraryDays)) {
      itineraryDays = Object.values(itineraryDays)
    }
    if (!itineraryDays || itineraryDays.length === 0) throw new Error('Empty itinerary')

    // save itinerary
    const insertDay = db.prepare(
      `INSERT OR REPLACE INTO itineraries (id, destination_id, day_number, title, morning, afternoon, evening, meals)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    db.prepare('DELETE FROM itineraries WHERE destination_id = ?').run(dest.id)
    for (let i = 0; i < itineraryDays.length; i++) {
      const day = itineraryDays[i]
      insertDay.run(uuid(), dest.id, i + 1, day.title || '',
        day.morning || '', day.afternoon || '', day.evening || '',
        JSON.stringify(day.meals || []))
    }

    // save tips
    if (gen.tips && gen.tips.length) {
      db.prepare('DELETE FROM tips WHERE destination_id = ?').run(dest.id)
      const insertTip = db.prepare(
        'INSERT INTO tips (id, destination_id, content, sort_order) VALUES (?, ?, ?, ?)'
      )
      for (let i = 0; i < gen.tips.length; i++) {
        insertTip.run(uuid(), dest.id, gen.tips[i], i)
      }
    }

    // save budget
    if (gen.budget) {
      db.prepare('DELETE FROM budgets WHERE destination_id = ?').run(dest.id)
      const insertBudget = db.prepare(
        'INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)'
      )
      for (const [cat, amt] of Object.entries(gen.budget)) {
        insertBudget.run(uuid(), dest.id, cat, amt)
      }
    }

    success++
    console.log(`    ✅ 完成 — ${gen.itinerary.length}天, ${gen.tips?.length || 0}条避坑建议`)
  } catch (e) {
    fail++
    console.log(`    ❌ 失败 — ${e.message}`)
  }

  // rate limit: 延迟1秒
  await new Promise(r => setTimeout(r, 1000))
}

console.log(`\n=== 完成: ${success}成功, ${fail}失败 ===`)
