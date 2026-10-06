@echo off
title CT Task Manager - Production Server
echo ========================================================
echo        CT UNIVERSITY TASK MANAGER - PRODUCTION
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM Find Nginx directory
set NGINX_DIR=%ROOT_DIR%nginx
if not exist "%NGINX_DIR%\nginx.exe" (
    set NGINX_DIR=C:\Users\student\Desktop\Task-Manager\nginx
)

echo [1/3] Ensuring previous instances are stopped cleanly...
taskkill /F /FI "WINDOWTITLE eq CT-Backend*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo [2/3] Starting Backend with Auto-Restart Supervisor (Port 5000)...
start "CT-Backend-Supervisor" /min cmd /c "cd /d "%ROOT_DIR%ct-task-manager\backend" && node supervisor.js"

echo [3/3] Starting / Reloading Nginx Reverse Proxy (Port 80/443)...
if exist "%NGINX_DIR%\nginx.exe" (
    cd /d "%NGINX_DIR%"
    nginx.exe -s quit >nul 2>&1
    ping 127.0.0.1 -n 2 >nul
    start "" nginx.exe
    cd /d "%ROOT_DIR%"
) else (
    echo [WARNING] Nginx executable not found at "%NGINX_DIR%".
)

echo.
echo Waiting for backend server to become ready on Port 5000...
set /a attempts=0
:WAIT_LOOP
set /a attempts+=1
ping 127.0.0.1 -n 2 >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2; if ($r.success) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto READY
if %attempts% geq 10 goto READY_TIMEOUT
goto WAIT_LOOP

:READY
echo [OK] Backend server is ONLINE and connected to MongoDB!
goto ACTIVE

:READY_TIMEOUT
echo [INFO] Backend is still initializing in the background.

:ACTIVE
echo.
echo ========================================================
echo               DEPLOYMENT IS NOW ACTIVE!
echo ========================================================
echo.
echo  Access URLs:
echo   - Local PC:       http://localhost
echo   - Direct Backend: http://localhost:5000/api/health
echo.
echo  The Backend is running under an auto-restarting supervisor.
echo  If it ever crashes or encounters a network blip, it will
echo  automatically recover within 2 seconds.
echo.
echo --------------------------------------------------------
echo  [1] Leave servers running and close this launcher window
echo  [2] Open live backend supervisor logs
echo  [3] Stop all servers (Nginx + Backend)
echo --------------------------------------------------------

if "%1"=="--background" goto AUTO_EXIT
if "%1"=="auto" goto AUTO_EXIT

set /p CHOICE="Enter choice (1/2/3) or press Enter to keep running: "

if "%CHOICE%"=="2" (
    start "Backend-Logs" powershell -NoProfile -Command "Get-Content -Path '%ROOT_DIR%ct-task-manager\backend\logs\supervisor.log' -Wait -Tail 20"
    exit /b 0
)
if "%CHOICE%"=="3" (
    call "%ROOT_DIR%stop-all.bat"
    exit /b 0
)

echo Servers are running in background.
ping 127.0.0.1 -n 3 >nul
exit /b 0

:AUTO_EXIT
echo [OK] Started successfully in background mode.
ping 127.0.0.1 -n 2 >nul
exit /b 0
