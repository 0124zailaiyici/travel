<template>
  <view class="dp">
    <scroll-view scroll-y class="dp-scroll">
      <view class="shim" v-if="!detail.name">
        <view class="shim-hero"></view>
        <view class="shim-card"><view class="s-l w60"></view><view class="s-l w40"></view><view class="s-l w80"></view></view>
        <view class="shim-card"><view class="s-l w50"></view><view class="s-l w90"></view><view class="s-l w90"></view></view>
      </view>

      <!-- === SHARE BANNER === -->
      <view class="share-banner" @tap="showShareSheet = true">
        <text class="sb-icon">💌</text>
        <text class="sb-tt">分享「花信」给朋友</text>
        <text class="sb-arrow">›</text>
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

        <view class="desc-box">{{ detail.description }}</view>

        <view class="tag-row"><text class="t-tag" v-for="t in (detail.tags || [])" :key="t">{{ t }}</text></view>

        <!-- === ITINERARY === -->
        <view class="sec" v-if="detail.itinerary && detail.itinerary.length">
          <view class="sec-hd" @tap="toggleAllDays">
            <text class="sec-tt">📋 行程安排</text>
            <text class="sec-toggle">{{ allDaysExpanded ? '收起全部' : '展开全部' }}</text>
          </view>
          <view class="timeline">
            <view class="day" v-for="(day, i) in detail.itinerary" :key="i">
              <view class="day-dot"></view>
              <view class="day-hd" @tap="toggleDay(i)">
                <view><text class="day-label">Day {{ i + 1 }}</text><text class="day-tt">{{ day.title }}</text></view>
                <text class="day-arrow">{{ expandedDays[i] ? '▾' : '▸' }}</text>
              </view>
              <view class="day-body" v-if="expandedDays[i]">
                <view class="ts" v-if="day.morning"><text class="tl ba">🌅 上午</text><text class="tx">{{ day.morning }}</text></view>
                <view class="ts" v-if="day.afternoon"><text class="tl bp">🌤 下午</text><text class="tx">{{ day.afternoon }}</text></view>
                <view class="ts" v-if="day.evening"><text class="tl be">🌙 晚上</text><text class="tx">{{ day.evening }}</text></view>
                <view class="meals" v-if="mealsList(day.meals).length">
                  <text class="ml-i" v-for="(m, mi) in mealsList(day.meals)" :key="mi">{{ m }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- === BUDGET === -->
        <view class="sec" v-if="budgetEntries.length">
          <view class="sec-hd">
            <text class="sec-tt">💰 预算明细</text>
          </view>
          <view class="bg-summary" v-if="budgetTotal">
            <text class="bg-total">¥{{ budgetTotal }} <text class="bg-note">/人</text></text>
          </view>
          <view class="bg-list">
            <view class="bg-row" v-for="e in budgetEntries" :key="e.key">
              <view class="bg-bar-track">
                <view class="bg-bar" :style="{ width: budgetBarWidth(e.total) + '%', background: e.barColor }"></view>
              </view>
              <view class="bg-body">
                <view class="bg-top">
                  <text class="bg-icon">{{ e.icon }}</text>
                  <text class="bg-label">{{ e.label }}</text>
                  <text class="bg-amount">¥{{ e.total }}</text>
                </view>
                <view class="bg-detail" v-if="e.items.length">
                  <text class="bg-item" v-for="(item, ii) in e.items" :key="ii">· {{ item.name }} ¥{{ item.cost }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- === TRANSPORT === -->
        <view class="sec" v-if="detail.route || detail.transportDetail || detail.transport_guide">
          <view class="sec-hd"><text class="sec-tt">🚗 交通方案</text></view>

          <!-- Real-time route from user location -->
          <view class="tp-route" v-if="detail.route">
            <view class="tp-origin">📍 从你的位置出发</view>
            <view class="tp-cards">
              <view class="tp-card" v-if="detail.route.driving">
                <view class="tp-icon drv">🚗</view>
                <view class="tp-body">
                  <text class="tp-type">驾车</text>
                  <text class="tp-meta">{{ detail.route.driving.distance }}km · 约{{ detail.route.driving.duration }}分钟<text v-if="detail.route.driving.tolls"> · 路费¥{{ detail.route.driving.tolls }}</text></text>
                </view>
              </view>
              <view class="tp-card" v-if="detail.route.transit">
                <view class="tp-icon bus">🚇</view>
                <view class="tp-body">
                  <text class="tp-type">公交/高铁</text>
                  <text class="tp-meta">约{{ detail.route.transit.duration }}分钟 · 费用¥{{ detail.route.transit.cost }} <text v-if="detail.route.transit.summary">· {{ detail.route.transit.summary }}</text></text>
                </view>
              </view>
            </view>
          </view>

          <!-- Static transport guide -->
          <view class="tp-guide" v-if="detail.transportDetail">
            <view class="tp-guide-item" v-if="detail.transportDetail.to_destination">
              <text class="tp-gl">🚄 怎么去</text>
              <text class="tp-gt">{{ detail.transportDetail.to_destination }}</text>
            </view>
            <view class="tp-guide-item" v-if="detail.transportDetail.around">
              <text class="tp-gl">🚌 当地交通</text>
              <text class="tp-gt">{{ detail.transportDetail.around }}</text>
            </view>
            <view class="tp-guide-item" v-if="detail.transportDetail.parking">
              <text class="tp-gl">🅿️ 自驾停车</text>
              <text class="tp-gt">{{ detail.transportDetail.parking }}</text>
            </view>
          </view>
          <view class="tb-note" v-else-if="!detail.route">暂无详细交通指南</view>
        </view>

        <!-- === TIPS === -->
        <view class="sec" v-if="detail.tips && detail.tips.length">
          <view class="sec-hd"><text class="sec-tt">⚠️ 避坑指南</text></view>
          <view class="tip-list">
            <view class="tip" v-for="(tip, i) in detail.tips" :key="i">
              <text class="tip-n">{{ i + 1 }}</text>
              <text class="tip-t">{{ tip }}</text>
            </view>
          </view>
        </view>

        <!-- === COMMENTS === -->
        <view class="sec" v-if="comments.length || !loadingComments">
          <view class="sec-hd"><text class="sec-tt">💬 评价 ({{ comments.length }})</text></view>
          <view class="cmt-list">
            <view class="cmt-empty" v-if="!comments.length && !loadingComments">暂无评价，来当第一个分享的人吧</view>
            <view class="cmt-item" v-for="c in comments" :key="c.id">
              <view class="cmt-av" :style="'background:' + c.avatar_color"><text>{{ c.nickname[0] }}</text></view>
              <view class="cmt-bd">
                <view class="cmt-hd">
                  <text class="cmt-n">{{ c.nickname }}</text>
                  <text class="cmt-s" v-if="c.rating">{{ '⭐'.repeat(c.rating) }}</text>
                  <text class="cmt-t">{{ timeAgo(c.created_at) }}</text>
                </view>
                <text class="cmt-tx">{{ c.content }}</text>
              </view>
            </view>
          </view>
          <view class="cmt-input-sec">
            <text class="cmt-il">发表评价</text>
            <view class="cmt-stars">
              <text v-for="i in 5" :key="i" :class="{ act: i <= cmtRating }" @tap="cmtRating = i">★</text>
              <text class="cmt-sl" v-if="cmtRating">{{ ['','很差','较差','一般','不错','很好'][cmtRating] }}</text>
            </view>
            <view class="cmt-row">
              <input class="cmt-inp" v-model="cmtText" placeholder="分享你的旅行体验…" />
              <button class="cmt-bt" @tap="submitComment" :disabled="!cmtText.trim()">发布</button>
            </view>
          </view>
        </view>

        <view class="ab">
          <button class="nav-bt" @tap="navigate">📍 导航去</button>
        </view>
      </template>
    </scroll-view>

    <!-- share sheet -->
    <view class="ss-overlay" v-if="showShareSheet" @tap="showShareSheet = false"></view>
    <view class="ss-sheet" v-if="showShareSheet">
      <view class="ss-hd">
        <text class="ss-tt">💌 分享「花信」</text>
        <text class="ss-close" @tap="showShareSheet = false">✕</text>
      </view>
      <view class="ss-preview" :style="{ background: shareBg }">
        <text class="ss-emoji">{{ detail.themeIcon || '🌸' }}</text>
        <text class="ss-dest">{{ detail.name }}</text>
        <view class="ss-msg">
          <text class="ss-qt">"</text>
          <input class="ss-inp" v-model="shareMsg" placeholder="写一句推荐语…" />
        </view>
        <view class="ss-badges">
          <text class="ss-badge" style="background:rgba(196,129,122,0.12);color:#C4817A;">⭐ {{ detail.rating }}</text>
          <text class="ss-badge" style="background:rgba(91,123,90,0.1);color:#5B7B5A;">📅 {{ detail.best_season || '全年' }}</text>
          <text class="ss-badge" style="background:rgba(44,36,34,0.06);color:#8A7A76;">{{ detail.duration }}日</text>
        </view>
        <text class="ss-credit">—— 来自「花期」的推荐 ——</text>
      </view>
      <canvas type="2d" id="shareCanvas" style="width:600px;height:780px;position:fixed;left:-9999px;top:-9999px;"></canvas>
      <view class="ss-actions">
        <button class="ss-btn ss-save" @tap="genShareImage('save')">💾 保存到相册</button>
        <button class="ss-btn ss-wx" @tap="genShareImage('share')">💬 发送给朋友</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { api } from '../../api/index.js'
import { getLocation } from '../../api/location.js'
import { getUserId } from '../../api/user.js'

const detail = ref({}); const isFav = ref(false); const imgErr = ref(false)
const expandedDays = ref([])
const allDaysExpanded = computed(() => expandedDays.value.every(v => v))

// share
const showShareSheet = ref(false)
const shareMsg = ref('')
const shareBg = ref('#FAF0EA')
const shareBgs = ['#FAF0EA','#EEF5EE','#F5F0EA','#F0EAEE','#F5F5F0']
function pickShareBg() { shareBg.value = shareBgs[parseInt(detail.value.id?.replace('d','')||'0') % shareBgs.length] }
watch(showShareSheet, (v) => { if (v && detail.value.id) pickShareBg() })

// comments
const comments = ref([])
const loadingComments = ref(false)
const cmtText = ref('')
const cmtRating = ref(5)

function timeAgo(t) {
  if (!t) return ''
  const d = new Date(t + (t.includes('Z') ? '' : 'Z'))
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return '刚刚'
  if (s < 3600) return Math.floor(s / 60) + '分钟前'
  if (s < 86400) return Math.floor(s / 3600) + '小时前'
  if (s < 2592000) return Math.floor(s / 86400) + '天前'
  return d.toLocaleDateString('zh-CN')
}

async function loadComments() {
  if (!detail.value.id) return
  loadingComments.value = true
  try { comments.value = await api.getComments(detail.value.id) }
  catch(e) { console.error(e) }
  finally { loadingComments.value = false }
}

async function submitComment() {
  const txt = cmtText.value.trim()
  if (!txt) return
  try {
    await api.postComment({
      destination_id: detail.value.id,
      openid: getUserId(),
      nickname: '用户_' + getUserId().slice(-4),
      rating: cmtRating.value,
      content: txt
    })
    cmtText.value = ''
    cmtRating.value = 5
    uni.showToast({ title: '评价成功', icon: 'none' })
    loadComments()
  } catch(e) {
    uni.showToast({ title: '发布失败', icon: 'none' })
  }
}

const nickColors = ['#C4817A','#5B7B5A','#E8C4A0','#8BA88A','#9A5E58','#E8B4AE','#5B7B8A','#C4917A']

function toggleDay(i) { expandedDays.value[i] = !expandedDays.value[i] }
function toggleAllDays() {
  const target = !allDaysExpanded.value
  expandedDays.value = expandedDays.value.map(() => target)
}
const bg = ref('linear-gradient(135deg,#E8B4AE,#C4817A,#9A5E58)')
const bgs = ['linear-gradient(135deg,#E8B4AE,#C4817A,#9A5E58)','linear-gradient(135deg,#8BA88A,#5B7B5A,#3D5A3C)','linear-gradient(135deg,#E8C4A0,#C4817A,#9A5E58)','linear-gradient(135deg,#C4817A,#5B7B5A,#3D5A3C)','linear-gradient(135deg,#F0D5C0,#E8B4AE,#C4817A)']
const labels = { transport:'往返交通', accommodation:'住宿', food:'餐饮', tickets:'门票', other:'其他' }
const icons = { transport:'🚗', accommodation:'🏨', food:'🍜', tickets:'🎫', other:'📦' }
const barColors = { transport:'linear-gradient(90deg,#5B7B5A,#8BA88A)', accommodation:'linear-gradient(90deg,#9A5E58,#C4817A)', food:'linear-gradient(90deg,#C4917A,#E8B4AE)', tickets:'linear-gradient(90deg,#5B7B8A,#8BA8BA)', other:'linear-gradient(90deg,#9A9A9A,#C0C0C0)' }

const budgetEntries = computed(() => {
  const b = detail.value.budget
  if (!b) return []
  return Object.entries(b).filter(([k]) => k !== '_detail' && k !== '_transport').map(([k, v]) => {
    const total = typeof v === 'object' ? v.total || 0 : Number(v) || 0
    const items = typeof v === 'object' ? v.items || [] : []
    return { key: k, label: labels[k] || k, icon: icons[k] || '📌', total, items, barColor: barColors[k] || 'linear-gradient(90deg,#E8B4AE,#C4817A)' }
  })
})

const budgetTotal = computed(() => {
  const b = detail.value.budget
  if (!b) return 0
  const entries = budgetEntries.value
  return entries.reduce((s, e) => s + e.total, 0)
})

const maxBudget = computed(() => {
  const entries = budgetEntries.value
  if (!entries.length) return 0
  return Math.max(...entries.map(e => e.total), 1)
})

function budgetBarWidth(val) {
  if (!maxBudget.value) return 0
  return Math.max((val / maxBudget.value) * 100, 4)
}

async function toggleFav() {
  const id = detail.value.id
  try {
    const res = await api.syncToggleFav(getUserId(), id)
    isFav.value = !res.removed
    uni.showToast({ title: res.removed ? '已取消' : '已收藏', icon: 'none' })
  } catch(e) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onLoad(async (o) => {
  if (!o.id) return
  try {
    const loc = await getLocation(); const data = await api.getDetail(o.id, loc)
    detail.value = data
    const favs = await api.syncGetFavs(getUserId())
    isFav.value = favs.some(d => d.id === data.id)
    expandedDays.value = data.itinerary?.map(() => true) || []
    bg.value = bgs[parseInt(o.id.replace('d','')) % bgs.length]
    loadComments()
  } catch(e) { console.error(e); uni.showToast({ title:'加载失败', icon:'none' }) }
})
onShareAppMessage(() => ({
  title: detail.value.name + ' - 花期',
  path: '/pages/detail/detail?id=' + detail.value.id,
  imageUrl: detail.value.image_url
}))
function mealsList(m) {
  if (!m) return []
  let arr = m
  if (typeof m === 'string') {
    try { arr = JSON.parse(m) } catch(e) { arr = m.split(/[；;]/).map(s => s.trim()).filter(Boolean) }
  }
  if (!Array.isArray(arr)) return []
  return arr.map(item => {
    if (typeof item === 'object' && item !== null) {
      const name = item.name || ''
      const tries = item.must_try ? item.must_try.join('、') : ''
      return name + (tries ? '：' + tries : '')
    }
    return item
  }).filter(Boolean)
}
function navigate() {
  if (detail.value.lat && detail.value.lng) uni.openLocation({ latitude:detail.value.lat, longitude:detail.value.lng, name:detail.value.name })
}

async function genShareImage(mode) {
  const d = detail.value
  const msg = shareMsg.value.trim() || '推荐这个好地方！'
  const uid = getUserId()

  try {
    const query = uni.createSelectorQuery()
    const canvasNode = await new Promise((res, rej) => {
      query.select('#shareCanvas').node((n) => {
        if (n.node) res(n.node)
        else rej('no node')
      }).exec()
      setTimeout(() => rej('timeout'), 3000)
    })

    if (canvasNode && canvasNode.getContext) {
      const dpr = uni.getSystemInfoSync().pixelRatio || 2
      const W = 600, H = 780
      canvasNode.width = W * dpr; canvasNode.height = H * dpr
      const ctx = canvasNode.getContext('2d')
      ctx.scale(dpr, dpr)

      ctx.fillStyle = shareBg.value
      ctx.fillRect(0, 0, W, H)

      ctx.fillStyle = '#C4817A'
      ctx.globalAlpha = 0.08
      ctx.beginPath()
      ctx.moveTo(0, 0)
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, Math.sin(x * 0.008) * 120 + 60)
      ctx.lineTo(W, 0)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.textAlign = 'center'
      ctx.font = 'bold 56px sans-serif'
      ctx.fillStyle = '#2C2422'
      ctx.fillText(d.themeIcon || '🌸', W / 2, 120)

      ctx.font = 'bold 36px sans-serif'
      ctx.fillStyle = '#2C2422'
      ctx.fillText(d.name, W / 2, 190)

      ctx.font = '22px sans-serif'
      ctx.fillStyle = '#8A7A76'
      ctx.fillText('⭐ ' + d.rating + ' · ' + (d.best_season || '全年') + ' · ' + d.duration + '日', W / 2, 235)

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      roundRect(ctx, 50, 270, 500, 150, 16)
      ctx.fill()

      ctx.textAlign = 'left'
      ctx.font = '18px sans-serif'
      ctx.fillStyle = '#8A7A76'
      ctx.fillText('💌 ' + uid.slice(-4) + ' 的推荐', 80, 312)

      ctx.font = '24px sans-serif'
      ctx.fillStyle = '#2C2422'

      const lines = wrapText(ctx, msg, 460, 24)
      lines.forEach((l, i) => {
        if (i < 4) ctx.fillText(l, 80, 354 + i * 36)
      })

      ctx.textAlign = 'center'
      const pills = ['⭐ ' + d.rating, '📅 ' + (d.best_season || '全年'), '⏱ ' + d.duration + '日']
      const pw = 150, ph = 44, gap = 20
      const startX = (W - (pills.length * pw + (pills.length - 1) * gap)) / 2
      pills.forEach((p, i) => {
        const x = startX + i * (pw + gap)
        ctx.fillStyle = 'rgba(196,129,122,0.08)'
        roundRect(ctx, x, 480, pw, ph, 22)
        ctx.fill()
        ctx.font = '19px sans-serif'
        ctx.fillStyle = '#C4817A'
        ctx.fillText(p, x + pw / 2, 508)
      })

      ctx.font = '16px sans-serif'
      ctx.fillStyle = 'rgba(138,122,118,0.5)'
      ctx.fillText('—— 来自「花期」的推荐 打开小程序查看完整攻略 ——', W / 2, 600)

      saveImage(canvasNode, mode)
    } else {
      saveFallback(mode)
    }
  } catch(e) {
    console.error(e)
    saveFallback(mode)
  }
}

function saveFallback() {
  uni.showToast({ title: '长按卡片截图后分享给朋友', icon: 'none', duration: 3000 })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx, text, maxWidth, fontSize) {
  const lines = []
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth) { lines.push(line); line = ch }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

async function saveImage(canvasNode, mode) {
  try {
    const tempPath = await new Promise((res, rej) => {
      wx.canvasToTempFilePath({ canvas: canvasNode, success: (r) => res(r.tempFilePath), fail: rej })
    })
    if (mode === 'share') {
      wx.previewImage({ urls: [tempPath], current: tempPath })
      showShareSheet.value = false
      uni.showToast({ title: '长按图片发送给朋友', icon: 'none', duration: 2000 })
    } else {
      await wx.saveImageToPhotosAlbum({ filePath: tempPath })
      uni.showToast({ title: '已保存到相册', icon: 'none' })
      showShareSheet.value = false
    }
  } catch(e) {
    uni.showToast({ title: '操作失败，试试截图分享', icon: 'none' })
  }
}
</script>

<style>
.dp { height: 100vh; background: #FDF8F4; }
.dp-scroll { height: 100%; padding-bottom: 100rpx; }

/* shimmer */
.shim { padding: 0 24rpx; }
.shim-hero { height: 420rpx; border-radius: 0 0 24rpx 24rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: sh 1.5s infinite; }
.shim-card { margin-top: 20rpx; padding: 28rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; }
.s-l { height: 24rpx; border-radius: 12rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size:200% 100%; animation: sh 1.5s infinite; margin-bottom:14rpx; }
.w60{width:60%}.w40{width:40%}.w80{width:80%}.w50{width:50%}.w90{width:90%}
@keyframes sh { 0%{background-position:200% 0}100%{background-position:-200% 0} }

/* hero */
.hero-w { position: relative; height: 420rpx; overflow: hidden; background: #f0e8e4; }
.hero-i { width: 100%; height: 100%; }
.hero-fb { position: absolute; top:0;left:0;right:0;bottom:0; display: flex; align-items: flex-end; justify-content: center; }
.hero-e { font-size: 80rpx; margin-bottom: 80rpx; }
.hero-mask { position: absolute; bottom:0;left:0;right:0; height: 180rpx; background: linear-gradient(transparent,#FDF8F4); }
.hero-info { position: absolute; bottom: 24rpx; left: 24rpx; right: 24rpx; z-index: 2; }
.hero-name { font-size: 36rpx; font-weight: 700; color: #fff; text-shadow: 0 2rpx 12rpx rgba(0,0,0,0.3); display: block; margin-bottom: 6rpx; }
.hero-stats { display: flex; flex-wrap: wrap; gap: 8rpx 12rpx; font-size: 22rpx; color: rgba(255,255,255,0.9); text-shadow: 0 1rpx 6rpx rgba(0,0,0,0.2); }
.hero-stats text { white-space: nowrap; flex-shrink: 0; }
.fav-bt { position: absolute; top: 60rpx; right: 24rpx; font-size: 44rpx; z-index: 3; }

.weather { margin: -20rpx 24rpx 0; position: relative; z-index: 2; padding: 10rpx 20rpx; background: rgba(91,123,90,0.1); border-radius: 16rpx; display: inline-flex; font-size: 22rpx; color: #5B7B5A; }
.desc-box { margin: 16rpx 24rpx 0; font-size: 24rpx; color: #8A7A76; line-height: 1.7; }
.tag-row { display: flex; flex-wrap: wrap; gap: 8rpx; margin: 12rpx 24rpx; }
.t-tag { padding: 4rpx 18rpx; border-radius: 20rpx; font-size: 20rpx; background: rgba(196,129,122,0.08); color: #C4817A; }

/* section container */
.sec { margin: 20rpx 24rpx; padding: 20rpx 20rpx 24rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.04); }
.sec-tt { font-size: 28rpx; font-weight: 600; color: #2C2422; display: block; }
.sec-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.sec-toggle { font-size: 22rpx; color: #C4817A; }

/* ===== ITINERARY — TIMELINE ===== */
.timeline { position: relative; padding-left: 28rpx; }
.timeline::before { content: ''; position: absolute; left: 8rpx; top: 10rpx; bottom: 10rpx; width: 3rpx; background: linear-gradient(to bottom, rgba(196,129,122,0.35), rgba(139,168,138,0.35), rgba(200,200,200,0.15)); border-radius: 2rpx; }
.day { position: relative; margin-bottom: 16rpx; padding: 16rpx; background: rgba(196,129,122,0.04); border-radius: 14rpx; }
.day-dot { position: absolute; left: -25rpx; top: 22rpx; width: 14rpx; height: 14rpx; border-radius: 50%; border: 2rpx solid #FDF8F4; background: #C4817A; box-shadow: 0 0 8rpx rgba(196,129,122,0.35); }
.day-hd { display: flex; justify-content: space-between; align-items: flex-start; cursor: pointer; }
.day-label { font-size: 20rpx; font-weight: 700; color: #C4817A; letter-spacing: 1px; display: block; margin-bottom: 2rpx; }
.day-tt { font-size: 26rpx; font-weight: 600; color: #2C2422; display: block; }
.day-arrow { font-size: 18rpx; color: #C4817A; margin-top: 4rpx; flex-shrink: 0; }
.day-body { margin-top: 12rpx; }
.ts { display: flex; gap: 10rpx; margin: 8rpx 0; }
.tl { flex-shrink: 0; font-size: 18rpx; font-weight: 600; padding: 2rpx 8rpx; border-radius: 8rpx; height: fit-content; line-height: 1.6; }
.ba { background: rgba(232,180,174,0.2); color: #C4817A; }
.bp { background: rgba(91,123,90,0.15); color: #5B7B5A; }
.be { background: rgba(44,36,34,0.08); color: #5C4A46; }
.tx { font-size: 22rpx; color: #2C2422; line-height: 1.7; flex: 1; }

/* meal pills */
.meals { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 10rpx; padding-top: 10rpx; border-top: 1rpx solid rgba(196,129,122,0.08); }
.ml-i { display: inline-flex; padding: 4rpx 12rpx; background: rgba(232,180,160,0.08); border: 1rpx solid rgba(232,180,160,0.12); border-radius: 10rpx; font-size: 20rpx; color: #8A6A5A; }

/* ===== BUDGET — BARS ===== */
.bg-summary { padding: 16rpx 18rpx; background: rgba(196,129,122,0.06); border: 1rpx solid rgba(196,129,122,0.1); border-radius: 14rpx; margin-bottom: 16rpx; }
.bg-total { font-size: 36rpx; font-weight: 700; color: #C4817A; }
.bg-note { font-size: 22rpx; font-weight: 400; color: #8A7A76; }
.bg-list { display: flex; flex-direction: column; gap: 12rpx; }
.bg-row { position: relative; padding: 12rpx 14rpx; background: rgba(196,129,122,0.02); border-radius: 12rpx; overflow: hidden; }
.bg-bar-track { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: rgba(196,129,122,0.04); border-radius: 12rpx; }
.bg-bar { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 12rpx 4rpx 4rpx 12rpx; opacity: 0.12; transition: width 0.6s ease; }
.bg-body { position: relative; z-index: 1; }
.bg-top { display: flex; align-items: center; gap: 8rpx; margin-bottom: 4rpx; }
.bg-icon { font-size: 24rpx; }
.bg-label { font-size: 24rpx; color: #8A7A76; flex: 1; }
.bg-amount { font-size: 26rpx; font-weight: 700; color: #2C2422; }
.bg-detail { padding: 4rpx 0 0 32rpx; }
.bg-item { font-size: 20rpx; color: #8A7A76; display: block; margin: 3rpx 0; line-height: 1.5; }

/* ===== TRANSPORT ===== */
.tp-route { margin-bottom: 14rpx; }
.tp-origin { font-size: 22rpx; font-weight: 600; color: #5B7B5A; margin-bottom: 10rpx; }
.tp-cards { display: flex; flex-direction: column; gap: 10rpx; }
.tp-card { display: flex; gap: 12rpx; align-items: flex-start; padding: 14rpx; background: rgba(91,123,90,0.04); border: 1rpx solid rgba(91,123,90,0.08); border-radius: 14rpx; }
.tp-icon { width: 44rpx; height: 44rpx; border-radius: 12rpx; display: flex; align-items: center; justify-content: center; font-size: 22rpx; flex-shrink: 0; }
.tp-icon.drv { background: rgba(91,123,90,0.15); }
.tp-icon.bus { background: rgba(122,122,154,0.12); }
.tp-body { flex: 1; min-width: 0; }
.tp-type { font-size: 24rpx; font-weight: 600; color: #2C2422; display: block; margin-bottom: 3rpx; }
.tp-meta { font-size: 20rpx; color: #8A7A76; line-height: 1.5; }

.tp-guide { }
.tp-guide-item { padding: 14rpx; background: rgba(255,255,255,0.5); border-radius: 12rpx; margin-bottom: 8rpx; }
.tp-gl { font-size: 22rpx; font-weight: 600; color: #5B7B5A; display: block; margin-bottom: 4rpx; }
.tp-gt { font-size: 22rpx; color: #8A7A76; line-height: 1.7; display: block; }
.tb-note { text-align: center; padding: 20rpx; background: rgba(196,129,122,0.04); border-radius: 12rpx; font-size: 22rpx; color: #C4817A; }

/* ===== TIPS ===== */
.tip-list { display: flex; flex-direction: column; gap: 8rpx; }
.tip { display: flex; gap: 12rpx; padding: 14rpx; background: rgba(196,129,122,0.02); border-radius: 12rpx; border-left: 4rpx solid rgba(232,180,160,0.3); }
.tip-n { width: 28rpx; height: 28rpx; border-radius: 50%; flex-shrink: 0; background: rgba(232,196,160,0.2); color: #C4817A; display: flex; align-items: center; justify-content: center; font-size: 18rpx; font-weight: 600; margin-top: 2rpx; }
.tip-t { font-size: 22rpx; color: #8A7A76; line-height: 1.6; flex: 1; }

/* nav button */
.ab { padding: 12rpx 24rpx 40rpx; }
.nav-bt { width: 100%; padding: 26rpx; background: linear-gradient(135deg,#C4817A,#9A5E58); color: #fff; border: none; border-radius: 50rpx; font-size: 28rpx; font-weight: 600; box-shadow: 0 6rpx 24rpx rgba(196,129,122,0.3); }

/* share banner */
.share-banner { margin: 20rpx 24rpx 0; padding: 20rpx; background: linear-gradient(135deg,#FAF0EA,#F5E4DC); border-radius: 16rpx; display: flex; align-items: center; gap: 12rpx; }
.sb-icon { font-size: 32rpx; }
.sb-tt { flex: 1; font-size: 26rpx; font-weight: 600; color: #2C2422; }
.sb-arrow { font-size: 32rpx; color: #C4817A; }

/* share sheet */
.ss-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50; }
.ss-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: #FDF8F4; border-radius: 24rpx 24rpx 0 0; z-index: 51; padding: 24rpx 24rpx 40rpx; max-height: 80vh; overflow-y: auto; }
.ss-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.ss-tt { font-size: 28rpx; font-weight: 700; color: #2C2422; }
.ss-close { font-size: 32rpx; color: #8A7A76; padding: 8rpx; }
.ss-preview { border-radius: 20rpx; padding: 32rpx 24rpx; text-align: center; position: relative; overflow: hidden; min-height: 360rpx; }
.ss-emoji { font-size: 56rpx; display: block; margin-bottom: 6rpx; }
.ss-dest { font-size: 34rpx; font-weight: 700; color: #2C2422; display: block; }
.ss-msg { margin: 16rpx 0 12rpx; padding: 14rpx 18rpx; background: rgba(255,255,255,0.6); border-radius: 14rpx; position: relative; }
.ss-qt { position: absolute; top: 6rpx; left: 12rpx; font-size: 36rpx; color: #C4817A; opacity: 0.3; line-height: 1; }
.ss-inp { font-size: 26rpx; color: #2C2422; text-align: center; width: 100%; background: transparent; border: none; min-height: 60rpx; }
.ss-badges { display: flex; gap: 10rpx; justify-content: center; flex-wrap: wrap; }
.ss-badge { padding: 4rpx 20rpx; border-radius: 20rpx; font-size: 22rpx; font-weight: 500; }
.ss-credit { display: block; margin-top: 16rpx; font-size: 20rpx; color: #8A7A76; opacity: 0.5; letter-spacing: 2rpx; }
.ss-actions { display: flex; gap: 14rpx; margin-top: 20rpx; }
.ss-btn { flex: 1; padding: 22rpx; border: none; border-radius: 40rpx; font-size: 26rpx; font-weight: 600; text-align: center; }
.ss-save { background: linear-gradient(135deg,#C4817A,#9A5E58); color: #fff; }
.ss-wx { background: #07C160; color: #fff; }

/* comments */
.cmt-list { margin-bottom: 16rpx; }
.cmt-empty { text-align: center; padding: 40rpx 0; font-size: 24rpx; color: #8A7A76; }
.cmt-item { display: flex; gap: 14rpx; padding: 16rpx 0; border-bottom: 1rpx solid rgba(196,129,122,0.06); }
.cmt-item:last-child { border: none; }
.cmt-av { width: 48rpx; height: 48rpx; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22rpx; font-weight: 700; }
.cmt-bd { flex: 1; min-width: 0; }
.cmt-hd { display: flex; align-items: center; gap: 8rpx; flex-wrap: wrap; margin-bottom: 4rpx; }
.cmt-n { font-size: 24rpx; font-weight: 600; color: #2C2422; }
.cmt-s { font-size: 18rpx; color: #F5A623; }
.cmt-t { font-size: 20rpx; color: #8A7A76; margin-left: auto; }
.cmt-tx { font-size: 24rpx; color: #5C4A46; line-height: 1.6; }

.cmt-input-sec { padding: 20rpx; background: rgba(255,255,255,0.5); border-radius: 16rpx; }
.cmt-il { font-size: 24rpx; font-weight: 600; color: #2C2422; display: block; margin-bottom: 6rpx; }
.cmt-stars { display: flex; align-items: center; gap: 4rpx; margin-bottom: 10rpx; }
.cmt-stars text { font-size: 36rpx; color: #ddd; }
.cmt-stars .act { color: #F5A623; }
.cmt-sl { font-size: 22rpx; color: #8A7A76; margin-left: 8rpx; }
.cmt-row { display: flex; gap: 10rpx; }
.cmt-inp { flex: 1; padding: 16rpx 20rpx; background: rgba(255,255,255,0.8); border: 1rpx solid rgba(196,129,122,0.1); border-radius: 24rpx; font-size: 24rpx; }
.cmt-bt { padding: 16rpx 32rpx; background: linear-gradient(135deg,#C4817A,#9A5E58); color: #fff; border: none; border-radius: 30rpx; font-size: 24rpx; font-weight: 600; flex-shrink: 0; }
.cmt-bt[disabled] { opacity: 0.4; }
</style>
