@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   减脂计划 · 云端启动
echo ============================================
echo.
if not exist node_modules (
  echo [1/2] 首次运行，安装依赖 localtunnel ...
  call npm i localtunnel --no-audit --no-fund
)
echo [2/2] 启动服务器 + 公网隧道，稍等约 10 秒...
echo.
node start.js
echo.
echo 若上面没有显示链接，请查看同目录下的 url.txt
pause
