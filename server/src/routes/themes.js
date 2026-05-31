import { Router } from 'express'
import { getDb } from '../models/db.js'

const router = Router()

router.get('/hot', (req, res) => {
  const db = getDb()
  const themes = db.prepare('SELECT * FROM themes ORDER BY sort_order LIMIT 8').all()
  res.json(themes.map(t => ({ ...t, query_keywords: JSON.parse(t.query_keywords || '[]') })))
})

router.get('/all', (req, res) => {
  const db = getDb()
  const themes = db.prepare('SELECT * FROM themes ORDER BY sort_order').all()
  res.json(themes.map(t => ({ ...t, query_keywords: JSON.parse(t.query_keywords || '[]') })))
})

export default router
