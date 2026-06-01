<template>
  <view class="sp">
    <view class="sp-top">
      <text class="sp-back" @tap="goBack">‹</text>
      <input class="sp-input" v-model="query" placeholder="搜索目的地…" @confirm="doSearch" confirm-type="search" @input="onInput" @focus="onFocus" @blur="hideSuggest" />
    </view>
    <view class="sp-suggest" v-if="suggestions.length && showSuggest">
      <view class="sg-item" v-for="s in suggestions" :key="s.id" @tap="pickSuggest(s)">{{ s.name }}</view>
    </view>
    <view class="sp-history" v-if="!query.trim() && !suggestions.length && history.length">
      <view class="sp-hd">最近搜索</view>
      <view class="sp-h-list">
        <text class="sp-h-item" v-for="(h, i) in history" :key="i" @tap="pickHistory(h)">🕐 {{ h }}</text>
      </view>
    </view>

    <scroll-view class="sp-filter" scroll-x enhanced show-scrollbar="false">
      <text class="fp" v-for="f in filters" :key="f.key" :class="{ act: activeFilter === f.key }" @tap="switchFilter(f.key)">{{ f.label }}</text>
    </scroll-view>

    <scroll-view class="sp-dfilter" scroll-x enhanced show-scrollbar="false" v-if="list.length">
      <text class="dfp" v-for="r in distRanges" :key="r.key" :class="{ act: activeDist === r.key }" @tap="switchDist(r.key)">{{ r.label }}</text>
    </scroll-view>

    <text class="sp-count" v-if="!loading && displayList.length">共 <text class="hl">{{ displayList.length }}</text> 个结果</text>

    <view class="sp-shimmer" v-if="loading">
      <view class="sh-card" v-for="i in 4" :key="i"><view class="sh-img"></view><view class="sh-body"><view class="sh-l w60"></view><view class="sh-l w90"></view><view class="sh-l w40"></view></view></view>
    </view>

    <view class="sp-list" v-if="!loading">
      <view class="rs-card" v-for="d in displayList" :key="d.id" @tap="goDetail(d.id)">
        <image class="rs-img" :src="d.image_url" mode="aspectFill" lazy-load @error="d.imgErr = true" v-if="!d.imgErr"></image>
        <view class="rs-fb" v-if="d.imgErr">{{ d.icon || '🌸' }}</view>
        <view class="rs-body">
          <view class="rs-top">
            <view class="rs-name">{{ d.name }}</view>
            <text class="rs-dist">{{ d.distance || '?' }}km</text>
          </view>
          <view class="rs-desc">{{ d.description }}</view>
          <view class="rs-meta">
            <text class="rs-star">⭐ {{ d.rating }}</text>
            <text>{{ d.duration || '1日游' }}</text>
          </view>
          <view class="rs-tags">
            <text class="rs-tag" v-for="t in (d.tags || [])" :key="t">{{ t }}</text>
          </view>
        </view>
      </view>
      <view class="sp-empty" v-if="!loading && displayList.length === 0 && searched">
        <text class="e-icon">🔍</text>
        <text class="e-tt">{{ list.length ? '当前距离范围内没有结果' : '没找到相关目的地' }}</text>
        <text class="e-sub">试试其他关键词或调整距离</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { api } from '../../api/index.js'
import { getLocation } from '../../api/location.js'

const query = ref(''); const list = ref([]); const loading = ref(false); const searched = ref(false); const activeFilter = ref('distance')
const filters = [{ key:'distance', label:'最近' },{ key:'rating', label:'评分' },{ key:'赏樱', label:'🌸赏樱' },{ key:'雪山', label:'🏔️雪山' },{ key:'海岛', label:'🏖️海岛' },{ key:'古镇', label:'🏯古镇' }]

const suggestions = ref([]); const showSuggest = ref(false); let suggestTimer = null

// distance filter
const activeDist = ref(0)
const distRanges = [
  { key:0, label:'全部' },
  { key:50, label:'50km' },
  { key:100, label:'100km' },
  { key:200, label:'200km' },
  { key:500, label:'500km' }
]
function switchDist(k) { activeDist.value = k }

// filtered display list
const displayList = ref([])
watch([list, activeDist], () => {
  const max = activeDist.value
  displayList.value = !max ? list.value : list.value.filter(d => (d.distance || 9999) <= max)
}, { immediate: true })

// search history
const history = ref([])
function loadHistory() {
  try {
    const raw = JSON.parse(uni.getStorageSync('search_history') || '[]')
    if (!Array.isArray(raw)) { history.value = []; return }
    history.value = raw.filter(x => typeof x === 'string')
  } catch(e) { history.value = [] }
}
function saveHistory(q) {
  if (!q || !q.trim) return
  const s = String(q).trim()
  if (!s) return
  const h = [s, ...history.value.filter(x => x !== s)].slice(0, 8)
  uni.setStorageSync('search_history', JSON.stringify(h))
  history.value = h
}

onLoad((o) => { loadHistory(); if (o.q) { query.value = o.q; doSearch() } })
function onInput() {
  clearTimeout(suggestTimer)
  if (!query.value.trim()) { suggestions.value = []; showSuggest.value = false; return }
  suggestTimer = setTimeout(async () => {
    suggestions.value = await api.getSuggestions(query.value)
    showSuggest.value = suggestions.value.length > 0
  }, 150)
}
function onFocus() {
  if (!query.value.trim()) loadHistory()
}
function pickSuggest(s) { query.value = s.name; showSuggest.value = false; doSearch() }
function pickHistory(h) { query.value = h; doSearch() }
function hideSuggest() { setTimeout(() => { showSuggest.value = false }, 200) }

async function doSearch() {
  if (!query.value.trim()) return; loading.value = true; searched.value = true; showSuggest.value = false; activeDist.value = 0
  saveHistory(query.value)
  try { const loc = await getLocation(); list.value = await api.searchDestinations(query.value, '', loc) }
  catch(e) { console.error(e) }
  finally { loading.value = false }
}
onPullDownRefresh(() => doSearch().finally(() => uni.stopPullDownRefresh()))
function switchFilter(k) {
  activeFilter.value = k
  if (['赏樱','雪山','海岛','古镇'].includes(k)) { query.value = k; doSearch(); return }
  list.value = [...list.value].sort((a, b) => k === 'rating' ? b.rating - a.rating : (a.distance||999) - (b.distance||999))
}
function goDetail(id) { uni.navigateTo({ url: `/pages/detail/detail?id=${id}` }) }
function goBack() { uni.navigateBack() }
</script>

<style>
.sp { min-height: 100vh; background: #FDF8F4; }
.sp-top { padding: 16rpx 24rpx; display: flex; gap: 16rpx; align-items: center; background: rgba(253,248,244,0.95); }
.sp-back { font-size: 44rpx; color: #2C2422; line-height: 1; }
.sp-input { flex: 1; padding: 18rpx 24rpx; border: none; border-radius: 40rpx; background: rgba(255,255,255,0.85); font-size: 26rpx; }
.sp-filter { padding: 16rpx 24rpx; white-space: nowrap; }
.fp { display: inline-flex; padding: 8rpx 24rpx; margin-right: 10rpx; border-radius: 30rpx; font-size: 24rpx; background: rgba(255,255,255,0.7); color: #8A7A76; }
.fp.act { background: #C4817A; color: #fff; }
.sp-count { padding: 8rpx 28rpx; font-size: 24rpx; color: #8A7A76; }
.hl { color: #C4817A; font-weight: 600; }

/* shimmer */
.sp-shimmer { padding: 0 20rpx; }
.sh-card { display: flex; margin-bottom: 16rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; }
.sh-img { width: 200rpx; height: 200rpx; flex-shrink: 0; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sh-body { flex: 1; padding: 20rpx; }
.sh-l { height: 22rpx; border-radius: 11rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; margin-bottom: 14rpx; }
.w60 { width: 60%; } .w90 { width: 90%; } .w40 { width: 40%; }
@keyframes shim { 0%{background-position:200% 0}100%{background-position:-200% 0} }

.sp-list { padding: 0 20rpx 40rpx; display: flex; flex-direction: column; gap: 16rpx; }
.rs-card { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.06); position: relative; }
.rs-img { width: 200rpx; height: 200rpx; flex-shrink: 0; background: #f0e8e4; }
.rs-fb { position: absolute; left: 0; top: 0; width: 200rpx; height: 200rpx; display: flex; align-items: center; justify-content: center; font-size: 48rpx; background: linear-gradient(135deg,#E8B4AE,#C4817A); }
.rs-body { flex: 1; padding: 16rpx 18rpx; display: flex; flex-direction: column; min-width: 0; }
.rs-top { display: flex; flex-direction: row; min-width: 0; }
.rs-name { font-size: 28rpx; font-weight: 600; color: #2C2422; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.rs-dist { font-size: 22rpx; color: #C4817A; font-weight: 600; flex-shrink: 0; margin-left: auto; padding-left: 8rpx; }
.rs-desc { font-size: 22rpx; color: #8A7A76; line-height: 1.5; margin: 6rpx 0 4rpx; word-break: break-all; max-height: 99rpx; overflow: hidden; }
.rs-meta { display: flex; gap: 14rpx; font-size: 22rpx; margin: 4rpx 0; }
.rs-star { color: #E8A838; }
.rs-tags { display: flex; flex-wrap: wrap; gap: 6rpx; margin-top: 6rpx; }
.rs-tag { padding: 4rpx 14rpx; border-radius: 14rpx; font-size: 20rpx; background: rgba(196,129,122,0.08); color: #C4817A; }

.sp-history { margin: 0 24rpx; padding: 16rpx 0; }
.sp-hd { font-size: 22rpx; color: #8A7A76; margin-bottom: 10rpx; }
.sp-h-list { display: flex; flex-wrap: wrap; gap: 10rpx; }
.sp-h-item { font-size: 22rpx; color: #5C4A46; padding: 6rpx 16rpx; background: rgba(255,255,255,0.7); border-radius: 24rpx; }

.sp-dfilter { padding: 0 24rpx 12rpx; white-space: nowrap; }
.dfp { display: inline-flex; padding: 6rpx 20rpx; margin-right: 8rpx; border-radius: 24rpx; font-size: 22rpx; background: rgba(255,255,255,0.5); color: #8A7A76; }
.dfp.act { background: rgba(91,123,90,0.15); color: #5B7B5A; font-weight: 600; }

.sp-suggest { margin: 0 24rpx; background: #fff; border-radius: 12rpx; box-shadow: 0 4rpx 20rpx rgba(44,36,34,0.08); position: relative; z-index: 10; }
.sg-item { padding: 20rpx 24rpx; font-size: 26rpx; color: #2C2422; border-bottom: 1rpx solid #f5efeb; }
.sg-item:last-child { border-bottom: none; }
.sg-item:active { background: #f5efeb; }

.sp-empty { text-align: center; padding: 120rpx 0; }
.e-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.e-tt { font-size: 28rpx; color: #8A7A76; display: block; }
.e-sub { font-size: 24rpx; color: #C4817A; margin-top: 8rpx; display: block; }
</style>
