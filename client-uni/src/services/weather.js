import { httpGet } from './http.js'
import { getRuntimeConfig } from './config.js'
import { cacheGet, cacheSet } from './cache.js'

const CODES = {
  0: '晴朗', 1: '大致晴朗', 2: '局部多云', 3: '阴天',
  45: '有雾', 48: '雾凇',
  51: '小毛毛雨', 53: '中等毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '中等阵雨', 82: '强阵雨',
  95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹'
}

export async function getWeather(lat, lng) {
  if (lat == null || lng == null) return null
  const key = Number(lat).toFixed(2) + '_' + Number(lng).toFixed(2)
  const cached = cacheGet('weather', key, 30 * 60 * 1000)
  if (cached) return cached
  try {
    const base = getRuntimeConfig().openMeteoBase || 'https://api.open-meteo.com'
    const data = await httpGet(base + '/v1/forecast', {
      latitude: lat,
      longitude: lng,
      current_weather: true,
      timezone: 'auto'
    }, {}, 5000)
    if (!data?.current_weather) return null
    const w = data.current_weather
    const result = {
      temp: w.temperature + '°C',
      condition: CODES[w.weathercode] || '天气未知',
      wind: w.windspeed + 'km/h'
    }
    cacheSet('weather', key, result)
    return result
  } catch {
    return null
  }
}
