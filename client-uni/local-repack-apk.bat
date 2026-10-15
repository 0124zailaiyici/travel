@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   Huaxi - Full local APK rebuild
echo ========================================
echo Steps  : unpack cloud APK, inject latest assets, rebuild, sign
echo Install: forced internal storage, avoids install error (-18)
echo Signing: client-uni\keystore\debug.keystore (backed up, stable signature)
echo          Uninstall needed only once, when switching from the cloud cert.
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm not found in PATH
  exit /b 1
)

echo [1/2] Building app-android assets...
call pnpm run build:app-android
if errorlevel 1 goto :err

echo [2/2] Repacking and signing...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-repack-apk.ps1"
if errorlevel 1 goto :err

echo.
echo Done. Install the newest timestamped APK under dist\release\apk
echo Verify: home page footer shows "1.0.3 / 5.14" and the Settings entry exists.
exit /b 0

:err
echo [ERROR] build failed, see messages above
exit /b 1
