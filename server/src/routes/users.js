import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../models/db.js'

const router = Router()

router.post('/favorites', (req, res) => {
  const { openid, destination_id } = req.body
  const db = getDb()
  try {
    db.prepare('INSERT INTO user_favorites (id, openid, destination_id) VALUES (?, ?, ?)').run(uuid(), openid, destination_id)
    res.json({ success: true })
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      db.prepare('DELETE FROM user_favorites WHERE openid = ? AND destination_id = ?').run(openid, destination_id)
      res.json({ success: true, removed: true })
    } else {
      res.status(500).json({ error: e.message })
    }
  }
})

router.get('/favorites', (req, res) => {
  const { openid } = req.query
  const db = getDb()
  const favorites = db.prepare(`
    SELECT d.* FROM destinations d
    JOIN user_favorites uf ON d.id = uf.destination_id
    WHERE uf.openid = ?
    ORDER BY uf.created_at DESC
  `).all(openid)
  res.json(favorites.map(d => ({ ...d, highlights: JSON.parse(d.highlights || '[]'), tags: JSON.parse(d.tags || '[]') })))
})

router.post('/history', (req, res) => {
  const { openid, destination_id } = req.body
  const db = getDb()
  db.prepare('INSERT INTO user_history (id, openid, destination_id) VALUES (?, ?, ?)').run(uuid(), openid, destination_id)
  res.json({ success: true })
})

router.get('/history', (req, res) => {
  const { openid } = req.query
  const db = getDb()
  const history = db.prepare(`
    SELECT d.* FROM destinations d
    JOIN user_history uh ON d.id = uh.destination_id
    WHERE uh.openid = ?
    GROUP BY d.id
    ORDER BY MAX(uh.viewed_at) DESC
    LIMIT 20
  `).all(openid)
  res.json(history.map(d => ({ ...d, highlights: JSON.parse(d.highlights || '[]'), tags: JSON.parse(d.tags || '[]') })))
})

export default router
