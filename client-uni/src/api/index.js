import { API_BASE } from '../config.js'
const BASE = API_BASE + '/api'

function request(url, data = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE + url,
      data,
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

export const api = {
  getHotThemes: () => request('/themes/hot'),
  getAllThemes: () => request('/themes/all'),
  searchDestinations: (q, city, loc) => request('/destinations/search', { q, city, lat: loc?.lat, lng: loc?.lng }),
  getNearby: (loc) => request('/destinations/nearby', { lat: loc?.lat, lng: loc?.lng }),
  getDetail: (id, loc) => request(`/destinations/${id}`, { lat: loc?.lat, lng: loc?.lng }),
  getInSeason: () => request('/destinations/in-season'),
  getFavorites: (ids) => request('/destinations/batch', { ids: ids.join(',') })
}
