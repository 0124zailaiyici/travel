import { getApiBase, ensureBaseDetected } from '../config.js'

async function request(url, data = {}, method = 'GET') {
  await ensureBaseDetected()
  const BASE = getApiBase() + '/api'
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE + url,
      data, method, timeout: 10000,
      success: (res) => resolve(res.data),
      fail: () => {
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        reject(new Error('request fail'))
      }
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
  getComments: (destId, page) => request(`/comments/${destId}`, { page: page || 1 }),
  postComment: (data) => request('/comments', data, 'POST'),
  deleteComment: (id, openid) => request(`/comments/${id}?openid=${openid}`, {}, 'DELETE')
}
