@echo off
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo ============================================
echo   Install: auto-start fitness cloud at logon
echo ============================================
echo.
copy /Y "%~dp0autostart.vbs" "%STARTUP%\FitnessCloud.vbs" >nul 2>nul
if exist "%STARTUP%\FitnessCloud.vbs" (
  echo [OK] Installed successfully.
  echo      The service will start automatically at every logon.
  echo      Link is in url.txt in this folder.
) else (
  echo [FAILED] Could not install automatically.
  echo Please copy this file manually:
  echo   %~dp0autostart.vbs
  echo to this folder:
  echo   %STARTUP%
)
echo.
echo To uninstall, just delete:
echo   %STARTUP%\FitnessCloud.vbs
echo.
pause
