# 花期 huaxi

个人自用的旅行目的地推荐 App。基于 **uni-app + Vue 3.4 + Vite 5**，主目标是
Android APK（`app-android`），同时保留 H5 与微信小程序构建能力。

内置 **167 个目的地**离线数据，无网络时也能正常浏览、筛选当季推荐、看详情。

---

## 一、当前架构：纯直连

> **2026-10-15 变更**：已移除 Cloudflare Worker 代理，改为客户端直连。

### 为什么放弃 Worker

原架构是 `App → Cloudflare Worker → 高德/腾讯/百度 + AI`，Worker 负责藏 Key、
多 Key 轮换、跨厂商降级。但在目标网络环境下实测：

| 目标 | 手机 TCP 443 | 结论 |
|---|---|---|
| `huaxi-proxy.zailaiyici88.workers.dev` | **`nc: Timeout`** | TCP 握手都完不成 |
| `apis.map.qq.com` | 握手成功 | 可达 |
| `api.deepseek.com` | 握手成功 | 可达 |
| `api.open-meteo.com` | 握手成功 | 可达 |

`*.workers.dev` 在国内手机网络上被间歇性 DNS 污染（实测返回 `199.59.148.7`、
`199.59.150.12` 等非 Cloudflare 网段 IP），而同一域名在电脑上解析正常
（`104.31.142.88`）。结果是**每次地图/AI 请求都要先发一次注定失败的 Worker 请求，
把超时耗完才降级**。

由于是个人自用（自己的 Key、自己的手机），藏 Key 的价值低于可用性，因此改为直连。
`proxy-worker/` 目录保留但**已不参与构建**，那套多 Key 轮换逻辑以后若有国内可达的
域名仍可复用。

### 数据流

```
本地 bundle.json（167 目的地，秒开）
      ↓ 缺失时
腾讯地图 POI 直连（apis.map.qq.com）
      ↓ 失败时
AI 直连（api.deepseek.com）生成行程
      ↓ 失败时
内置模板行程
```

天气走 `api.open-meteo.com` 直连，不依赖任何 Key。

### 缓存

按命名空间分桶存在 `uni` storage，前缀 `hxcache:<ns>:`（见 `services/cache.js`）：

| 命名空间 | 内容 | TTL |
|---|---|---|
| `map` | POI 搜索结果 | 30 分钟 |
| `nearby` | 附近推荐 | 15 分钟 |
| `route` | 驾车/公交路线 | 24 小时 |
| `weather` | 天气 | — |
| `ai` / `detail_ai` | AI 行程 | 7 天 |
| `ai_rec` | AI 搜索/附近推荐 | 6–12 小时 |

---

## 二、目录结构

```
Travel_planning/
├── client-uni/                 # 主客户端（uni-app）
│   ├── src/
│   │   ├── api/index.js        # 数据编排：本地秒开 + 异步增强
│   │   ├── data/bundle.json    # 167 个目的地离线数据
│   │   ├── static/themes/      # 10 张主题配图（t1..t10.jpg）
│   │   ├── pages/              # index / detail / search / favorites / settings
│   │   └── services/
│   │       ├── localDb.js      # 本地数据查询、距离排序
│   │       ├── map.js          # 腾讯地图直连（POI / 路线）
│   │       ├── deepseek.js     # AI 行程生成（OpenAI 兼容格式）
│   │       ├── aiRecommend.js  # AI 增强搜索 / 附近推荐
│   │       ├── weather.js      # open-meteo 天气
│   │       ├── userStore.js    # 收藏 / 历史 / 评论（仅本地 storage）
│   │       ├── config.js       # 运行时配置
│   │       └── config.local.js # 私有配置（已 gitignore）
│   ├── keystore/               # 签名证书（已 gitignore）
│   ├── local-repack-apk.ps1    # 重打包 + 重签名
│   └── build-apk.bat           # 一键：编译 + 重打包
├── proxy-worker/               # Cloudflare Worker（已弃用，保留备查）
├── server/                     # 早期 Node 服务端（已弃用）
├── design/                     # 早期 HTML 设计稿
└── open-design/                # 无关的 vendored 项目，可忽略
```

---

## 三、配置 Key

两种方式，任选其一。**改完不需要重新打包**（设置页写入 storage，运行时覆盖编译默认值）。

### 方式 A：App 内设置页（推荐）

首页右上角「设置」，四个字段：

| 字段 | 说明 |
|---|---|
| AI 接口地址 | 默认 `https://api.deepseek.com` |
| AI Key | 填了才会调用 AI；为空则用内置模板行程 |
| AI 模型 | 默认 `deepseek-chat`，必须与接口地址匹配 |
| 地图 Key | 腾讯地图 Key；为空则只用离线数据 |

> **注意**：这三项要一起改。只填 Key 不改地址/模型，会拿 DeepSeek 的 Key 去请求
> 别的服务，必然鉴权失败。

### 方式 B：`config.local.js`

复制 `src/services/config.local.example.js` 为 `config.local.js` 后填写。该文件已
gitignore，会被编译进包。

```js
export default {
  tencentMapKey: '',                      // 腾讯地图 Key
  deepseekKey: '',                        // AI Key
  deepseekBase: 'https://api.deepseek.com',
  aiModel: 'deepseek-chat',
}
```

### 腾讯地图 Key 配额说明

各端点**配额独立**，不要因为一个端点报 `status=121` 就以为整个 Key 失效：

| 端点 | 用途 |
|---|---|
| `place/v1/search` | POI 搜索（每日配额易耗尽，次日 0 点重置） |
| `place/v1/suggestion` | 搜索建议 |
| `direction/v1/driving` | 驾车路线（独立配额） |
| `direction/v1/transit` | 公交路线（独立配额） |

排查时用 `suggestion` 端点做对照：真 Key 返回 `status=0`，假 Key 返回
`status=311 key格式错误`。

---

## 四、构建 APK

### 前置

- Node + pnpm
- `apktool`（本项目用的是 `C:\Users\wx\Tools\apktool\apktool.bat`）
- Android SDK `build-tools`（`aapt.exe` / `zipalign.exe` / `apksigner.bat`）
- 一个已用 HBuilderX 云打包产出的**基础 APK**（`dist/release/apk/`，脚本按正则自动挑选）

### 流程

```powershell
cd client-uni
pnpm run build:app-android      # 产出 dist/build/app
.\local-repack-apk.ps1          # apktool 解包 → 换 www → 改版本 → zipalign → 签名
```

脚本会输出 `dist/release/apk/__UNI__5B95181__<时间戳>_installfix.apk`，并自动
校验 v1/v2/v3 签名。

或用 `build-apk.bat` 一步到位。

### 安装

```powershell
adb install -r dist/release/apk/__UNI__5B95181__*_installfix.apk
```

包名 `uni.app.UNIHUAXI001`，`versionCode 103` / `versionName 1.0.3`，
`install-location: internalOnly`（规避 `INSTALL_FAILED_INSUFFICIENT_STORAGE`）。

> **必须解锁手机**。锁屏状态下系统弹不出安装确认框，`adb install` 会直接报
> `INSTALL_FAILED_ABORTED: User rejected permissions`。

---

## 五、Windows 上的两个编码陷阱

这两个坑排查了很久，改动脚本时务必注意：

### 1. `.bat` 必须纯 ASCII

`cmd.exe` 按 **ANSI（GBK）** 代码页解析批处理文件，与文件实际编码无关。
UTF-8 中文会被拆成非法命令：

```
'内部存储，避免安装异常' is not recognized as an internal or external command
```

`chcp 65001` 只管输出，管不了解析。**所有 `.bat` 保持纯 ASCII 注释。**

### 2. 无 BOM 的 `.ps1` 里的中文注释会吞掉下一行

Windows PowerShell 5.1 对**无 BOM** 的 UTF-8 脚本按 GBK 解码。中文注释乱码后，
行尾字节可能吃掉换行符，导致**下一行代码被当成注释的一部分**：

```powershell
# 项目根目录下的 key           ← 乱码后吞掉了下一行
$projectKey = Join-Path $root ...   # 这行从未执行，$projectKey 为 null
```

**致命之处**：注释吞行是**合法语法**，AST 解析照样通过，语法检查发现不了。
必须实际跑一遍才会暴露。

> 结论：`.ps1` 要么写 ASCII 注释，要么存成 UTF-8 **with BOM**。

---

## 六、签名与数据安全

- 证书：`client-uni/keystore/debug.keystore`
- 证书 SHA-256：`bd7d6bd29b26d6918202f66bd8b551745f65623a10e8b50ef50d77d0e7691427`
- 外部备份：`D:\demo\AI\my-app\opencode\_keystore-backup\debug.keystore`

> **收藏、历史、评论全部存在本地 storage，没有云端同步。**
>
> - 换签名证书 → 必须卸载重装 → **数据全丢**
> - 卸载 App → 数据全丢
>
> 证书丢了就没法覆盖安装。**务必备份证书**；如确需换证书，先做数据导出。

---

## 七、已知问题

| 问题 | 位置 | 状态 |
|---|---|---|
| 目的地配图缺失时曾用 `picsum.photos` 随机图兜底，出现「九寨沟显示饺子、西湖显示风力发电机」 | `data/bundle.json` | ✅ 已修：改为 10 张主题配图 |
| 定位超时仅 1800ms，冷启动来不及 → 「附近推荐」静默退化成前 8 个目的地，且无任何失败提示 | `pages/index/index.vue` | ✅ 已修：超时提到 8000ms，失败时改为「热门推荐」并给出重试入口 |
| 无定位兜底是 `getAllDestinations().slice(0,8)`（bundle 原始顺序），既不「附近」也不「热门」 | `api/index.js` | ✅ 已修：改为按评分取前 8 |
| `zailaiyici.xyz` 域名已失效（解析到 `127.0.0.1`） | 历史遗留 | ✅ 已从配置中移除 |

### 主题配图机制

`client-uni/src/static/themes/` 下有 10 张按主题分类的配图（400×400 JPEG，合计约 271 KB）：

| 文件 | 主题 | 文件 | 主题 |
|---|---|---|---|
| `t1.jpg` | 赏樱 | `t6.jpg` | 烟花 |
| `t2.jpg` | 雪山 | `t7.jpg` | 古镇 |
| `t3.jpg` | 海岛 | `t8.jpg` | 露营 |
| `t4.jpg` | 红叶 | `t9.jpg` | 温泉 |
| `t5.jpg` | 赶海 | `t10.jpg` | 花海 |

`localDb.ensureImage()` 按目的地的 `theme_ids[0]` 取对应图片；`image_url` 为空的
56 个目的地由此获得配图，其余 111 个仍用高德真实图片。

> 要替换或新增主题配图，直接覆盖 `static/themes/tN.jpg` 即可。新增主题需同时
> 更新 `localDb.js` 里的 `THEME_IDS` 数组和 `bundle.json` 的 `themes`。

### 场景覆盖（scenes）

`bundle.json` 里 **`t3 海岛` 被当成了"水景"兜底标签**，瀑布、江、湖、梯田都被打了它。
只按 `theme_ids[0]` 取图会让黄果树瀑布显示成沙滩，因此 `localDb.js` 里有一张
按目的地名的精确覆盖表 `SCENE_OVERRIDE`：

| 目的地 | 覆盖为 | 文件 |
|---|---|---|
| 黄果树瀑布、德天跨国瀑布 | 瀑布 | `static/scenes/waterfall.jpg` |
| 桂林漓江、桂林两江四湖、荔波小七孔 | 江河山水 | `static/scenes/river.jpg` |
| 昆明滇池 | 湖泊 | `static/scenes/lake.jpg` |
| 龙脊梯田 | 梯田 | `static/scenes/terrace.jpg` |

> 若日后清理了 `bundle.json` 的主题标注，这张覆盖表可以一并删掉。
> 新增覆盖条目时，记得把对应图片放进 `static/scenes/`。



---

## 八、H5 调试

H5 是最快的迭代方式，不需要打包：

```powershell
cd client-uni
pnpm run build:h5      # 或 pnpm run dev:h5
```

注意：H5 与 App 端的网络行为可能不同（浏览器不受 `mp-weixin.setting.urlCheck`
影响，也不受 App 端 webview 限制），**排查网络问题必须以真机 APK 为准**。
