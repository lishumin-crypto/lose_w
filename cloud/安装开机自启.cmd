@echo off
chcp 65001 >nul
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo ============================================
echo   安装：开机自动启动 - 减脂计划云端服务
echo ============================================
echo.
copy /Y "%~dp0autostart.vbs" "%STARTUP%\FitnessCloud.vbs" >nul
if errorlevel 1 (
  echo [x] 安装失败，请手动把 autostart.vbs 复制到：
  echo     %STARTUP%
) else (
  echo [√] 安装成功！以后每次开机/登录会自动启动，
  echo     链接保持固定：见同目录 url.txt
)
echo.
echo 卸载：删除下面这个文件即可
echo     %STARTUP%\FitnessCloud.vbs
echo.
pause
