@echo off
chcp 949 > nul
title 셀러브릭스 에듀 - 개발 서버 (localhost:3040)
cd /d "%~dp0"
set COREPACK_ENABLE_DOWNLOAD_PROMPT=0

echo.
echo  ============================================================
echo    셀러브릭스 에듀 - 로컬 미리보기
echo  ============================================================
echo    주소 : http://127.0.0.1:3040
echo    종료 : 이 창에서 Ctrl + C  (또는 창 닫기)
echo    코드를 수정하고 저장하면 화면에 바로 반영됩니다.
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [오류] Node.js를 찾을 수 없습니다.
  echo         https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  처음 실행이라 패키지를 설치합니다. 3~5분 걸릴 수 있어요...
  echo.
  call corepack pnpm install
  if errorlevel 1 goto fail
  echo.
)

echo  서버를 시작합니다. 약 15초 뒤 브라우저가 자동으로 열립니다...
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 15; Start-Process 'http://127.0.0.1:3040'"

call corepack pnpm dev
if errorlevel 1 goto fail
goto end

:fail
echo.
echo  ------------------------------------------------------------
echo   [오류] 실행에 실패했습니다. 위의 메시지를 확인해 주세요.
echo          포트 3040이 이미 사용 중이면 기존 실행 창을 먼저 닫아주세요.
echo  ------------------------------------------------------------

:end
echo.
pause
