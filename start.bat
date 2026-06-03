@echo off
chcp 65001 >nul
echo ========================================
echo   🌸 花期 - 旅行目的地推荐工具
echo ========================================
echo.
echo [1/2] 启动后端 API...
start "花期API" /B node server\src\index.js
echo 后端运行在 http://localhost:3002
echo.
echo [2/2] 启动前端开发...
cd client-uni
npx uni -p mp-weixin
pause
