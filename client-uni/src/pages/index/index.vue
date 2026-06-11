<template>
  <view class="home">
    <view class="header">
      <view class="logo-area">
        <text class="logo-icon">🌸</text>
        <view>
          <text class="logo-title">花<text class="rose">期</text></text>
          <text class="logo-sub">发现四季好去处</text>
        </view>
      </view>
      <text class="hdr-fav" @tap="goFavs">🔖</text>
    </view>

    <view class="search-card" @tap="goSearch">
      <text class="s-icon">🔍</text>
      <text class="s-text">想去哪？输入目的地或主题…</text>
    </view>

    <ShimmerCard v-if="!themes.length && !nearby.length && !inSeason.length" :showPills="true" :rows="2" :cols="2" :imgSize="120" />

    <view class="section">
      <view class="section-hd">
        <text class="section-tt">🌸 当季热门</text>
        <text class="section-more" @tap="goSearch">查看全部 ›</text>
      </view>
      <scroll-view class="theme-scroll" scroll-x enhanced show-scrollbar="false">
        <view class="theme-pill" v-for="t in themes" :key="t.id" @tap="searchTheme(t.name)">
          <text class="tp-icon">{{ t.icon }}</text>
          <text class="tp-name">{{ t.name }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="section" v-if="inSeason.length">
      <view class="section-hd">
        <text class="section-tt">📅 {{ monthText }}</text>
      </view>
      <view class="sea-list">
        <DestCard v-for="d in inSeason" :key="d.id" :name="d.name" :description="d.description" :rating="d.rating" :bestSeason="d.best_season" :imageUrl="d.image_url" :fallbackIcon="d.icon || '🌸'" :imgSize="160" :imageRight="true" :showBestSeason="true" :showDistance="false" @tap="goDetail(d.id)" />
      </view>
    </view>

    <view class="section">
      <view class="section-hd">
        <text class="section-tt">📍 附近推荐</text>
      </view>
      <view class="nearby-list" v-if="nearby.length">
        <DestCard v-for="d in nearby" :key="d.id" :name="d.name" :description="d.description || d.address || ''" :rating="d.rating" :distance="d.distance" :imageUrl="d.image_url" :fallbackIcon="d.icon || '🌸'" :showDistance="true" @tap="goDetail(d.id)" />
      </view>
      <view class="empty-nearby" v-else @tap="retryLocation">
        <text class="en-icon">📍</text>
        <text class="en-text">获取位置失败，点此重试</text>
      </view>
    </view>

    <view class="spacer"></view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onPullDownRefresh } from '@dcloudio/uni-app'
import { api } from '../../api/index.js'
import { getLocation, clearLocationCache } from '../../api/location.js'
import DestCard from '../../components/DestCard.vue'
import ShimmerCard from '../../components/ShimmerCard.vue'

const themes = ref([]); const nearby = ref([]); const inSeason = ref([])
const monthText = ref('推荐')
const mn = ['','一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']

function cacheGet(key, ttl) {
  try {
    const raw = uni.getStorageSync('idx_' + key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (Date.now() - d.ts > ttl) return null
    return d.data
  } catch { return null }
}
function cacheSet(key, data) {
  try { uni.setStorageSync('idx_' + key, JSON.stringify({ ts: Date.now(), data })) } catch {}
}

async function load() {
  try {
    monthText.value = mn[new Date().getMonth() + 1] + '推荐'
    const loc = await getLocation()
    // try cache first
    const ct = cacheGet('themes', 300000)
    const cs = cacheGet('inSeason', 300000)
    if (ct) themes.value = ct
    if (cs) inSeason.value = cs
    const [t, n, s] = await Promise.all([api.getHotThemes(), api.getNearby(loc), api.getInSeason()])
    themes.value = t; nearby.value = n; inSeason.value = s
    cacheSet('themes', t)
    cacheSet('inSeason', s)
  } catch(e) { console.error(e); uni.showToast({ title: '加载失败，下拉重试', icon: 'none' }) }
}
onMounted(() => load())
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
function retryLocation() {
  clearLocationCache()
  load()
}
function goFavs() { uni.navigateTo({ url: '/pages/favorites/favorites' }) }
function goSearch() { uni.navigateTo({ url: '/pages/search/search' }) }
function searchTheme(n) { uni.navigateTo({ url: `/pages/search/search?q=${n}` }) }
let _navLock = false
function goDetail(id) {
  if (_navLock) return
  _navLock = true
  uni.navigateTo({ url: `/pages/detail/detail?id=${id}`, complete: () => { _navLock = false } })
}
</script>

<style>
.home { padding: 0 0 40rpx; min-height: 100vh; background: #FDF8F4; }
.header { padding: 24rpx 28rpx 8rpx; }
.logo-area { display: flex; align-items: center; gap: 14rpx; }
.logo-icon { font-size: 48rpx; }
.logo-title { font-size: 40rpx; font-weight: 700; color: #2C2422; letter-spacing: 4rpx; line-height: 1.2; }
.logo-title .rose { color: #C4817A; }
.logo-sub { font-size: 22rpx; color: #8A7A76; margin-top: 2rpx; }
.hdr-fav { font-size: 36rpx; position: absolute; top: 28rpx; right: 28rpx; }

.search-card { margin: 16rpx 24rpx 28rpx; padding: 26rpx 28rpx; background: rgba(255,255,255,0.92); border-radius: 24rpx; box-shadow: 0 4rpx 24rpx rgba(196,129,122,0.08); display: flex; align-items: center; gap: 16rpx; }
.s-icon { font-size: 28rpx; }
.s-text { font-size: 28rpx; color: #8A7A76; }

.section { margin-bottom: 32rpx; }
.section-hd { display: flex; justify-content: space-between; align-items: baseline; padding: 0 28rpx; margin-bottom: 16rpx; }
.section-tt { font-size: 28rpx; font-weight: 600; color: #2C2422; }
.section-more { font-size: 24rpx; color: #C4817A; }

.theme-scroll { padding: 0 24rpx; white-space: nowrap; }
.theme-pill { display: inline-flex; align-items: center; gap: 8rpx; margin-right: 14rpx; padding: 14rpx 24rpx; background: rgba(255,255,255,0.88); border-radius: 40rpx; box-shadow: 0 2rpx 10rpx rgba(196,129,122,0.06); }
.tp-icon { font-size: 32rpx; }
.tp-name { font-size: 24rpx; color: #2C2422; font-weight: 500; }

.sea-list { padding: 0 24rpx; display: flex; flex-direction: column; gap: 14rpx; }
.nearby-list { padding: 0 24rpx; display: flex; flex-direction: column; gap: 16rpx; }

.empty-nearby { text-align: center; padding: 60rpx; }
.en-icon { font-size: 48rpx; display: block; margin-bottom: 8rpx; }
.en-text { font-size: 24rpx; color: #8A7A76; }

.spacer { height: 40rpx; }
</style>
