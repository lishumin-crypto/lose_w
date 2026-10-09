@echo off
rem Auto-start the fitness cloud service (server + tunnel) via watchdog
cd /d "%~dp0"
set "NODEEXE=node"
where node >nul 2>nul || set "NODEEXE=C:\Users\3c\.workbuddy\binaries\node\versions\22.12.0\node.exe"
start "" /min "%NODEEXE%" watchdog.js
