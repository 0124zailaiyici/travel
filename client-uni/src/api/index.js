import { API_BASE } from '../config.js'
const BASE = API_BASE + '/api'

function request(url, data = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE + url,
      data, method,
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

export const api = {
  getHotThemes: () => request('/themes/hot'),
  getAllThemes: () => request('/themes/all'),
  getSuggestions: (q) => request('/destinations/suggestions', { q }),
  searchDestinations: (params) => {
    if (typeof params === 'string' || !params) {
      const q = typeof params === 'string' ? params : ''
      return request('/destinations/search', { q })
    }
    return request('/destinations/search', params)
  },
  getNearby: (loc) => request('/destinations/nearby', { lat: loc?.lat, lng: loc?.lng }),
  getDetail: (id, loc) => request(`/destinations/${id}`, { lat: loc?.lat, lng: loc?.lng }),
  getInSeason: () => request('/destinations/in-season'),
  getFavorites: (ids) => request('/destinations/batch', { ids: ids.join(',') }),
  // synced favorites (backend)
  syncGetFavs: (uid) => request('/users/favorites', { openid: uid }),
  syncToggleFav: (uid, destId) => request('/users/favorites', { openid: uid, destination_id: destId }, 'POST'),
  // comments
  getComments: (destId) => request(`/comments/${destId}`),
  postComment: (data) => request('/comments', data, 'POST')
}
