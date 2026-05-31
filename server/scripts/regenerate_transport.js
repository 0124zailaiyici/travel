import 'dotenv/config'
import { getDb } from '../src/models/db.js'
import { generateItinerary } from '../src/services/deepseek.js'
import { v4 as uuid } from 'uuid'

const db = getDb()
const dests = db.prepare("SELECT * FROM destinations WHERE id LIKE 'd%'").all()
console.log(`Generating transport for ${dests.length} destinations...`)

let ok = 0, fail = 0
for (const dest of dests) {
  const has = db.prepare('SELECT COUNT(*) as c FROM budgets WHERE destination_id = ? AND category = ?').get(dest.id, '_transport')
  if (has.c > 0) { console.log(`  [跳过] ${dest.name}`); continue }
  const highlights = JSON.parse(dest.highlights || '[]')
  const tags = JSON.parse(dest.tags || '[]')
  console.log(`  [${dest.id}] ${dest.name}...`)
  try {
    const gen = await generateItinerary({ ...dest, highlights, tags })
    if (gen.transport) {
      db.prepare('DELETE FROM budgets WHERE destination_id = ? AND category = ?').run(dest.id, '_transport')
      db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)')
        .run(uuid(), dest.id, '_transport', JSON.stringify(gen.transport))
      ok++
    } else {
      // fallback: generate a basic transport guide
      const guide = { to_destination: dest.transport_guide || `${dest.name}位于${dest.address}`, around: '打车或公交', parking: '' }
      db.prepare('INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)')
        .run(uuid(), dest.id, '_transport', JSON.stringify(guide))
      ok++
    }
  } catch(e) {
    console.error(`    ❌ ${e.message}`)
    fail++
  }
  await new Promise(r => setTimeout(r, 800))
}
console.log(`\nDone: ${ok} OK, ${fail} failed`)
