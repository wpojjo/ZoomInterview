@echo off
cd /d "%~dp0"
echo Generating Prisma client...
npx prisma generate
echo.
echo Starting dev server...
npm run dev
