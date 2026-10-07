@echo off
title CT Task Manager - Production Server
echo ========================================================
echo        CT UNIVERSITY TASK MANAGER - PRODUCTION
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM 1. Clear .stopped flag
if exist "%ROOT_DIR%.stopped" del /f /q "%ROOT_DIR%.stopped" >nul 2>&1

REM 2. Re-enable Auto-Heal Windows Scheduled Task
schtasks /Change /TN "CT-TaskManager-AutoHeal" /Enable >nul 2>&1

REM 3. Locate Nginx directory
set NGINX_DIR=%ROOT_DIR%nginx
if not exist "%NGINX_DIR%\nginx.exe" (
    set NGINX_DIR=C:\Users\student\Desktop\Task-Manager\nginx
)

REM 4. Ensure Frontend production build exists (prevents Nginx rewrite cycle)
if exist "%ROOT_DIR%ct-task-manager\frontend\dist\index.html" goto FRONTEND_OK
echo [INFO] Building Frontend production bundle...
cmd /c "npm --prefix "%ROOT_DIR%ct-task-manager\frontend" run build"
:FRONTEND_OK

REM 5. Check / Start Nginx Reverse Proxy (Port 80/443)
echo [1/3] Ensuring Nginx Reverse Proxy is running...
tasklist /fi "imagename eq nginx.exe" 2>nul | find /i "nginx.exe" >nul
if errorlevel 1 goto START_NGINX

echo [OK] Nginx is already running. Reloading configuration...
if exist "%NGINX_DIR%\nginx.exe" (
    pushd "%NGINX_DIR%"
    nginx.exe -s reload >nul 2>&1
    popd
)
goto NGINX_DONE

:START_NGINX
if exist "%NGINX_DIR%\nginx.exe" (
    echo Starting Nginx detached from IDE...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$wmi = [wmiclass]'Win32_Process'; $wmi.Create('%NGINX_DIR%\nginx.exe', '%NGINX_DIR%', $null)" >nul 2>&1
) else (
    echo [WARNING] Nginx executable not found at "%NGINX_DIR%".
)
:NGINX_DONE

REM 6. Check / Start Backend Server (Port 5000)
echo [2/3] Checking Backend status on Port 5000...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2; if ($r.success -or $r.database) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto BACKEND_RUNNING

echo Starting Backend under Detached Supervisor (Port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*supervisor.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wmi = [wmiclass]'Win32_Process'; $wmi.Create('node supervisor.js', '%ROOT_DIR%ct-task-manager\backend', $null)" >nul 2>&1
goto BACKEND_DONE

:BACKEND_RUNNING
echo [OK] Backend server is already running and healthy!

:BACKEND_DONE

REM 7. GitHub Actions Self-Hosted Runner (optional)
if not exist "C:\actions-runner\.runner" goto RUNNER_DONE
tasklist /fi "imagename eq Runner.Listener.exe" 2>nul | find /i "Runner.Listener.exe" >nul
if errorlevel 1 goto START_RUNNER
echo [3/3] GitHub Actions Self-Hosted Runner is already running.
goto RUNNER_DONE

:START_RUNNER
echo [3/3] Starting GitHub Actions Self-Hosted Runner in background...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wmi = [wmiclass]'Win32_Process'; $wmi.Create('cmd.exe /c run.cmd', 'C:\actions-runner', $null)" >nul 2>&1

:RUNNER_DONE

REM 8. Health Verification Loop
echo.
echo Waiting for backend server to verify health...
set /a attempts=0
:WAIT_LOOP
set /a attempts+=1
ping 127.0.0.1 -n 2 >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/health' -TimeoutSec 2; if ($r.success -or $r.database) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto READY
if %attempts% geq 8 goto READY_TIMEOUT
goto WAIT_LOOP

:READY
echo [OK] Backend server is ONLINE and verified healthy!
goto ACTIVE

:READY_TIMEOUT
echo [INFO] Backend is initializing in the background.

:ACTIVE
echo.
echo ========================================================
echo               DEPLOYMENT IS ONLINE AND ACTIVE!
echo ========================================================
echo.
echo  Access URLs:
echo   - Local PC:       http://localhost
echo   - SSL Direct:     https://127.0.0.1
echo   - CTU Domain:     https://taskdesk.ctuniversity.in
echo   - Health API:     http://localhost:5000/api/health
echo.
echo  The Backend and Nginx are detached from this IDE.
echo  Exiting the IDE will NOT affect the server.
echo  Auto-healing watchdog is active.
echo.
echo --------------------------------------------------------
echo  [1] Close this window (servers keep running in background)
echo  [2] Open live backend logs
echo  [3] Stop all servers (Nginx + Backend)
echo --------------------------------------------------------

if "%1"=="--background" goto AUTO_EXIT
if "%1"=="auto" goto AUTO_EXIT

set /p CHOICE="Enter choice (1/2/3) or press Enter to keep running: "

if "%CHOICE%"=="2" (
    start "Backend-Logs" powershell -NoProfile -Command "Get-Content -Path '%ROOT_DIR%ct-task-manager\backend\logs\supervisor.log' -Wait -Tail 25"
    exit /b 0
)
if "%CHOICE%"=="3" (
    call "%ROOT_DIR%stop-all.bat"
    exit /b 0
)

echo Servers are running detached in background.
ping 127.0.0.1 -n 3 >nul
exit /b 0

:AUTO_EXIT
echo [OK] Background mode active. Services detached successfully.
ping 127.0.0.1 -n 2 >nul
exit /b 0
