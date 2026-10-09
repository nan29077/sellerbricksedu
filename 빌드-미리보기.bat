@echo off
chcp 949 > nul
title 셀러브릭스 에듀 - 빌드 미리보기 (운영과 동일한 환경)
cd /d "%~dp0"

echo.
echo  ============================================================
echo    셀러브릭스 에듀 - 빌드 미리보기
echo  ============================================================
echo    운영 사이트와 같은 방식으로 빌드해서 실행합니다.
echo    배포 전 최종 확인용이며, 코드 수정은 즉시 반영되지 않습니다.
echo    주소 : http://127.0.0.1:3040
echo    종료 : 이 창에서 Ctrl + C
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [오류] Node.js를 찾을 수 없습니다. https://nodejs.org 에서 설치해 주세요.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  패키지를 설치합니다...
  call corepack pnpm install
  if errorlevel 1 goto fail
)

echo  [1/2] 빌드 중입니다. 1~2분 걸립니다...
echo.
call corepack pnpm build
if errorlevel 1 goto fail

echo.
echo  [2/2] 서버를 시작합니다. 잠시 후 브라우저가 열립니다...
echo.
start "" /b cmd /c "timeout /t 10 > nul & start "" http://127.0.0.1:3040"

call corepack pnpm start
if errorlevel 1 goto fail
goto end

:fail
echo.
echo  ------------------------------------------------------------
echo  [오류] 실행에 실패했습니다. 위의 메시지를 확인해 주세요.
echo  ------------------------------------------------------------

:end
echo.
pause
