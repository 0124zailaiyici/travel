import { getApiBase, ensureBaseDetected } from '../config.js'

let cachedLocation = null

export function clearLocationCache() { cachedLocation = null }

export async function getLocation() {
  if (cachedLocation) return cachedLocation

  const wxLoc = await new Promise((resolve) => {
    uni.getLocation({
      type: 'wgs84',
      altitude: false,
      success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
      fail: (err) => { console.error('getLocation fail:', err); resolve(null) }
    })
  })
  if (wxLoc) { cachedLocation = wxLoc; return wxLoc }

  try {
    const { data } = await uni.request({ url: (await ensureBaseDetected(), getApiBase()) + '/api/destinations/auto-location' })
    if (data.lat && data.lng) {
      cachedLocation = { lat: data.lat, lng: data.lng }
      return cachedLocation
    }
  } catch(e) {}

  return null
}
