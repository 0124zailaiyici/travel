# server/ —— 已废弃

> **这个目录当前不参与运行。** App 已经改成纯直连架构（见根目录 `README.md`），
> 客户端直接调用腾讯地图和 DeepSeek，不再经过任何自建后端。

## 为什么还留着

作为历史记录保留。里面有一些可能还有参考价值的东西：

- `src/services/tencent.js` —— 腾讯地图接口封装（路线、POI 搜索、地理编码）
- `scripts/add_destinations.js` —— 早期往 `bundle.json` 里加目的地的脚本
- `data/` —— 早期数据文件

## 注意

**不要直接拿这里的数据当真。** `client-uni/src/data/bundle.json` 才是唯一数据源，
两者内容已经不一致。

`src/services/tencent.js` 里那个「时长少算 60 倍」的 bug 已经修掉了
（腾讯的 `duration` 本来就是分钟），但如果你打算复活这套后端，请先对照
`client-uni/src/services/map.js` —— 那才是现在真正在跑的版本。

## 为什么当初放弃自建后端

客户端直连的三个理由：

1. **Worker 在手机上连不上**。实测手机 `nc` 到 `*.workers.dev:443` 直接超时，
   而 `apis.map.qq.com` / `api.deepseek.com` 握手正常。原因未查明（疑似 DNS 污染）。
2. **多一跳就多一个故障点**。代理挂了整个 App 就废了，直连至少地图还能用。
3. **Key 放在客户端本来就是必须的**（个人自用 App，没有服务端可藏）。

完整证据见根目录 `README.md` 的「为什么放弃 Worker」一节。
