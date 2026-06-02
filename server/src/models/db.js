import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'huaxi.db')

let db

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
      season TEXT, query_keywords TEXT, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL, address TEXT,
      rating REAL DEFAULT 0, best_season TEXT, description TEXT,
      highlights TEXT, tags TEXT, image_url TEXT, duration INTEGER DEFAULT 3,
      transport_guide TEXT
    );
    CREATE TABLE IF NOT EXISTS destination_themes (
      destination_id TEXT, theme_id TEXT,
      PRIMARY KEY (destination_id, theme_id)
    );
    CREATE TABLE IF NOT EXISTS itineraries (
      id TEXT PRIMARY KEY, destination_id TEXT NOT NULL,
      day_number INTEGER NOT NULL, title TEXT,
      morning TEXT, afternoon TEXT, evening TEXT, meals TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY, destination_id TEXT NOT NULL,
      content TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY, destination_id TEXT NOT NULL,
      category TEXT NOT NULL, amount INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_favorites (
      id TEXT PRIMARY KEY, openid TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE (openid, destination_id)
    );
    CREATE TABLE IF NOT EXISTS user_history (
      id TEXT PRIMARY KEY, openid TEXT NOT NULL,
      destination_id TEXT NOT NULL, viewed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, destination_id TEXT NOT NULL,
      openid TEXT NOT NULL, nickname TEXT DEFAULT '匿名',
      avatar_color TEXT DEFAULT '#C4817A',
      rating INTEGER DEFAULT 5, content TEXT NOT NULL,
      parent_id TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  // migrate existing tables (safe to re-run)
  try { db.exec('ALTER TABLE itineraries ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))') } catch {}
  try { db.exec('ALTER TABLE tips ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))') } catch {}
  try { db.exec('ALTER TABLE budgets ADD COLUMN updated_at TEXT DEFAULT (datetime(\'now\'))') } catch {}
  try { db.exec('ALTER TABLE user_favorites ADD COLUMN created_at TEXT DEFAULT (datetime(\'now\'))') } catch {}
}

export function seedData() {
  const themesPath = path.join(__dirname, '..', 'data', 'themes.json')
  const destsPath = path.join(__dirname, '..', 'data', 'destinations.json')

  if (!fs.existsSync(themesPath) || !fs.existsSync(destsPath)) {
    console.log('Seed data files not found, skipping seed')
    return
  }

  const themeCount = db.prepare('SELECT COUNT(*) as c FROM themes').get().c
  if (themeCount > 0) {
    console.log('Database already seeded')
    return
  }

  const themes = JSON.parse(fs.readFileSync(themesPath, 'utf-8'))
  const dests = JSON.parse(fs.readFileSync(destsPath, 'utf-8'))

  const insertTheme = db.prepare(
    'INSERT INTO themes (id, name, icon, season, query_keywords, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertDest = db.prepare(
    'INSERT INTO destinations (id, name, lat, lng, address, rating, best_season, description, highlights, tags, image_url, duration, transport_guide) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertDt = db.prepare(
    'INSERT INTO destination_themes (destination_id, theme_id) VALUES (?, ?)'
  )
  const insertBudget = db.prepare(
    'INSERT INTO budgets (id, destination_id, category, amount) VALUES (?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    for (const t of themes) {
      insertTheme.run(t.id, t.name, t.icon, t.season, JSON.stringify(t.query_keywords), t.sort_order)
    }
    for (const d of dests) {
      insertDest.run(d.id, d.name, d.lat, d.lng, d.address, d.rating,
        d.best_season, d.description, JSON.stringify(d.highlights),
        JSON.stringify(d.tags), d.image_url, d.duration, d.transport_guide)
      for (const tid of d.theme_ids) {
        insertDt.run(d.id, tid)
      }
      if (d.budget) {
        for (const [cat, amt] of Object.entries(d.budget)) {
          insertBudget.run(uuid(), d.id, cat, amt)
        }
      }
    }
  })

  tx()
  console.log(`Seeded ${themes.length} themes and ${dests.length} destinations`)
}
