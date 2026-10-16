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

/**
 * 有些 OpenAI 兼容网关会把整个响应再包一层 `data`，例如 ClinePass
 * （https://api.cline.bot/api/v1）返回的是：
 *   { "success": true, "data": { "choices": [ { "message": { "content": "..." } } ] } }
 * 而标准 OpenAI 是 { "choices": [ ... ] }。
 *
 * 只认「data 里确实有 choices」这一种情况再解包，避免误伤那些
 * 本来就有 data 字段的接口（腾讯地图返回的是 status/result，没有 choices）。
 */
export function unwrapCompletion(data) {
  if (data && data.data && Array.isArray(data.data.choices)) return data.data
  return data
}

export function completionContent(data) {
  return unwrapCompletion(data)?.choices?.[0]?.message?.content || ''
}
