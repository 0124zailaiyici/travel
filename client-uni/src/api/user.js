import { getOrCreateUserId, setUserId } from '../services/userStore.js'

let uid = null
let _loginPromise = null

function canUseWxMiniLogin() {
  try {
    return typeof wx !== 'undefined' && typeof wx.login === 'function' && typeof wx.getAccountInfoSync === 'function'
  } catch (e) {
    return false
  }
}

async function wxLogin() {
  // App 端不依赖微信 code2session
  if (!canUseWxMiniLogin()) return null
  try {
    const loginApi = (typeof uni !== 'undefined' && uni.login) ? uni.login : wx.login
    const loginRes = await new Promise((resolve, reject) => {
      loginApi({ success: resolve, fail: reject })
    })
    // 当前离线架构使用本地 uid
    return null
  } catch {
    return null
  }
}

export function getUserId() {
  if (uid) return uid
  uid = getOrCreateUserId()
  return uid
}

export async function ensureUserId() {
  if (uid) return uid
  if (_loginPromise) return _loginPromise
  _loginPromise = (async () => {
    await wxLogin()
    uid = getOrCreateUserId()
    setUserId(uid)
    return uid
  })()
  return _loginPromise
}
