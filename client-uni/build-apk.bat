@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   花期 - Android 构建准备
echo ========================================
echo.
echo 架构：本地数据 + 实时地图/天气/AI
echo 日常运行不依赖 server 目录。
echo 目标编译器：HBuilderX / uni-app 5.14
echo 版本：1.0.3 (103)
echo.
echo 重要：
echo 1. 必须用 5.14 编译，避免手机端 5.12/5.14 版本不匹配弹窗
echo 2. 云打包完成后，安装最新时间戳 APK，不要装旧的 20260715xxxx
echo 3. 新包首页底部应显示：版本 1.0.3 · 编译器 5.14
echo 4. 新包首页应有【设置】【收藏】和【服务设置】入口
echo.

if not exist node_modules (
  echo 正在安装依赖...
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :err
)

echo 正在编译 Android 资源...
call pnpm run build:app-android
if errorlevel 1 goto :err

echo.
echo 编译完成：dist\build\app
echo 请在 HBuilderX 中执行：发行 - 原生 App 云打包 - Android
echo 当前版本：1.0.3 ^(103^) / 编译器 5.14
echo 验收：无版本不匹配弹窗 + 能看到设置页 + 详情可按位置刷新
echo.
exit /b 0

:err
echo 构建失败，请查看上方错误。
exit /b 1
