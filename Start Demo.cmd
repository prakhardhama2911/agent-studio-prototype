@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing the standalone demo dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
echo.
echo Agent Studio demo: http://127.0.0.1:5174/
echo Keep this window open while presenting. Press Ctrl+C to stop.
echo.
call npm run dev
pause
