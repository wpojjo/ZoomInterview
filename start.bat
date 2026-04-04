@echo off
echo AI 면접 코치 서버 시작 중...

:: Python 크롤링 서버 (포트 8000)
start "Python 크롤링 서버" cmd /k "cd /d "%~dp0server" && uvicorn server:app --port 8000"

:: Next.js 서버 (포트 3000)
start "Next.js 서버" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo 서버가 시작되었습니다.
echo   Next.js  : http://localhost:3000
echo   Python   : http://localhost:8000
echo.
echo 브라우저에서 http://localhost:3000 을 열어주세요.
