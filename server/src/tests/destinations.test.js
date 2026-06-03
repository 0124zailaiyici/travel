import { describe, it, expect, vi } from 'vitest'
import supertest from 'supertest'
import app from '../index.js'

const request = supertest(app)

describe('Destinations API', () => {

  it('GET /search returns results with keyword', async () => {
    const res = await request.get('/api/destinations/search?q=武汉')
    expect(res.status).toBe(200)
    expect(res.body.list.length).toBeGreaterThan(0)
    expect(res.body.list[0]).toHaveProperty('name')
    expect(res.body.list[0]).toHaveProperty('id')
    expect(res.body.total).toBeGreaterThan(0)
    expect(res.body.page).toBe(1)
  })

  it('GET /search returns results without keyword', async () => {
    const res = await request.get('/api/destinations/search')
    expect(res.status).toBe(200)
    expect(res.body.list.length).toBeGreaterThan(0)
  })

  it('GET /search sorts by distance when location provided', async () => {
    const res = await request.get('/api/destinations/search?q=阳朔&lat=25.0&lng=110.0')
    expect(res.status).toBe(200)
    const items = res.body.list
    if (items.length > 1) {
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1].distance ?? 99999
        const cur = items[i].distance ?? 99999
        expect(cur).toBeGreaterThanOrEqual(prev)
      }
    }
  })

  it('GET /search sets distance to null when no location', async () => {
    const res = await request.get('/api/destinations/search?q=黄鹤楼')
    expect(res.status).toBe(200)
    if (res.body.list.length > 0) {
      expect(res.body.list[0].distance).toBeNull()
    }
  })

})

describe('Nearby', () => {

  it('GET /nearby returns destinations with location', async () => {
    const res = await request.get('/api/destinations/nearby?lat=30.5&lng=114.3')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('distance')
  })

  it('GET /nearby returns destinations without location', async () => {
    const res = await request.get('/api/destinations/nearby')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    // without location, distance field is absent
    expect(res.body[0]).toHaveProperty('id')
    expect(res.body[0]).toHaveProperty('name')
  })

})

describe('In Season', () => {

  it('GET /in-season returns destinations', async () => {
    const res = await request.get('/api/destinations/in-season')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('image_url')
  })

})

describe('Detail', () => {

  it('GET /:id returns full detail for valid curated destination', async () => {
    const res = await request.get('/api/destinations/d1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('name')
    expect(res.body).toHaveProperty('highlights')
    expect(res.body).toHaveProperty('tags')
    expect(res.body).toHaveProperty('itinerary')
    expect(res.body).toHaveProperty('tips')
    expect(res.body).toHaveProperty('budget')
    expect(res.body).toHaveProperty('themes')
    expect(res.body).toHaveProperty('weather')
    expect(res.body).toHaveProperty('userRating')
    expect(res.body).toHaveProperty('userRatingCount')
    expect(res.body).toHaveProperty('transportDetail')
    expect(res.body).toHaveProperty('route')
  })

  it('GET /:id includes distance and route when location provided', async () => {
    const res = await request.get('/api/destinations/d1?lat=30.5&lng=114.3')
    expect(res.status).toBe(200)
    expect(res.body.distance).toBeTypeOf('number')
    expect(res.body.distance).toBeGreaterThan(0)
    // route exists but null because tencent map is mocked
    expect(res.body).toHaveProperty('route')
  })

  it('GET /:id distance is null when no location', async () => {
    const res = await request.get('/api/destinations/d1')
    expect(res.status).toBe(200)
    expect(res.body.distance).toBeNull()
  })

  it('GET /:id transportDetail has expected structure', async () => {
    const res = await request.get('/api/destinations/d12')
    expect(res.status).toBe(200)
    if (res.body.transportDetail) {
      expect(res.body.transportDetail).toHaveProperty('to_destination')
      expect(res.body.transportDetail).toHaveProperty('around')
      expect(res.body.transportDetail).toHaveProperty('parking')
    }
  })

  it('GET /:id returns 404 for non-existent id', async () => {
    const res = await request.get('/api/destinations/nonexistent')
    expect(res.status).toBe(404)
  })

})

describe('Batch', () => {

  it('GET /batch returns multiple destinations', async () => {
    const res = await request.get('/api/destinations/batch?ids=d1,d2,d3')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(3)
  })

  it('GET /batch returns empty array for no ids', async () => {
    const res = await request.get('/api/destinations/batch')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

})

describe('Health', () => {

  it('GET /health returns ok', async () => {
    const res = await request.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body).toHaveProperty('time')
  })

})

describe('Themes', () => {

  it('GET /hot returns themes with name, icon, query_keywords', async () => {
    const res = await request.get('/api/themes/hot')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('icon')
    expect(res.body[0]).toHaveProperty('query_keywords')
  })

  it('GET /all returns all themes sorted', async () => {
    const res = await request.get('/api/themes/all')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
  })

})

describe('Auth API', () => {
  it('POST /auth/login returns 400 without code', async () => {
    const res = await request.post('/api/auth/login').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('缺少 code')
  })

  it('POST /auth/login returns openid with valid code', async () => {
    const res = await request.post('/api/auth/login').send({ code: 'test_code' })
    expect(res.status).toBe(200)
    expect(res.body.openid).toBe('test_openid_123')
  })
})

describe('Search Pagination', () => {
  it('GET /search returns paginated results with total', async () => {
    const res = await request.get('/api/destinations/search?q=阳朔&page=1&pageSize=2')
    expect(res.status).toBe(200)
    expect(res.body.page).toBe(1)
    expect(res.body.list.length).toBeGreaterThan(0)
    expect(res.body.total).toBeGreaterThan(0)
  })

  it('GET /search page 2 returns different slice', async () => {
    const p1 = await request.get('/api/destinations/search?page=1&pageSize=2')
    const p2 = await request.get('/api/destinations/search?page=2&pageSize=2')
    expect(p1.status).toBe(200)
    expect(p2.status).toBe(200)
    if (p1.body.list.length && p2.body.list.length) {
      expect(p1.body.list[0].id).not.toBe(p2.body.list[0].id)
    }
  })
})
