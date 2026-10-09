@echo off
cd /d "%~dp0"
echo ============================================
echo   Fitness plan - cloud service (server + tunnel)
echo ============================================
echo.
echo Starting server + public tunnel, wait about 15-30s ...
echo.
node start.js
echo.
echo If no link is shown above, open url.txt in this folder.
pause
