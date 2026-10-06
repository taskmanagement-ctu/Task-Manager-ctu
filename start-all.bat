@echo off
title CT Task Manager - Production Server
echo ========================================================
echo        CT UNIVERSITY TASK MANAGER - PRODUCTION
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/3] Starting Backend Server (Port 5000)...
start "CT-Backend" /min cmd /c "cd /d %ROOT_DIR%ct-task-manager\backend && npm start"

echo [2/3] Starting Nginx Reverse Proxy (Port 80)...
cd /d "C:\Users\student\Desktop\Task-Manager\nginx"
nginx.exe -s quit >nul 2>&1
timeout /t 1 /nobreak >nul
start "" nginx.exe
cd /d "%ROOT_DIR%"

timeout /t 2 /nobreak >nul

echo [3/3] Deployment Active!
echo.
echo --------------------------------------------------------
echo  ACCESS URLS (NO PORT REQUIRED):
echo.
echo  Local PC:      http://localhost
echo --------------------------------------------------------
echo.
echo Press any key to stop all servers...
pause >nul

echo Stopping Nginx...
cd /d "C:\Users\student\Desktop\Task-Manager\nginx"
nginx.exe -s stop >nul 2>&1
echo Stopping Backend...
taskkill /F /FI "WINDOWTITLE eq CT-Backend*" >nul 2>&1
echo All servers stopped.
pause
