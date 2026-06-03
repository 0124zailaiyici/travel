<template>
  <view class="fp">
    <view class="fp-hd">❤️ 我的收藏</view>
    <ShimmerCard v-if="loading" :lines="3" :cols="1" :imgSize="160" :lineCount="3" />
    <view class="fp-empty" v-if="!loading && list.length === 0">
      <text class="fp-e-icon">🔖</text>
      <text class="fp-e-tt">还没有收藏</text>
      <text class="fp-e-sub">在目的地详情页点击❤️收藏</text>
    </view>
    <view class="fp-list" v-if="list.length">
      <DestCard v-for="d in list" :key="d.id" :name="d.name" :description="d.description" :rating="d.rating" :bestSeason="d.best_season" :imageUrl="d.image_url" :fallbackIcon="d.themeIcon || '🌸'" :imgSize="160" :showDistance="false" :showBestSeason="true" @tap="goDetail(d.id)" />
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api/index.js'
import { getUserId } from '../../api/user.js'
import DestCard from '../../components/DestCard.vue'
import ShimmerCard from '../../components/ShimmerCard.vue'

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
.fp-empty { text-align: center; padding: 120rpx 0; }
.fp-e-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.fp-e-tt { font-size: 28rpx; color: #8A7A76; display: block; }
.fp-e-sub { font-size: 24rpx; color: #C4817A; margin-top: 8rpx; display: block; }
.fp-list { display: flex; flex-direction: column; gap: 16rpx; }
</style>
