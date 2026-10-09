@echo off
cd /d "%~dp0"
echo ============================================
echo   Fitness plan - cloud service (server + tunnel)
echo ============================================
echo.
if not exist node_modules (
  echo [1/2] First run: installing dependency localtunnel ...
  call npm i localtunnel --no-audit --no-fund
)
echo [2/2] Starting server + public tunnel, wait about 10-20s ...
echo.
node start.js
echo.
echo If no link is shown above, open url.txt in this folder.
pause
