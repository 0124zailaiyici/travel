import { Router } from 'express'
import axios from 'axios'
import { v4 as uuid } from 'uuid'

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
      console.warn('wx login err, using dev fallback:', data.errmsg)
      return res.json({ openid: 'dev_' + uuid().slice(0, 12), session_key: 'dev' })
    }
    res.json({ openid: data.openid, session_key: data.session_key })
  } catch (e) {
    console.warn('wx login fail, using dev fallback:', e.message)
    res.json({ openid: 'dev_' + uuid().slice(0, 12), session_key: 'dev' })
  }
})

export default router
