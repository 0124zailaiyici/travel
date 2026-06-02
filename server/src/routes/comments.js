import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../models/db.js'

const router = Router()

const AVATAR_COLORS = ['#C4817A','#5B7B5A','#E8C4A0','#8BA88A','#9A5E58','#E8B4AE','#5B7B8A','#C4917A']

function pickColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

router.get('/:id', (req, res) => {
  const db = getDb()
  const comments = db.prepare(`
    SELECT id, openid, nickname, avatar_color, rating, content, parent_id, created_at
    FROM comments WHERE destination_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.params.id)
  res.json(comments.map(c => ({ ...c })))
})

router.post('/', (req, res) => {
  const { destination_id, openid, nickname, rating, content, parent_id } = req.body
  if (!destination_id || !openid || !content || !content.trim()) {
    return res.status(400).json({ error: '缺少必填字段' })
  }
  const db = getDb()
  const name = (nickname || '匿名').trim().slice(0, 12) || '匿名'
  const id = uuid()
  db.prepare(
    'INSERT INTO comments (id, destination_id, openid, nickname, avatar_color, rating, content, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, destination_id, openid, name, pickColor(name), rating ? Math.min(Math.max(parseInt(rating), 1), 5) : null, content.trim(), parent_id || null)
  res.json({ success: true, id })
})

router.delete('/:id', (req, res) => {
  const { openid } = req.query || req.body
  const db = getDb()
  const row = db.prepare('SELECT openid FROM comments WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: '评论不存在' })
  if (row.openid !== openid) return res.status(403).json({ error: '无权删除' })
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id)
  // also delete replies
  db.prepare('DELETE FROM comments WHERE parent_id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
