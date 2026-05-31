import axios from 'axios'

const IP_API = 'https://ipapi.co/json/'

export async function getLocationByIP() {
  try {
    const { data } = await axios.get(IP_API, { timeout: 5000 })
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lng: data.longitude, city: data.city }
    }
    return null
  } catch {
    return null
  }
}
