function request({ url, method = 'GET', data, header = {}, timeout = 8000 }) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('timeout'))
    }, timeout + 500)
    uni.request({
      url,
      method,
      data,
      header,
      timeout,
      success: (res) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data)
        else reject(new Error('HTTP ' + res.statusCode + ' ' + (typeof res.data === 'string' ? res.data.slice(0, 80) : '')))
      },
      fail: (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err || new Error('network fail'))
      }
    })
  })
}

export async function httpGet(url, data, header, timeout = 8000) {
  return request({ url, method: 'GET', data, header, timeout })
}

export async function httpPost(url, data, header, timeout = 45000) {
  return request({ url, method: 'POST', data, header, timeout })
}
