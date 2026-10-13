@echo off
setlocal
cd /d "%~dp0"
title Sellerbricks EDU - smoke test
where node >nul 2>nul
if errorlevel 1 goto nonode
echo.
echo   Run this while the server is running (start or build-preview window open).
echo   It creates demo accounts and test data - local only.
echo.
pause
node scripts\smoke-test.mjs
goto end

:nonode
echo.
echo   [ERROR] Node.js is not installed (or not in PATH).
echo   Install Node.js 24 LTS from https://nodejs.org , then run this file again.

:end
echo.
pause
