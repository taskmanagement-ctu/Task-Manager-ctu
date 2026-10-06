@echo off
title CT Task Manager - Stop Servers
echo ========================================================
echo        STOPPING CT TASK MANAGER SERVERS
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

set NGINX_DIR=%ROOT_DIR%nginx
if not exist "%NGINX_DIR%\nginx.exe" (
    set NGINX_DIR=C:\Users\student\Desktop\Task-Manager\nginx
)

echo [1/3] Stopping Nginx Reverse Proxy...
if exist "%NGINX_DIR%\nginx.exe" (
    cd /d "%NGINX_DIR%"
    nginx.exe -s stop >nul 2>&1
    nginx.exe -s quit >nul 2>&1
    cd /d "%ROOT_DIR%"
)
taskkill /F /IM nginx.exe >nul 2>&1

echo [2/3] Stopping CT-Backend Supervisor & Windows instances...
taskkill /F /FI "WINDOWTITLE eq CT-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Backend-Logs*" >nul 2>&1

echo [3/3] Freeing Port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo.
echo [OK] All servers (Nginx and Backend) have been safely stopped.
ping 127.0.0.1 -n 2 >nul
exit /b 0
