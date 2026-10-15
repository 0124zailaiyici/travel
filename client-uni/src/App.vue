<template><view></view></template>

<script setup>
import { onLaunch } from '@dcloudio/uni-app'
import { cacheClearNs } from './services/cache.js'

const DATA_VERSION = '2026-07-16-v5'

onLaunch(() => {
  // 升级后自动清理旧 AI/天气缓存，避免旧乱码或旧模板继续显示
  try {
    const old = uni.getStorageSync('huaxi_data_version')
    if (old !== DATA_VERSION) {
      ;['ai', 'ai_rec', 'detail_ai', 'weather', 'nearby', 'map', 'route'].forEach(cacheClearNs)
      uni.setStorageSync('huaxi_data_version', DATA_VERSION)
    }
  } catch {}

  // 仅微信小程序需要隐私授权回调
  // #ifdef MP-WEIXIN
  const fn = (typeof wx !== 'undefined' && wx.onNeedPrivacyAuthorization) || uni.onNeedPrivacyAuthorization
  if (fn) fn((resolve) => { resolve({ buttonId: 'agree-btn', event: 'agree' }) })
  // #endif
})
</script>

<style>
page {
  background-color: #FDF8F4;
  color: #2C2422;
  font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
}
view, text, scroll-view { box-sizing: border-box; }
::-webkit-scrollbar { display: none; }
</style>
