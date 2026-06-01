<template>
  <view class="dp">
    <scroll-view scroll-y class="dp-scroll">
      <view class="shim" v-if="!detail.name">
        <view class="shim-hero"></view>
        <view class="shim-card"><view class="s-l w60"></view><view class="s-l w40"></view><view class="s-l w80"></view></view>
        <view class="shim-card"><view class="s-l w50"></view><view class="s-l w90"></view><view class="s-l w90"></view></view>
      </view>

      <template v-if="detail.name">
        <view class="hero-w" :style="'background:' + bg">
          <image class="hero-i" :src="detail.image_url" mode="aspectFill" lazy-load @error="imgErr = true" v-if="detail.image_url && !imgErr"></image>
          <view class="hero-fb"><text class="hero-e">{{ detail.themeIcon || '🌸' }}</text></view>
          <view class="hero-mask"></view>
          <text class="fav-bt" @tap="toggleFav">{{ isFav ? '❤️' : '🤍' }}</text>
          <view class="hero-info">
            <text class="hero-name">{{ detail.name }}</text>
            <view class="hero-stats">
              <text>⭐ {{ detail.rating }}</text>
              <text>📍 {{ detail.distance || '?' }}km</text>
              <text>📅 {{ detail.best_season || '全年' }}</text>
              <text>⏱ {{ detail.duration }}日</text>
            </view>
          </view>
        </view>

        <view class="weather" v-if="detail.weather">
          <text>{{ detail.weather.condition }} {{ detail.weather.temp }}</text>
        </view>

        <view class="desc-box"><text>{{ detail.description }}</text></view>

        <view class="tag-row"><text class="t-tag" v-for="t in (detail.tags || [])" :key="t">{{ t }}</text></view>

        <view class="sec" v-if="detail.itinerary && detail.itinerary.length">
          <view class="sec-hd" @tap="toggleAllDays">
            <text class="sec-tt">📋 行程</text>
            <text class="sec-toggle">{{ allDaysExpanded ? '收起全部 ▲' : '展开全部 ▼' }}</text>
          </view>
          <view class="day" v-for="(day, i) in detail.itinerary" :key="i">
            <view class="day-hd" @tap="toggleDay(i)">
              <text class="day-tt">Day {{ i + 1 }} · {{ day.title }}</text>
              <text class="day-arrow">{{ expandedDays[i] ? '▲' : '▼' }}</text>
            </view>
            <view class="day-body" v-if="expandedDays[i]">
              <view class="ts" v-if="day.morning"><text class="tl ba">上午</text><text class="tx">{{ day.morning }}</text></view>
              <view class="ts" v-if="day.afternoon"><text class="tl bp">下午</text><text class="tx">{{ day.afternoon }}</text></view>
              <view class="ts" v-if="day.evening"><text class="tl be">晚上</text><text class="tx">{{ day.evening }}</text></view>
              <view class="meals" v-if="mealsList(day.meals).length">
                <text class="ml-tt">🍽️ 推荐美食</text>
                <text class="ml-i" v-for="(m, mi) in mealsList(day.meals)" :key="mi">· {{ m }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="sec" v-if="detail.tips && detail.tips.length">
          <text class="sec-tt">⚠️ 避坑</text>
          <view class="tip" v-for="(tip, i) in detail.tips" :key="i">
            <view class="tip-n"><text>{{ i + 1 }}</text></view>
            <text class="tip-t">{{ tip }}</text>
          </view>
        </view>

        <view class="sec" v-if="budgetEntries().length">
          <text class="sec-tt">💰 预算明细</text>
          <view class="bg-list">
            <view class="bg-cat" v-for="e in budgetEntries()" :key="e.key">
              <view class="bg-hd">
                <text class="bg-l">{{ e.label }}</text>
                <text class="bg-v">{{ e.total ? '¥' + e.total : '免费' }}</text>
              </view>
              <view class="bg-items" v-if="e.items.length">
                <text class="bg-item" v-for="(item, ii) in e.items" :key="ii">· {{ item.name }} ¥{{ item.cost }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="sec" v-if="detail.route || detail.transportDetail || detail.transport_guide">
          <text class="sec-tt">🚗 交通方案</text>

          <view class="rt-box" v-if="detail.route">
            <text class="rt-ori">📍 从你的位置出发</text>
            <view class="rt-row" v-if="detail.route.driving">
              <text class="rt-m">🚗 驾车</text>
              <text class="rt-info">
                {{ detail.route.driving.distance }}km ·
                约{{ detail.route.driving.duration }}分钟
                <text v-if="detail.route.driving.tolls">· 路费¥{{ detail.route.driving.tolls }}</text>
              </text>
            </view>
            <view class="rt-row" v-if="detail.route.transit">
              <text class="rt-m">🚇 公交/高铁</text>
              <text class="rt-info">
                约{{ detail.route.transit.duration }}分钟 ·
                费用¥{{ detail.route.transit.cost }}
                <text v-if="detail.route.transit.summary">· {{ detail.route.transit.summary }}</text>
              </text>
            </view>
          </view>

          <view v-if="detail.transportDetail">
            <view class="tr-section" v-if="detail.transportDetail.to_destination">
              <text class="tr-label">🚄 怎么去</text>
              <text class="tr-text">{{ detail.transportDetail.to_destination }}</text>
            </view>
            <view class="tr-section" v-if="detail.transportDetail.around">
              <text class="tr-label">🚌 当地交通</text>
              <text class="tr-text">{{ detail.transportDetail.around }}</text>
            </view>
            <view class="tr-section" v-if="detail.transportDetail.parking">
              <text class="tr-label">🚗 自驾停车</text>
              <text class="tr-text">{{ detail.transportDetail.parking }}</text>
            </view>
          </view>
          <view class="tb-note" v-else-if="!detail.route">当前目的地暂无详细交通指南</view>
        </view>

        <view class="ab"><button class="nav-bt" @tap="navigate">📍 导航去</button></view>
      </template>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api/index.js'
import { getLocation } from '../../api/location.js'

const detail = ref({}); const isFav = ref(false); const imgErr = ref(false)
const expandedDays = ref([])
const allDaysExpanded = computed(() => expandedDays.value.every(v => v))

function toggleDay(i) { expandedDays.value[i] = !expandedDays.value[i] }
function toggleAllDays() {
  const target = !allDaysExpanded.value
  expandedDays.value = expandedDays.value.map(() => target)
}
const bg = ref('linear-gradient(135deg,#E8B4AE,#C4817A,#9A5E58)')
const bgs = ['linear-gradient(135deg,#E8B4AE,#C4817A,#9A5E58)','linear-gradient(135deg,#8BA88A,#5B7B5A,#3D5A3C)','linear-gradient(135deg,#E8C4A0,#C4817A,#9A5E58)','linear-gradient(135deg,#C4817A,#5B7B5A,#3D5A3C)','linear-gradient(135deg,#F0D5C0,#E8B4AE,#C4817A)']
const labels = { transport:'交通', accommodation:'住宿', food:'餐饮', tickets:'门票', other:'其他' }
const budgetLabels = { transport:'往返交通', accommodation:'住宿', food:'餐饮', tickets:'门票', other:'其他' }

function budgetEntries() {
  const b = detail.value.budget
  if (!b) return []
  return Object.entries(b).filter(([k]) => k !== '_detail' && k !== '_transport').map(([k, v]) => {
    if (typeof v === 'object' && v !== null) {
      return { key: k, label: labels[k] || k, total: v.total || 0, items: v.items || [{ name: budgetLabels[k] || k, cost: v.total || 0 }] }
    }
    return { key: k, label: labels[k] || k, total: v || 0, items: [{ name: budgetLabels[k] || k, cost: v || 0 }] }
  })
}

function getF() { try { return JSON.parse(uni.getStorageSync('huaxi_favs')||'[]') } catch(e) { return [] } }
function toggleFav() {
  const f = getF(); const id = detail.value.id
  if (isFav.value) { uni.setStorageSync('huaxi_favs', JSON.stringify(f.filter(x=>x!==id))); isFav.value = false; uni.showToast({ title:'已取消',icon:'none' }) }
  else { f.push(id); uni.setStorageSync('huaxi_favs', JSON.stringify(f)); isFav.value = true; uni.showToast({ title:'已收藏',icon:'success' }) }
}

onLoad(async (o) => {
  if (!o.id) return
  try {
    const loc = await getLocation(); const data = await api.getDetail(o.id, loc)
    detail.value = data; isFav.value = getF().includes(data.id)
    expandedDays.value = data.itinerary?.map(() => true) || []
    bg.value = bgs[parseInt(o.id.replace('d','')) % bgs.length]
  } catch(e) { console.error(e); uni.showToast({ title:'加载失败', icon:'none' }) }
})
function mealsList(m) {
  if (!m) return []
  if (Array.isArray(m)) return m
  if (typeof m === 'string') return m.split(/[；;]/).map(s => s.trim()).filter(Boolean)
  return []
}
function navigate() {
  if (detail.value.lat && detail.value.lng) uni.openLocation({ latitude:detail.value.lat, longitude:detail.value.lng, name:detail.value.name })
}
</script>

<style>
.dp { height: 100vh; background: #FDF8F4; }
.dp-scroll { height: 100%; padding-bottom: 100rpx; }

.shim { padding: 0 24rpx; }
.shim-hero { height: 420rpx; border-radius: 0 0 24rpx 24rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: sh 1.5s infinite; }
.shim-card { margin-top: 20rpx; padding: 28rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; }
.s-l { height: 24rpx; border-radius: 12rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: sh 1.5s infinite; margin-bottom:14rpx; }
.w60{width:60%}.w40{width:40%}.w80{width:80%}.w50{width:50%}.w90{width:90%}
@keyframes sh { 0%{background-position:200% 0}100%{background-position:-200% 0} }

.hero-w { position: relative; height: 420rpx; overflow: hidden; background: #f0e8e4; }
.hero-i { width: 100%; height: 100%; }
.hero-fb { position: absolute; top:0;left:0;right:0;bottom:0; display: flex; align-items: flex-end; justify-content: center; }
.hero-e { font-size: 80rpx; margin-bottom: 80rpx; }
.hero-mask { position: absolute; bottom:0;left:0;right:0; height: 180rpx; background: linear-gradient(transparent,#FDF8F4); }
.hero-info { position: absolute; bottom: 24rpx; left: 24rpx; right: 24rpx; z-index: 2; }
.hero-name { font-size: 36rpx; font-weight: 700; color: #fff; text-shadow: 0 2rpx 12rpx rgba(0,0,0,0.3); display: block; margin-bottom: 6rpx; }
.hero-stats { display: flex; flex-wrap: wrap; gap: 12rpx 16rpx; font-size: 22rpx; color: rgba(255,255,255,0.9); text-shadow: 0 1rpx 6rpx rgba(0,0,0,0.2); }
.fav-bt { position: absolute; top: 60rpx; right: 24rpx; font-size: 44rpx; z-index: 3; }

.weather { margin: -20rpx 24rpx 0; position: relative; z-index: 2; padding: 10rpx 20rpx; background: rgba(91,123,90,0.1); border-radius: 16rpx; display: inline-flex; font-size: 22rpx; color: #5B7B5A; }

.desc-box { margin: 16rpx 24rpx 0; font-size: 24rpx; color: #8A7A76; line-height: 1.7; word-break: break-word; overflow-wrap: break-word; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8rpx; margin: 12rpx 24rpx; }
.t-tag { padding: 4rpx 18rpx; border-radius: 20rpx; font-size: 20rpx; background: rgba(196,129,122,0.08); color: #C4817A; }

.sec { margin: 20rpx 24rpx; padding: 24rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.04); }
.sec-tt { font-size: 28rpx; font-weight: 600; color: #2C2422; display: block; }
.sec-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; cursor: pointer; }
.sec-toggle { font-size: 22rpx; color: #C4817A; }

.day-hd { display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 10rpx; }
.day-arrow { font-size: 20rpx; color: #C4817A; }
.day-body { overflow: hidden; }

.day { margin-bottom: 16rpx; padding: 16rpx; background: rgba(196,129,122,0.04); border-radius: 14rpx; border-left: 4rpx solid #C4817A; }
.day-tt { font-size: 24rpx; font-weight: 600; color: #C4817A; margin-bottom: 10rpx; display: block; }
.ts { display: flex; gap: 10rpx; margin: 8rpx 0; }
.tl { width: 64rpx; flex-shrink: 0; font-size: 20rpx; font-weight: 600; text-align: center; padding: 4rpx 0; border-radius: 10rpx; height: fit-content; }
.ba { background: rgba(232,180,174,0.2); color: #C4817A; }
.bp { background: rgba(91,123,90,0.15); color: #5B7B5A; }
.be { background: rgba(44,36,34,0.08); color: #5C4A46; }
.tx { font-size: 22rpx; color: #2C2422; line-height: 1.7; flex: 1; }

.meals { margin-top: 10rpx; padding: 12rpx 14rpx; background: rgba(232,196,160,0.12); border-radius: 10rpx; }
.ml-tt { font-size: 22rpx; font-weight: 600; color: #C4817A; display: block; margin-bottom: 6rpx; }
.ml-i { font-size: 20rpx; color: #5C4A46; display: block; margin: 3rpx 0; line-height: 1.5; }

.tip { display: flex; gap: 10rpx; padding: 10rpx 0; border-bottom: 1rpx solid rgba(196,129,122,0.05); }
.tip:last-child { border-bottom: none; }
.tip-n { width: 32rpx; height: 32rpx; border-radius: 50%; flex-shrink: 0; background: rgba(232,196,160,0.3); color: #C4817A; display: flex; align-items: center; justify-content: center; font-size: 18rpx; margin-top: 2rpx; }
.tip-t { font-size: 22rpx; color: #8A7A76; line-height: 1.6; flex: 1; }

.bg-list { display: flex; flex-direction: column; gap: 16rpx; }
.bg-cat { background: rgba(196,129,122,0.03); border-radius: 12rpx; padding: 14rpx; }
.bg-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.bg-l { font-size: 24rpx; color: #8A7A76; font-weight: 500; }
.bg-v { font-size: 28rpx; font-weight: 700; color: #C4817A; }
.bg-items { padding-left: 8rpx; }
.bg-item { font-size: 22rpx; color: #5C4A46; display: block; margin: 4rpx 0; line-height: 1.5; }

.tb { background: rgba(91,123,90,0.06); border-radius: 12rpx; padding: 16rpx; font-size: 22rpx; color: #8A7A76; line-height: 1.7; }
.tb-note { background: rgba(196,129,122,0.06); border-radius: 12rpx; padding: 16rpx; font-size: 22rpx; color: #C4817A; text-align: center; }
.rt-box { background: rgba(91,123,90,0.06); border-radius: 12rpx; padding: 16rpx; margin-bottom: 16rpx; }
.rt-ori { font-size: 22rpx; font-weight: 600; color: #5B7B5A; display: block; margin-bottom: 10rpx; }
.rt-row { display: flex; gap: 10rpx; margin: 6rpx 0; align-items: baseline; }
.rt-m { font-size: 22rpx; color: #C4817A; font-weight: 600; width: 100rpx; flex-shrink: 0; }
.rt-info { font-size: 22rpx; color: #8A7A76; line-height: 1.5; }

.tr-section { margin-bottom: 16rpx; }
.tr-label { font-size: 24rpx; font-weight: 600; color: #5B7B5A; display: block; margin-bottom: 6rpx; }
.tr-text { font-size: 22rpx; color: #8A7A76; line-height: 1.7; display: block; }

.ab { padding: 20rpx 24rpx 40rpx; }
.nav-bt { width: 100%; padding: 26rpx; background: linear-gradient(135deg,#C4817A,#9A5E58); color: #fff; border: none; border-radius: 50rpx; font-size: 28rpx; font-weight: 600; box-shadow: 0 6rpx 24rpx rgba(196,129,122,0.3); }
</style>
