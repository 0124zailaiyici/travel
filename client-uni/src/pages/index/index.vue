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

    <view class="shimmer" v-if="!themes.length && !nearby.length && !inSeason.length">
      <view class="sh-pills"><view class="sh-pill" v-for="i in 5" :key="i"></view></view>
      <view class="sh-card-row"><view class="sh-hcard" v-for="i in 2" :key="i"><view class="sh-hbody"><view class="sh-l w70"></view><view class="sh-l w90"></view><view class="sh-l w50"></view></view><view class="sh-himg"></view></view></view>
      <view class="sh-card-row"><view class="sh-hcard" v-for="i in 2" :key="i"><view class="sh-himg"></view><view class="sh-hbody"><view class="sh-l w70"></view><view class="sh-l w90"></view><view class="sh-l w40"></view></view></view></view>
    </view>

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
        <view class="sea-card" v-for="d in inSeason" :key="d.id" @tap="goDetail(d.id)">
          <view class="sea-body">
            <text class="sea-name">{{ d.name }}</text>
            <view class="sea-desc">{{ d.description }}</view>
            <view class="sea-meta"><text>⭐ {{ d.rating }}</text><text>{{ d.best_season }}</text></view>
          </view>
          <view class="sea-img" :style="'background:linear-gradient(135deg,#D4A69E,#B36A5E)'">
            <image class="si-i" :src="d.image_url" mode="aspectFill" lazy-load />
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-hd">
        <text class="section-tt">📍 附近推荐</text>
      </view>
      <view class="nearby-list" v-if="nearby.length">
        <view class="nb-card" v-for="d in nearby" :key="d.id" @tap="goDetail(d.id)">
          <view class="nb-img">
            <image class="ni-i" :src="d.image_url" mode="aspectFill" lazy-load v-if="d.image_url" />
            <text class="ni-fb" v-else>{{ d.icon || '🌸' }}</text>
          </view>
          <view class="nb-body">
            <text class="nb-name">{{ d.name }}</text>
            <view class="nb-desc">{{ d.description || d.address || '' }}</view>
            <view class="nb-foot">
              <text class="nb-star">⭐ {{ d.rating }}</text>
              <text class="nb-dist">{{ d.distance }}km</text>
            </view>
          </view>
        </view>
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

const themes = ref([]); const nearby = ref([]); const inSeason = ref([])
const monthText = ref('推荐')
const mn = ['','一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']

async function load() {
  try {
    monthText.value = mn[new Date().getMonth() + 1] + '推荐'
    const loc = await getLocation()
    const [t, n, s] = await Promise.all([api.getHotThemes(), api.getNearby(loc), api.getInSeason()])
    themes.value = t; nearby.value = n; inSeason.value = s
  } catch(e) { console.error(e) }
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
function goDetail(id) { uni.navigateTo({ url: `/pages/detail/detail?id=${id}` }) }
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
.sea-card { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(196,129,122,0.06); }
.sea-body { flex: 1; padding: 18rpx 20rpx; display: flex; flex-direction: column; justify-content: center; }
.sea-name { font-size: 26rpx; font-weight: 600; color: #2C2422; margin-bottom: 4rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sea-desc { font-size: 22rpx; color: #8A7A76; line-height: 1.5; word-break: break-all; max-height: 99rpx; overflow: hidden; }
.sea-meta { display: flex; gap: 14rpx; font-size: 20rpx; color: #8A7A76; margin-top: 6rpx; min-width: 0; }
.sea-img { width: 160rpx; height: 160rpx; flex-shrink: 0; position: relative; overflow: hidden; }
.si-i { width: 100%; height: 100%; }

.nearby-list { padding: 0 24rpx; display: flex; flex-direction: column; gap: 16rpx; }
.nb-card { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.06); }
.nb-img { width: 180rpx; height: 180rpx; flex-shrink: 0; position: relative; overflow: hidden; background: linear-gradient(135deg,#E8B4AE,#C4817A); display: flex; align-items: center; justify-content: center; }
.ni-i { width: 100%; height: 100%; }
.ni-fb { font-size: 40rpx; }
.nb-body { flex: 1; padding: 16rpx 18rpx; display: flex; flex-direction: column; min-width: 0; }
.nb-name { font-size: 26rpx; font-weight: 600; color: #2C2422; margin-bottom: 4rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-desc { font-size: 22rpx; color: #8A7A76; line-height: 1.5; flex: 1; word-break: break-all; max-height: 99rpx; overflow: hidden; }
.nb-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 8rpx; }
.nb-star { font-size: 22rpx; color: #E8A838; }
.nb-dist { font-size: 22rpx; color: #C4817A; font-weight: 600; flex-shrink: 0; }

.shimmer { padding: 24rpx; }
.sh-pills { display: flex; gap: 14rpx; margin-bottom: 24rpx; }
.sh-pill { width: 120rpx; height: 48rpx; border-radius: 24rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sh-card-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.sh-hcard { flex: 1; display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; }
.sh-himg { width: 120rpx; height: 120rpx; flex-shrink: 0; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sh-hbody { flex: 1; padding: 16rpx; }
.sh-l { height: 22rpx; border-radius: 11rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; margin-bottom: 14rpx; }
.w70 { width: 70%; } .w90 { width: 90%; } .w50 { width: 50%; } .w40 { width: 40%; }
@keyframes shim { 0%{background-position:200% 0}100%{background-position:-200% 0} }

.empty-nearby { text-align: center; padding: 60rpx; }
.en-icon { font-size: 48rpx; display: block; margin-bottom: 8rpx; }
.en-text { font-size: 24rpx; color: #8A7A76; }

.spacer { height: 40rpx; }
</style>
