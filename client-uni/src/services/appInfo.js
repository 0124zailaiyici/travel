import { ref } from 'vue'

/**
 * App 版本号的唯一来源。
 *
 * 之前首页 footer 和设置页各自硬编码「版本 1.0.3 · 编译器 5.14」，
 * 升版本时漏改一处就会出现两个自相矛盾的版本号 —— 而这两处的提示语
 * 恰恰是让人拿它核对「装的 APK 对不对」，写错比不写更糟。
 *
 * 优先读运行时真实版本（打包时由 manifest.json 注入），读不到才用兜底值。
 * 升版本时只需改 manifest.json 的 versionName/versionCode 和这里的兜底值。
 */
export const appVersion = ref('1.0.5')

export function readAppVersion() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus && plus.runtime && plus.runtime.version) {
      appVersion.value = plus.runtime.version
    }
  } catch (e) {
    // 拿不到就用兜底值，不抛
  }
  // #endif
  return appVersion.value
}
