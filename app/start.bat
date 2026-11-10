@echo off
REM Start the maintenance app on Windows. Double-click this file.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Install it once from nodejs.org, then run this again.
  pause
  exit /b 1
)
node --no-warnings=ExperimentalWarning server.js
pause
