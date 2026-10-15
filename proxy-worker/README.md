# huaxi-proxy（已弃用）

> ⚠️ **本 Worker 已不再被客户端使用**（2026-10-15 起）。
>
> 客户端已改为**纯直连**模式。原因：`*.workers.dev` 在国内手机网络上 TCP 握手超时，
> 代理层在目标环境完全不可用。详见根目录 [README.md](../README.md) 第一节。
>
> 代码保留备查 —— 多 Key 轮换 + 跨厂商降级的逻辑是完整的，若将来有国内可达的
> 域名，这套实现仍可直接复用。

## 用途

原本作为 APK 与地图/AI 服务之间的代理，承担四件事：

1. **藏 Key** —— APK 可被反编译，Key 不落客户端
2. **多 Key 轮换** —— 某 Key 配额耗尽则标记冷却 30 分钟并换下一个
3. **跨厂商降级** —— `amap → tencent → baidu`
4. **结果缓存** —— 15 分钟，避免重复消耗配额

## 地址

```
https://huaxi-proxy.zailaiyici88.workers.dev
```

## Secret

```bash
# 地图 Key（逗号分隔多个，用于轮换）
wrangler secret put AMAP_KEYS
wrangler secret put TENCENT_MAP_KEYS
wrangler secret put BAIDU_MAP_KEYS

# AI
wrangler secret put AI_KEY
wrangler secret put AI_BASE
wrangler secret put AI_MODEL
```

兼容的单数变量名：`TENCENT_MAP_KEY`、`AMAP_KEY`、`BAIDU_MAP_KEY`。

## 路由

| 方法 | 路径 |
|---|---|
| GET | `/health` |
| GET | `/map/search?keyword=&city=` |
| GET | `/map/nearby?lat=&lng=` |
| GET | `/map/detail?id=` |
| GET | `/map/route/driving?fromLat=&fromLng=&toLat=&toLng=` |
| GET | `/map/route/transit?fromLat=&fromLng=&toLat=&toLng=` |
| POST | `/ai/itinerary` |
| POST | `/ai/recommend` |

## 部署

```bash
cd proxy-worker
pnpm install
node node_modules/wrangler/bin/wrangler.js deploy
```

> `set-map-keys.bat` 里 wrangler 的路径必须写 `node_modules/wrangler/bin/wrangler.js`
> （正斜杠）。早期写成 `node_modules\wranglerin\` 是因为 `\b` 被当成转义序列吃掉了。

## 行为说明

`src/index.js` 对腾讯 `status=121`（每日调用量已达上限）与配额类错误信息做了显式识别，
**会正确触发冷却**，不是 bug。若看到 `all providers failed: tencent:此key每日调用量
已达到上限`，说明所有 Key 都已进入冷却，等次日 0 点配额重置即可。
