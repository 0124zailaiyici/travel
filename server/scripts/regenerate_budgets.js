import 'dotenv/config'
import { getDb } from '../src/models/db.js'
import { generateItinerary } from '../src/services/deepseek.js'
import { v4 as uuid } from 'uuid'

const db = getDb()
const dests = db.prepare("SELECT * FROM destinations WHERE id LIKE 'd%'").all()
console.log(`Regenerating budgets for ${dests.length} destinations...`)

let ok = 0, fail = 0
for (const dest of dests) {
  const hasDetail = db.prepare('SELECT COUNT(*) as c FROM budgets WHERE destination_id = ? AND category = ?').get(dest.id, '_detail').c
  if (hasDetail) { console.log(`  [跳过] ${dest.name} — 已有明细`); continue }
  const highlights = JSON.parse(dest.highlights || '[]')
  const tags = JSON.parse(dest.tags || '[]')
  console.log(`  [${dest.id}] ${dest.name}...`)
  try {
    const gen = await generateItinerary({ ...dest, highlights, tags })
    if (gen.budget) {
      db.prepare('DELETE FROM budgets WHERE destination_id = ?').run(dest.id)
      const first = Object.values(gen.budget)[0]
      if (first && typeof first === 'object' && first.items) {
        db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)')
          .run(uuid(), dest.id, '_detail', JSON.stringify(gen.budget))
      } else {
        const ins = db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)')
        for (const [cat, amt] of Object.entries(gen.budget)) ins.run(uuid(), dest.id, cat, amt)
      }
      ok++
    }
  } catch(e) {
    console.error(`    ❌ ${e.message}`)
    fail++
  }
  await new Promise(r => setTimeout(r, 800))
}

console.log(`\nDone: ${ok} OK, ${fail} failed`)
