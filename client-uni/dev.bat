@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  Huaqi - WeChat mini program dev build
rem
rem  NOTE: keep this file pure ASCII. cmd.exe parses .bat as ANSI/GBK,
rem  so non-ASCII bytes here get mangled (the emoji below used to render
rem  as garbage and could swallow the following line).
rem ============================================================

echo ========================================
echo   Huaqi - mini program dev build
echo ========================================
echo Output goes to dist\dev\mp-weixin
echo Import that directory in WeChat DevTools to preview.
echo.

call npx uni -p mp-weixin
pause
