import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getDb, seedData } from './models/db.js'
import path from 'path'
import { fileURLToPath } from 'url'
import themesRouter from './routes/themes.js'
import destinationsRouter from './routes/destinations.js'
import usersRouter from './routes/users.js'
import commentsRouter from './routes/comments.js'

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// init db & seed
getDb()
seedData()

app.use('/api/themes', themesRouter)
app.use('/api/destinations', destinationsRouter)
app.use('/api/users', usersRouter)
app.use('/api/comments', commentsRouter)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

export default app
