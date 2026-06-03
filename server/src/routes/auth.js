import { Router } from 'express'
import axios from 'axios'

const router = Router()

router.post('/login', async (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: '缺少 code' })
  try {
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APP_ID,
        secret: process.env.WECHAT_APP_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      },
      timeout: 5000
    })
    if (data.errcode) {
      console.error('wx login err:', data)
      return res.status(400).json({ error: data.errmsg })
    }
    res.json({ openid: data.openid, session_key: data.session_key })
  } catch (e) {
    console.error('wx login fail:', e.message)
    res.status(500).json({ error: '登录失败' })
  }
})

export default router
