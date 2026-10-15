@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   花期地图 Key 配置（Cloudflare Worker）
echo ========================================
echo.
echo 留空表示不修改该项。多个 Key 用逗号分隔，例如 key1,key2
echo 建议至少配置 2 家地图服务，避免单 Key 额度耗尽后无兜底。
echo.
set /p AMAP=高德 AMAP_KEYS:
if not "%AMAP%"=="" (
  echo %AMAP%| node node_modules/wrangler/bin/wrangler.js secret put AMAP_KEYS
)
set /p TENCENT=腾讯 TENCENT_MAP_KEYS:
if not "%TENCENT%"=="" (
  echo %TENCENT%| node node_modules/wrangler/bin/wrangler.js secret put TENCENT_MAP_KEYS
)
set /p BAIDU=百度 BAIDU_MAP_KEYS:
if not "%BAIDU%"=="" (
  echo %BAIDU%| node node_modules/wrangler/bin/wrangler.js secret put BAIDU_MAP_KEYS
)
echo.
echo ---- 当前 Worker 状态 ----
curl -s https://huaxi-proxy.zailaiyici88.workers.dev/health
echo.
echo.
echo 检查 providers 各项数量：若只有一项非 0，说明地图服务是单点，建议补 Key。
pause
