@echo off
setlocal
cd /d "%~dp0"
title Sellerbricks EDU - dev server (127.0.0.1:3040)
where node >nul 2>nul
if errorlevel 1 goto nonode
node scripts\local-run.mjs dev
goto end

:nonode
echo.
echo   [ERROR] Node.js is not installed (or not in PATH).
echo   Install Node.js 24 LTS from https://nodejs.org , then run this file again.

:end
echo.
pause
