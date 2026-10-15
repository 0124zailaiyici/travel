@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   Huaxi map keys - Cloudflare Worker
echo ========================================
echo.
echo Leave a field empty to keep its current value.
echo Separate multiple keys with commas, e.g. key1,key2
echo Configure at least 2 providers, otherwise an exhausted key has no fallback.
echo.
set /p AMAP=AMAP_KEYS:
if not "%AMAP%"=="" (
  echo %AMAP%| node node_modules/wrangler/bin/wrangler.js secret put AMAP_KEYS
)
set /p TENCENT=TENCENT_MAP_KEYS:
if not "%TENCENT%"=="" (
  echo %TENCENT%| node node_modules/wrangler/bin/wrangler.js secret put TENCENT_MAP_KEYS
)
set /p BAIDU=BAIDU_MAP_KEYS:
if not "%BAIDU%"=="" (
  echo %BAIDU%| node node_modules/wrangler/bin/wrangler.js secret put BAIDU_MAP_KEYS
)
echo.
echo ---- Current worker status ----
curl -s https://huaxi-proxy.zailaiyici88.workers.dev/health
echo.
echo.
echo Check the providers counts: if only one is non-zero, the map source is a single point.
pause
