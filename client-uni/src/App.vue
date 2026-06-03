<template><view></view></template>

<script setup>
import { onLaunch } from '@dcloudio/uni-app'
onLaunch(() => {
  const fn = wx.onNeedPrivacyAuthorization || uni.onNeedPrivacyAuthorization
  if (fn) {
    fn((resolve) => { resolve({ buttonId: 'agree-btn', event: 'agree' }) })
  }
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
