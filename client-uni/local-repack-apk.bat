@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   花期 - 本地完整重建 APK (测试签名)
echo ========================================
echo 说明：完整解包旧云包，写入最新资源和版本，再重新构建
echo 安装：固定使用手机内部存储，避免安装异常 (-18)
echo 签名：client-uni\keystore\debug.keystore（已备份，固定签名可覆盖安装）
echo       仅首次从云打包签名切换到本证书时需卸载一次，之后无需卸载
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo 未找到 pnpm
  exit /b 1
)

echo [1/2] 编译 app-android 资源...
call pnpm run build:app-android
if errorlevel 1 goto :err

echo [2/2] 完整重建并签名...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-repack-apk.ps1"
if errorlevel 1 goto :err

echo.
echo 完成。请安装 dist\release\apk 下最新时间戳 APK
echo 验收：首页底部 版本 1.0.3 · 编译器 5.14 ；有设置入口
exit /b 0

:err
echo 失败
exit /b 1
