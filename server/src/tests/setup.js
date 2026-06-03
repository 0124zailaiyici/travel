import { vi } from 'vitest'

vi.mock('../services/tencent.js', () => ({
  searchPOI: vi.fn().mockResolvedValue([]),
  searchAround: vi.fn().mockResolvedValue([]),
  getPOIDetail: vi.fn().mockResolvedValue(null),
  getCityFromCoords: vi.fn().mockResolvedValue(''),
  getDrivingRoute: vi.fn().mockResolvedValue(null),
  getTransitRoute: vi.fn().mockResolvedValue(null)
}))

vi.mock('../services/deepseek.js', () => ({
  generateItinerary: vi.fn().mockResolvedValue({ itinerary: [], tips: [] })
}))

vi.mock('../services/weather.js', () => ({
  getWeather: vi.fn().mockResolvedValue(null)
}))

vi.mock('../services/iplocation.js', () => ({
  getLocationByIP: vi.fn().mockResolvedValue(null)
}))

vi.mock('axios', () => {
  const mockAxios = { get: vi.fn(), post: vi.fn() }
  mockAxios.get.mockResolvedValue({ data: { openid: 'test_openid_123', session_key: 'test_key' } })
  return { default: mockAxios }
})
