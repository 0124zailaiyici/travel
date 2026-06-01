import Database from 'better-sqlite3'
import fs from 'fs'

const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf-8'))
const db = new Database(':memory:')

db.exec(`CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  address TEXT, rating REAL DEFAULT 0, best_season TEXT, description TEXT,
  highlights TEXT, tags TEXT, image_url TEXT, duration INTEGER DEFAULT 3, transport_guide TEXT
)`)

const insert = db.prepare(
  'INSERT INTO destinations (id, name, lat, lng, address, rating, best_season, description, highlights, tags, image_url, duration, transport_guide) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
)

const tx = db.transaction(() => {
  for (let i = 0; i < dests.length; i++) {
    const d = dests[i]
    try {
      const args = [d.id, d.name, d.lat, d.lng, d.address, d.rating, d.best_season, d.description, JSON.stringify(d.highlights), JSON.stringify(d.tags), d.image_url, d.duration, d.transport_guide]
      const nullIdx = args.findIndex(a => a === undefined || a === null)
      if (nullIdx >= 0) {
        console.error(`NULL/UNDEFINED at index ${i} id=${d.id} field=${['id','name','lat','lng','address','rating','best_season','description','highlights','tags','image_url','duration','transport_guide'][nullIdx]} value=${args[nullIdx]}`)
        continue
      }
      insert.run(...args)
    } catch (e) {
      console.error(`FAIL index ${i} id=${d.id} name=${d.name}: ${e.message}`)
      break
    }
  }
})

try {
  tx()
  console.log(`All ${dests.length} entries inserted OK`)
} catch (e) {
  console.error('TX failed:', e.message)
}
