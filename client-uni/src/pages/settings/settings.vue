<template>
  <view class="st">
    <view class="st-tip">默认已填好当前可用配置。以后代理或 AI 挂了，可在这里自己改，不需要重新打包。</view>

    <view class="st-card">
      <text class="st-label">代理地址 Proxy Base</text>
      <input class="st-input" v-model="form.proxyBase" placeholder="https://xxx.workers.dev" />
      <text class="st-hint">默认 Cloudflare Worker，负责藏 Key 与地图/AI 转发</text>
    </view>

    <view class="st-card">
      <text class="st-label">AI 接口地址</text>
      <input class="st-input" v-model="form.deepseekBase" placeholder="https://sub2api.xxx" />
      <text class="st-hint">兼容 OpenAI 格式 /v1/chat/completions</text>
    </view>

    <view class="st-card">
      <text class="st-label">AI Key（可选）</text>
      <input class="st-input" v-model="form.deepseekKey" password placeholder="sk-... 填了就直连，不填走代理" />
      <text class="st-hint">有 Key 时优先直连上面的 AI 地址；为空则走代理</text>
    </view>

    <view class="st-card">
      <text class="st-label">AI 模型</text>
      <input class="st-input" v-model="form.aiModel" placeholder="grok-4.5" />
    </view>

    <view class="st-card">
      <text class="st-label">地图 Key（可选）</text>
      <input class="st-input" v-model="form.tencentMapKey" placeholder="腾讯地图 Key，可选" />
      <text class="st-hint">填入后优先直连腾讯地图；为空时走代理轮询</text>
    </view>

        <view class="st-actions">
      <button class="st-btn primary" @tap="save">保存设置</button>
      <button class="st-btn" @tap="reset">恢复默认</button>
      <button class="st-btn danger" @tap="clearAiCache">清空 AI 缓存</button>
    </view>

    <view class="st-card">
      <text class="st-label">应用版本</text>
      <text class="st-mono">版本 1.0.3 · 编译器 5.14 · 2026-07-16</text>
      <text class="st-hint">如果手机上看不到设置页，或弹 5.12/5.14 不匹配，说明装的是旧 APK，请重装本页显示的版本。</text>
    </view>

    <view class="st-card">
      <text class="st-label">当前生效</text>
      <text class="st-mono">proxy: {{ active.proxyBase || '(空)' }}</text>
      <text class="st-mono">aiBase: {{ active.deepseekBase || '(空)' }}</text>
      <text class="st-mono">model: {{ active.aiModel || '(空)' }}</text>
      <text class="st-mono">key: {{ active.deepseekKey ? '已设置' : '未设置(走代理)' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getRuntimeConfig, setRuntimeConfig, resetRuntimeConfig, getDefaults } from '../../services/config.js'
import { cacheClearNs } from '../../services/cache.js'

const form = ref({
  proxyBase: '',
  deepseekBase: '',
  deepseekKey: '',
  aiModel: '',
  tencentMapKey: '',
})
const active = ref({})

function load() {
  const cfg = getRuntimeConfig()
  form.value = {
    proxyBase: cfg.proxyBase || '',
    deepseekBase: cfg.deepseekBase || '',
    deepseekKey: cfg.deepseekKey || '',
    aiModel: cfg.aiModel || 'grok-4.5',
    tencentMapKey: cfg.tencentMapKey || '',
  }
  active.value = getRuntimeConfig()
}

function clearRuntimeCaches() {
  ;['ai', 'ai_rec', 'detail_ai', 'nearby', 'map', 'route', 'weather'].forEach(cacheClearNs)
}

function save() {
  setRuntimeConfig({
    proxyBase: form.value.proxyBase,
    deepseekBase: form.value.deepseekBase,
    deepseekKey: form.value.deepseekKey,
    aiModel: form.value.aiModel || 'grok-4.5',
    tencentMapKey: form.value.tencentMapKey,
  })
  clearRuntimeCaches()
  active.value = getRuntimeConfig()
  uni.showToast({ title: '已保存并清除旧 AI 缓存', icon: 'none' })
}

function reset() {
  const d = getDefaults()
  resetRuntimeConfig()
  clearRuntimeCaches()
  form.value = {
    proxyBase: d.proxyBase || '',
    deepseekBase: d.deepseekBase || '',
    deepseekKey: d.deepseekKey || '',
    aiModel: d.aiModel || 'grok-4.5',
    tencentMapKey: d.tencentMapKey || '',
  }
  active.value = getRuntimeConfig()
  uni.showToast({ title: '已恢复默认', icon: 'none' })
}

function clearAiCache() {
  clearRuntimeCaches()
  uni.showToast({ title: 'AI 缓存已清空', icon: 'none' })
}

onMounted(load)
</script>

<style>
.st { min-height: 100vh; background: #FDF8F4; padding: 24rpx; }
.st-tip { font-size: 24rpx; color: #8A7A76; line-height: 1.6; margin-bottom: 20rpx; }
.st-card { background: #fff; border-radius: 16rpx; padding: 22rpx; margin-bottom: 16rpx; box-shadow: 0 4rpx 16rpx rgba(44,36,34,0.04); }
.st-label { display: block; font-size: 26rpx; color: #2C2422; font-weight: 600; margin-bottom: 12rpx; }
.st-input { background: #F7F1EC; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 26rpx; color: #2C2422; }
.st-hint { display: block; margin-top: 10rpx; font-size: 22rpx; color: #A0908C; line-height: 1.4; }
.st-actions { display: flex; flex-direction: column; gap: 12rpx; margin: 12rpx 0 20rpx; }
.st-btn { background: #F0E7E1; color: #5C4A46; border-radius: 40rpx; font-size: 28rpx; }
.st-btn.primary { background: #C4817A; color: #fff; }
.st-btn.danger { background: #F6E4E1; color: #C45C52; }
.st-mono { display: block; font-size: 22rpx; color: #6B5B57; margin-top: 8rpx; word-break: break-all; }
</style>
