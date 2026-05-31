import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getDb, seedData } from './models/db.js'
import themesRouter from './routes/themes.js'
import destinationsRouter from './routes/destinations.js'
import usersRouter from './routes/users.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// init db & seed
getDb()
seedData()

app.use('/api/themes', themesRouter)
app.use('/api/destinations', destinationsRouter)
app.use('/api/users', usersRouter)

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
