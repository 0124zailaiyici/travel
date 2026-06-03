<template>
  <view class="dc" @tap="$emit('tap')">
    <view class="dc-img" :style="'width:'+imgSize+'rpx;height:'+imgSize+'rpx;'+(imgRight?'order:1':'')">
      <image class="dc-i" :src="imageUrl" mode="aspectFill" v-if="imageUrl" />
      <text class="dc-fb" v-else>{{ fallbackIcon }}</text>
    </view>
    <view class="dc-bd">
      <view class="dc-top" v-if="showDistance && distance != null">
        <text class="dc-n">{{ name }}</text>
        <text class="dc-dist">{{ distance }}km</text>
      </view>
      <text class="dc-n" v-else>{{ name }}</text>
      <view class="dc-desc" v-if="description">{{ description }}</view>
      <view class="dc-meta">
        <text class="dc-star">⭐ {{ rating }}</text>
        <text v-if="showDuration && duration">{{ duration }}天</text>
        <text v-if="showBestSeason && bestSeason">{{ bestSeason }}</text>
      </view>
      <view class="dc-tags" v-if="showTags && tags?.length">
        <text class="dc-tag" v-for="t in tags" :key="t">{{ t }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  imageUrl: String, imageRight: Boolean, imgSize: { type: Number, default: 180 },
  name: String, description: String, rating: [Number, String],
  distance: [Number, String], duration: [Number, String],
  tags: Array, bestSeason: String, fallbackIcon: { type: String, default: '🌸' },
  showDistance: Boolean, showDuration: Boolean, showTags: Boolean, showBestSeason: Boolean
})
defineEmits(['tap'])
</script>

<style scoped>
.dc { display: flex; background: rgba(255,255,255,0.88); border-radius: 20rpx; overflow: hidden; box-shadow: 0 2rpx 14rpx rgba(196,129,122,0.06); }
.dc-img { flex-shrink: 0; position: relative; overflow: hidden; background: linear-gradient(135deg,#E8B4AE,#C4817A); display: flex; align-items: center; justify-content: center; }
.dc-i { width: 100%; height: 100%; }
.dc-fb { font-size: 44rpx; }
.dc-bd { flex: 1; padding: 16rpx 18rpx; display: flex; flex-direction: column; min-width: 0; }
.dc-top { display: flex; min-width: 0; }
.dc-n { font-size: 28rpx; font-weight: 600; color: #2C2422; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.dc-dist { font-size: 22rpx; color: #C4817A; font-weight: 600; flex-shrink: 0; margin-left: auto; padding-left: 8rpx; }
.dc-desc { font-size: 22rpx; color: #8A7A76; line-height: 1.5; margin: 6rpx 0 4rpx; max-height: 99rpx; overflow: hidden; }
.dc-meta { display: flex; gap: 14rpx; font-size: 22rpx; margin: 4rpx 0; color: #8A7A76; }
.dc-star { color: #E8A838; }
.dc-tags { display: flex; flex-wrap: wrap; gap: 6rpx; margin-top: 6rpx; }
.dc-tag { padding: 4rpx 14rpx; border-radius: 14rpx; font-size: 20rpx; background: rgba(196,129,122,0.08); color: #C4817A; }
</style>
