<template>
  <view class="fp">
    <view class="fp-hd">❤️ 我的收藏</view>

    <view class="fp-shimmer" v-if="loading">
      <view class="fs-card" v-for="i in 3" :key="i"><view class="fs-img"></view><view class="fs-body"><view class="fs-l w70"></view><view class="fs-l w90"></view><view class="fs-l w40"></view></view></view>
    </view>

    <view class="fp-empty" v-if="!loading && list.length === 0">
      <text class="fp-e-icon">🔖</text>
      <text class="fp-e-tt">还没有收藏</text>
      <text class="fp-e-sub">在目的地详情页点击❤️收藏</text>
    </view>
    <view class="fp-list" v-if="list.length">
      <view class="fp-card" v-for="d in list" :key="d.id" @tap="goDetail(d.id)">
        <view class="fp-img">
          <image class="fi-i" :src="d.image_url" mode="aspectFill" v-if="d.image_url" />
          <text class="fi-fb" v-else>{{ d.themeIcon || '🌸' }}</text>
        </view>
        <view class="fp-body">
          <text class="fp-name">{{ d.name }}</text>
          <view class="fp-desc">{{ d.description }}</view>
          <view class="fp-meta">
            <text>⭐ {{ d.rating }}</text>
            <text>{{ d.best_season || '全年' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api/index.js'
import { getUserId } from '../../api/user.js'

const list = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    list.value = await api.syncGetFavs(getUserId())
  } catch(e) { console.error(e) }
  finally { loading.value = false }
})
function goDetail(id) { uni.navigateTo({ url: `/pages/detail/detail?id=${id}` }) }
</script>

<style>
.fp { min-height: 100vh; background: #FDF8F4; padding: 20rpx 24rpx; }
.fp-hd { font-size: 34rpx; font-weight: 700; color: #2C2422; margin-bottom: 24rpx; }

.fp-shimmer { display: flex; flex-direction: column; gap: 16rpx; }
.fs-card { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; }
.fs-img { width: 160rpx; height: 160rpx; flex-shrink: 0; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: fsh 1.5s infinite; }
.fs-body { flex: 1; padding: 20rpx; }
.fs-l { height: 22rpx; border-radius: 11rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: fsh 1.5s infinite; margin-bottom: 14rpx; }
.w70 { width: 70%; } .w90 { width: 90%; } .w40 { width: 40%; }
@keyframes fsh { 0%{background-position:200% 0}100%{background-position:-200% 0} }
.fp-empty { text-align: center; padding: 120rpx 0; }
.fp-e-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.fp-e-tt { font-size: 28rpx; color: #8A7A76; display: block; }
.fp-e-sub { font-size: 24rpx; color: #C4817A; margin-top: 8rpx; display: block; }
.fp-list { display: flex; flex-direction: column; gap: 16rpx; }
.fp-card { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.06); }
.fp-img { width: 160rpx; height: 160rpx; flex-shrink: 0; position: relative; overflow: hidden; background: linear-gradient(135deg,#C4817A,#9A5E58); display: flex; align-items: center; justify-content: center; }
.fi-i { width: 100%; height: 100%; }
.fi-fb { font-size: 48rpx; }
.fp-body { flex: 1; padding: 14rpx 18rpx; display: flex; flex-direction: column; }
.fp-name { font-size: 28rpx; font-weight: 600; color: #2C2422; }
.fp-desc { font-size: 22rpx; color: #8A7A76; margin: 4rpx 0; line-height: 1.5; word-break: break-all; max-height: 99rpx; overflow: hidden; }
.fp-meta { display: flex; gap: 14rpx; font-size: 20rpx; color: #8A7A76; }
</style>
