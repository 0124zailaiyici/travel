<template>
  <view class="sc" v-if="mode === 'hero'">
    <view class="sc-hero"></view>
    <view class="sc-card" v-for="i in lines" :key="i">
      <view class="sc-l w60"></view>
      <view class="sc-l w40"></view>
      <view class="sc-l w80"></view>
    </view>
  </view>
  <view class="sc" v-else>
    <view class="sc-pills" v-if="showPills">
      <view class="sc-pill" v-for="i in pillCount" :key="i"></view>
    </view>
    <view class="sc-card-row" v-for="row in rows" :key="row">
      <view class="sc-row-card" v-for="col in cols" :key="col">
        <view class="sc-rimg" :style="'width:'+imgSize+'rpx;height:'+imgSize+'rpx;'+(imageRight?'order:1':'')"></view>
        <view class="sc-rbd">
          <view class="sc-l" v-for="j in lineCount" :key="j" :style="'width:'+(lineWidths[j-1]||'w60')"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  mode: { type: String, default: 'card' },
  lines: { type: Number, default: 2 },
  rows: { type: Number, default: 2 },
  cols: { type: Number, default: 1 },
  imgSize: { type: Number, default: 180 },
  lineCount: { type: Number, default: 3 },
  lineWidths: { type: Array, default: () => ['w60','w90','w40'] },
  showPills: Boolean, pillCount: { type: Number, default: 5 },
  imageRight: Boolean
})
</script>

<style scoped>
.sc { padding: 0 24rpx; }
.sc-pills { display: flex; gap: 14rpx; margin-bottom: 24rpx; }
.sc-pill { width: 120rpx; height: 48rpx; border-radius: 24rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sc-card-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.sc-row-card { flex: 1; display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; }
.sc-rimg { flex-shrink: 0; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sc-rbd { flex: 1; padding: 20rpx; }
.sc-l { height: 22rpx; border-radius: 11rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; margin-bottom: 14rpx; }
.sc-hero { height: 420rpx; border-radius: 0 0 24rpx 24rpx; background: linear-gradient(90deg,#f0e8e4 25%,#e8ddd8 50%,#f0e8e4 75%); background-size: 200% 100%; animation: shim 1.5s infinite; }
.sc-card { margin-top: 20rpx; padding: 28rpx; background: rgba(255,255,255,0.88); border-radius: 20rpx; }
.w60 { width: 60%; } .w40 { width: 40%; } .w80 { width: 80%; } .w90 { width: 90%; } .w50 { width: 50%; } .w70 { width: 70%; }
@keyframes shim { 0%{background-position:200% 0}100%{background-position:-200% 0} }
</style>
