import axios from 'axios'

export async function getWeather(lat, lng) {
  if (!lat || !lng) return null
  try {
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: { latitude: lat, longitude: lng, current_weather: true, timezone: 'auto' },
      timeout: 5000
    })
    if (!data.current_weather) return null
    const w = data.current_weather
    const codes = { 0:'☀️晴',1:'🌤️多云',2:'⛅多云',3:'☁️阴',45:'🌫️雾',48:'🌫️雾',
      51:'🌧️小雨',53:'🌧️中雨',55:'🌧️大雨',61:'🌦️阵雨',63:'🌦️阵雨',65:'🌧️暴雨',
      71:'❄️小雪',73:'❄️中雪',75:'❄️大雪',80:'🌦️阵雨',95:'⛈️雷暴' }
    return {
      temp: w.temperature + '°C',
      condition: codes[w.weathercode] || '🌤️',
      wind: w.windspeed + 'km/h'
    }
  } catch {
    return null
  }
}
