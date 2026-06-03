<template>
  <view class="sp">
    <view class="sp-top">
      <text class="sp-back" @tap="goBack">‹</text>
      <input class="sp-input" v-model="query" placeholder="搜索目的地…" @confirm="doSearch" confirm-type="search" @input="onInput" @focus="onFocus" @blur="hideSuggest" />
      <text class="sp-filter-bt" @tap="showPanel = !showPanel">▦<text class="fb-dot" v-if="filterTheme || filterRating || filterDuration"></text></text>
    </view>

    <!-- autocomplete -->
    <view class="sp-suggest" v-if="suggestions.length && showSuggest">
      <view class="sg-item" v-for="s in suggestions" :key="s.id" @tap="pickSuggest(s)">{{ s.name }}</view>
    </view>

    <!-- search history -->
    <view class="sp-history" v-if="!query.trim() && !suggestions.length && history.length && !showPanel">
      <view class="sp-hd">最近搜索</view>
      <view class="sp-h-list">
        <text class="sp-h-item" v-for="(h, i) in history" :key="i" @tap="pickHistory(h)">{{ h }}</text>
      </view>
    </view>

    <!-- filter panel overlay -->
    <view class="sp-overlay" v-if="showPanel" @tap="showPanel = false"></view>
    <view class="sp-panel" v-if="showPanel">
      <view class="pl-section">
        <text class="pl-label">主题</text>
        <view class="pl-pills">
          <text class="pl-pill" v-for="t in allThemes" :key="t.id" :class="{ act: filterTheme === t.id }" @tap="toggleTheme(t.id)">{{ t.icon }} {{ t.name }}</text>
        </view>
      </view>
      <view class="pl-section">
        <text class="pl-label">最低评分</text>
        <view class="pl-pills">
          <text class="pl-pill" v-for="r in ratingOpts" :key="r" :class="{ act: filterRating === r }" @tap="onRatingChange(r)">{{ r === 0 ? '不限' : '⭐' + r + '+' }}</text>
        </view>
      </view>
      <view class="pl-section">
        <text class="pl-label">行程天数</text>
        <view class="pl-pills">
          <text class="pl-pill" v-for="d in durationOpts" :key="d.key" :class="{ act: filterDuration === d.key }" @tap="onDurationChange(d.key)">{{ d.label }}</text>
        </view>
      </view>
    </view>

    <!-- browse history -->
    <view class="sp-history" v-if="!query.trim() && !suggestions.length && browseHistory.length && !showPanel">
      <view class="sp-hd">浏览记录</view>
      <view class="sp-h-list">
        <text class="sp-h-item" v-for="(h, i) in browseHistory" :key="i" @tap="goDetail(h.id)">{{ h.name }}</text>
      </view>
    </view>

    <!-- nearby popular (idle) -->
    <view class="sp-nearby" v-if="!query.trim() && !searched && !showPanel">
      <view class="nb-section" v-if="nbLoaded && !nearbyList.length">
        <text class="nb-tt2">暂无附近推荐</text>
      </view>
      <view class="nb-section" v-if="nearbyList.length">
        <text class="nb-tt">📍 附近推荐</text>
        <DestCard v-for="d in nearbyList" :key="d.id" :name="d.name" :description="d.description" :rating="d.rating" :distance="d.distance" :imageUrl="d.image_url" :fallbackIcon="d.icon || '🌸'" :showDistance="true" @tap="goDetail(d.id)" />
      </view>
      <ShimmerCard v-if="!nbLoaded" :rows="3" :cols="1" :imgSize="180" :lineCount="2" :lineWidths="['w70','w90']" />
    </view>

    <!-- sort + distance filters (only when results exist) -->
    <view class="sp-bar" v-if="list.length">
      <scroll-view class="sp-sort" scroll-x enhanced show-scrollbar="false">
        <text class="sp-sb" :class="{ act: sortBy === 'distance' }" @tap="sortBy='distance';sortList()">最近</text>
        <text class="sp-sb" :class="{ act: sortBy === 'rating' }" @tap="sortBy='rating';sortList()">评分</text>
      </scroll-view>
      <scroll-view class="sp-dfilter" scroll-x enhanced show-scrollbar="false">
        <text class="dfp" v-for="r in distRanges" :key="r.key" :class="{ act: activeDist === r.key }" @tap="switchDist(r.key)">{{ r.label }}</text>
      </scroll-view>
    </view>

    <text class="sp-count" v-if="!loading && displayList.length">共 <text class="hl">{{ total }}</text> 个结果</text>

    <!-- shimmer -->
    <ShimmerCard v-if="loading" :rows="4" :cols="1" :imgSize="200" :lineCount="3" :lineWidths="['w60','w90','w40']" />

    <!-- result list -->
    <view class="sp-list" v-if="!loading && searched">
      <DestCard v-for="d in displayList" :key="d.id" :name="d.name" :description="d.description" :rating="d.rating" :bestSeason="null" :distance="d.distance" :duration="d.duration" :imageUrl="d.image_url" :fallbackIcon="d.icon || '🌸'" :tags="d.tags" :showDistance="true" :showTags="true" @tap="goDetail(d.id)" />
      <view class="sp-more" v-if="displayList.length && hasMore" @tap="loadMore">
        <text v-if="!loadingMore">加载更多…</text>
        <text v-else>加载中…</text>
      </view>
      <view class="sp-empty" v-if="!loading && displayList.length === 0 && searched">
        <text class="e-icon">🔍</text>
        <text class="e-tt">{{ list.length ? '当前距离范围内没有结果' : '没找到相关目的地' }}</text>
        <text class="e-sub">试试其他关键词、主题或调整筛选条件</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { api } from '../../api/index.js'
import { getLocation } from '../../api/location.js'
import { getUserId, ensureUserId } from '../../api/user.js'
import DestCard from '../../components/DestCard.vue'
import ShimmerCard from '../../components/ShimmerCard.vue'

const query = ref('')
const list = ref([])
const displayList = ref([])
const nearbyList = ref([])
const nbLoaded = ref(false)
const loading = ref(false)
const searched = ref(false)
const sortBy = ref('distance')
const showPanel = ref(false)
const page = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loadingMore = ref(false)
let lastParams = null

// filters
const allThemes = ref([])
const filterTheme = ref('')
const filterRating = ref(0)
const filterDuration = ref(0)
const ratingOpts = [0, 3, 3.5, 4, 4.5]
const durationOpts = [
  { key: 0, label: '不限' },
  { key: 1, label: '1日游' },
  { key: 2, label: '2-3天' },
  { key: 4, label: '4天+' }
]

// distance filter
const activeDist = ref(0)
const distRanges = [
  { key: 0, label: '全部' },
  { key: 50, label: '50km' },
  { key: 100, label: '100km' },
  { key: 200, label: '200km' },
  { key: 500, label: '500km' }
]
function switchDist(k) { activeDist.value = k }

// autocomplete
const suggestions = ref([])
const showSuggest = ref(false)
let suggestTimer = null

// browse history
const browseHistory = ref([])
const browseLoading = ref(false)

// history
const history = ref([])
function loadHistory() {
  try {
    const raw = JSON.parse(uni.getStorageSync('search_history') || '[]')
    history.value = Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : []
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

onLoad(async (o) => {
  loadHistory()
  browseLoading.value = true
  const realUid = await ensureUserId()
  api.getHistory(realUid || getUserId()).then(r => { browseHistory.value = (r || []).slice(0, 10) }).catch(() => {})
    .finally(() => { browseLoading.value = false })
  allThemes.value = await api.getAllThemes()
  if (o.q) { query.value = o.q; doSearch() }
  else if (o.theme) { filterTheme.value = o.theme; doSearch() }
  else { loadNearby() }
})

onReachBottom(() => {
  if (searched.value && hasMore.value && !loadingMore.value) loadMore()
})

async function loadNearby() {
  try {
    const loc = await getLocation()
    if (loc) {
      const res = await api.searchDestinations({ lat: loc.lat, lng: loc.lng })
      nearbyList.value = res.list || res
    }
  } catch(e) { console.error(e); uni.showToast({ title: '获取附近推荐失败', icon: 'none' }) }
  finally { nbLoaded.value = true }
}

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
function toggleTheme(id) {
  filterTheme.value = filterTheme.value === id ? '' : id
  doSearch()
}
function onRatingChange(r) { filterRating.value = r; doSearch() }
function onDurationChange(k) { filterDuration.value = k; doSearch() }

async function doSearch() {
  showPanel.value = false
  searched.value = true
  page.value = 1
  loading.value = true
  if (query.value.trim()) saveHistory(query.value)
  try {
    const loc = await getLocation()
    const params = { q: query.value.trim(), lat: loc?.lat, lng: loc?.lng }
    if (filterTheme.value) params.theme = filterTheme.value
    if (filterRating.value) params.minRating = filterRating.value
    if (filterDuration.value) params.maxDuration = filterDuration.value
    lastParams = params
    const res = await api.searchDestinations(params, 1)
    list.value = res.list || []
    total.value = res.total || res.list?.length || 0
    hasMore.value = list.value.length < total.value
  } catch(e) { console.error(e); uni.showToast({ title: '搜索失败，请重试', icon: 'none' }) }
  finally { loading.value = false }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const np = page.value + 1
    const res = await api.searchDestinations(lastParams, np)
    const newItems = res.list || []
    list.value = list.value.concat(newItems)
    page.value = np
    hasMore.value = list.value.length < (res.total || total.value)
  } catch(e) { console.error(e) }
  finally { loadingMore.value = false }
}

function sortList() {
  const sorted = [...list.value]
  if (sortBy.value === 'rating') {
    sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
  } else {
    sorted.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999))
  }
  list.value = sorted
}

// distance filter
watch([list, activeDist], () => {
  const max = activeDist.value
  displayList.value = !max ? list.value : list.value.filter(d => (d.distance || 9999) <= max)
}, { immediate: true })

onPullDownRefresh(() => (searched.value ? doSearch() : loadNearby()).finally(() => uni.stopPullDownRefresh()))

function goDetail(id) { uni.navigateTo({ url: `/pages/detail/detail?id=${id}` }) }
function goBack() { uni.navigateBack() }
</script>

<style>
.sp { min-height: 100vh; background: #FDF8F4; }
.sp-top { padding: 16rpx 24rpx; display: flex; gap: 12rpx; align-items: center; background: rgba(253,248,244,0.95); position: sticky; top: 0; z-index: 20; }
.sp-back { font-size: 44rpx; color: #2C2422; line-height: 1; }
.sp-input { flex: 1; padding: 18rpx 24rpx; border: none; border-radius: 40rpx; background: rgba(255,255,255,0.85); font-size: 26rpx; }
.sp-filter-bt { font-size: 36rpx; color: #8A7A76; padding: 8rpx; position: relative; }
.fb-dot { position: absolute; top: 2rpx; right: 0; width: 14rpx; height: 14rpx; border-radius: 50%; background: #E86A5E; border: 2rpx solid #FDF8F4; }

.sp-overlay { position: fixed; inset: 0; z-index: 9; }
.sp-panel { position: absolute; top: 96rpx; left: 20rpx; right: 20rpx; z-index: 10; padding: 24rpx; background: #fff; border-radius: 16rpx; box-shadow: 0 8rpx 40rpx rgba(44,36,34,0.12); }
.pl-section { margin-bottom: 16rpx; }
.pl-label { font-size: 22rpx; color: #8A7A76; margin-bottom: 8rpx; }
.pl-pills { display: flex; flex-wrap: wrap; gap: 8rpx; }
.pl-pill { padding: 8rpx 18rpx; border-radius: 20rpx; font-size: 22rpx; background: #f5efeb; color: #5C4A46; }
.pl-pill.act { background: #C4817A; color: #fff; }

.sp-nearby { padding: 0 20rpx; }
.nb-section { margin-bottom: 24rpx; }
.nb-tt { font-size: 28rpx; font-weight: 600; color: #2C2422; margin-bottom: 12rpx; }
.nb-tt2 { font-size: 26rpx; color: #8A7A76; text-align: center; padding: 60rpx 0; }

.sp-bar { padding: 8rpx 20rpx 0; }
.sp-sort { display: inline-flex; white-space: nowrap; margin-bottom: 8rpx; }
.sp-sb { display: inline-flex; padding: 6rpx 20rpx; margin-right: 8rpx; border-radius: 20rpx; font-size: 22rpx; background: rgba(255,255,255,0.7); color: #8A7A76; }
.sp-sb.act { background: #C4817A; color: #fff; }
.sp-dfilter { white-space: nowrap; }
.dfp { display: inline-flex; padding: 6rpx 20rpx; margin-right: 8rpx; border-radius: 24rpx; font-size: 22rpx; background: rgba(255,255,255,0.5); color: #8A7A76; }
.dfp.act { background: rgba(91,123,90,0.15); color: #5B7B5A; font-weight: 600; }

.sp-count { padding: 8rpx 28rpx; font-size: 24rpx; color: #8A7A76; }
.hl { color: #C4817A; font-weight: 600; }

.sp-list { padding: 0 20rpx 40rpx; display: flex; flex-direction: column; gap: 16rpx; }

.sp-more { text-align: center; padding: 20rpx 0; font-size: 24rpx; color: #C4817A; }

.sp-empty { text-align: center; padding: 120rpx 0; }
.e-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.e-tt { font-size: 28rpx; color: #8A7A76; display: block; }
.e-sub { font-size: 24rpx; color: #C4817A; margin-top: 8rpx; display: block; }

.sp-history { margin: 0 24rpx; padding: 16rpx 0; }
.sp-hd { font-size: 22rpx; color: #8A7A76; margin-bottom: 10rpx; }
.sp-h-list { display: flex; flex-wrap: wrap; gap: 10rpx; }
.sp-h-item { font-size: 22rpx; color: #5C4A46; padding: 6rpx 16rpx; background: rgba(255,255,255,0.7); border-radius: 24rpx; }

.sp-suggest { margin: 0 24rpx; background: #fff; border-radius: 12rpx; box-shadow: 0 4rpx 20rpx rgba(44,36,34,0.08); position: relative; z-index: 10; }
.sg-item { padding: 20rpx 24rpx; font-size: 26rpx; color: #2C2422; border-bottom: 1rpx solid #f5efeb; }
</style>
