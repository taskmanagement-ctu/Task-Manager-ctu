@echo off
title CT Task Manager - Stop Servers
echo ========================================================
echo        STOPPING CT TASK MANAGER SERVERS
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM 1. Set .stopped flag to prevent auto-heal watchdog from restarting
type nul > "%ROOT_DIR%.stopped" 2>nul

REM 2. Pause the Windows Scheduled Task Auto-Healer
schtasks /Change /TN "CT-TaskManager-AutoHeal" /Disable >nul 2>&1

set NGINX_DIR=%ROOT_DIR%nginx
if not exist "%NGINX_DIR%\nginx.exe" (
    set NGINX_DIR=C:\Users\student\Desktop\Task-Manager\nginx
)

echo [1/4] Stopping Nginx Reverse Proxy...
if exist "%NGINX_DIR%\nginx.exe" (
    pushd "%NGINX_DIR%"
    nginx.exe -s stop >nul 2>&1
    nginx.exe -s quit >nul 2>&1
    popd
)
taskkill /F /IM nginx.exe >nul 2>&1

echo [2/4] Stopping Node Supervisor and Backend instances...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*supervisor.js*' -or $_.CommandLine -like '*dist\server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq CT-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Backend-Logs*" >nul 2>&1

echo [3/4] Freeing Port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo [4/4] Stopping GitHub Actions Runner (if running)...
taskkill /F /FI "WINDOWTITLE eq *Runner*" >nul 2>&1
taskkill /F /IM Runner.Listener.exe >nul 2>&1
taskkill /F /IM Runner.Worker.exe >nul 2>&1

echo.
echo ========================================================
echo  [OK] All servers have been safely stopped.
echo  Auto-healer is PAUSED until start-all.bat is run again.
echo ========================================================
ping 127.0.0.1 -n 2 >nul
exit /b 0
