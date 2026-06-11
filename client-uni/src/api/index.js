import { getApiBase, ensureBaseDetected } from '../config.js'

async function request(url, data = {}, method = 'GET') {
  await ensureBaseDetected()
  const BASE = getApiBase() + '/api'
  for (let i = 0; i < 2; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        uni.request({
          url: BASE + url,
          data, method, timeout: 10000,
          success: (res) => {
            const d = res.data
            if (d && typeof d === 'object' && !Array.isArray(d) && 'list' in d) return resolve(d)
            resolve(d)
          },
          fail: () => reject(new Error('request fail'))
        })
      })
      return res
    } catch (e) {
      if (i < 1) await new Promise(r => setTimeout(r, 500))
      else {
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        throw e
      }
    }
  }
}

export const api = {
  getHotThemes: () => request('/themes/hot'),
  getAllThemes: () => request('/themes/all'),
  getSuggestions: (q) => request('/destinations/suggestions', { q }),
  searchDestinations: (params, page = 1) => {
    if (typeof params === 'string' || !params) {
      const q = typeof params === 'string' ? params : ''
      return request('/destinations/search', { q, page, pageSize: 20 })
    }
    return request('/destinations/search', { ...params, page, pageSize: 20 })
  },
  getNearby: (loc) => request('/destinations/nearby', { lat: loc?.lat, lng: loc?.lng }),
  getDetail: (id, loc) => request(`/destinations/${id}`, { lat: loc?.lat, lng: loc?.lng }),
  getInSeason: () => request('/destinations/in-season'),
  getFavorites: (ids) => request('/destinations/batch', { ids: ids.join(',') }),
  // synced favorites (backend)
  syncGetFavs: (uid) => request('/users/favorites', { openid: uid }),
  syncToggleFav: (uid, destId) => request('/users/favorites', { openid: uid, destination_id: destId }, 'POST'),
  // history
  postHistory: (openid, destId) => request('/users/history', { openid, destination_id: destId }, 'POST'),
  getHistory: (openid) => request('/users/history', { openid }),
  // comments
  getComments: (destId, page) => request(`/comments/${destId}`, { page: page || 1 }),
  postComment: (data) => request('/comments', data, 'POST'),
  deleteComment: (id, openid) => request(`/comments/${id}?openid=${openid}`, {}, 'DELETE'),
  // image upload (returns url or null)
  uploadImage: (filePath) => {
    return new Promise((resolve) => {
      ensureBaseDetected().then(() => {
        const BASE = getApiBase()
        wx.uploadFile({
          url: BASE + '/api/comments/upload',
          filePath,
          name: 'image',
          success: (res) => {
            try {
              const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
              resolve(data.url || null)
            } catch { resolve(null) }
          },
          fail: () => resolve(null)
        })
      })
    })
  }
}
