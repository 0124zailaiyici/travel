@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   Huaxi - Android build preparation
echo ========================================
echo.
echo Architecture: local data + live map / weather / AI (direct, no backend)
echo Target compiler: HBuilderX / uni-app 5.14
echo Version: 1.0.4 (104)
echo.
echo IMPORTANT:
echo 1. Build with 5.14, otherwise phones show a compiler mismatch dialog.
echo 2. After cloud packaging, install the newest timestamped APK.
echo 3. Settings page should show version 1.0.4 / compiler 5.14
echo 4. Home page should show Settings and Favorites entries.
echo.

if not exist node_modules (
  echo Installing dependencies...
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :err
)

echo Building Android assets...
call pnpm run build:app-android
if errorlevel 1 goto :err

echo.
echo Build output: dist\build\app
echo Next: in HBuilderX run Release - Native App cloud packaging - Android
echo Version: 1.0.4 (104) / compiler 5.14
echo Accept: no version mismatch dialog + Settings page reachable + detail can refresh by location
echo.
exit /b 0

:err
echo Build failed, see messages above.
exit /b 1
