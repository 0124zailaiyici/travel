import { getApiBase, ensureBaseDetected } from '../config.js'

let uid = null
let _loginPromise = null

async function wxLogin() {
  try {
    const { code } = await wx.login()
    if (!code) return null
    await ensureBaseDetected()
    const BASE = getApiBase() + '/api'
    return new Promise((resolve) => {
      uni.request({
        url: BASE + '/auth/login',
        data: { code },
        method: 'POST',
        timeout: 8000,
        success: (res) => {
          if (res.data && res.data.openid) resolve(res.data.openid)
          else resolve(null)
        },
        fail: () => resolve(null)
      })
    })
  } catch { return null }
}

export function getUserId() {
  if (uid) return uid
  try {
    uid = uni.getStorageSync('huaxi_uid')
    if (uid) return uid
  } catch(e) {}
  uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
  try { uni.setStorageSync('huaxi_uid', uid) } catch(e) {}
  return uid
}

export async function ensureUserId() {
  if (uid) return uid
  if (_loginPromise) return _loginPromise
  _loginPromise = (async () => {
    const oid = await wxLogin()
    if (oid) {
      uid = oid
      try { uni.setStorageSync('huaxi_uid', oid) } catch(e) {}
    }
    return uid || getUserId()
  })()
  return _loginPromise
}
