let uid = null

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
