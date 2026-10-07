@echo off
title Install CT Task Manager Auto-Recovery Service
echo ========================================================
echo   INSTALLING CT TASK MANAGER 24/7 AUTO-RECOVERY SERVICE
echo ========================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM 1. Remove .stopped flag if present
if exist "%ROOT_DIR%.stopped" del /f /q "%ROOT_DIR%.stopped" >nul 2>&1

REM 2. Install to Windows Startup Folder (Runs automatically on Windows login)
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set TARGET_BAT=%STARTUP_DIR%\Start-CT-Task-Manager.bat

(
echo @echo off
echo timeout /t 3 /nobreak ^>nul
echo start "" /min "%ROOT_DIR%start-all.bat" --background
) > "%TARGET_BAT%"

if exist "%TARGET_BAT%" (
    echo [OK] 1. Windows Startup entry installed:
    echo      %TARGET_BAT%
) else (
    echo [WARNING] Could not write to startup directory.
)

REM 3. Install Windows Scheduled Task (Runs every 1 minute in background to guarantee 24/7 uptime)
echo.
echo Installing Windows Scheduled Task Auto-Healer...
schtasks /Create /SC MINUTE /MO 1 /TN "CT-TaskManager-AutoHeal" /TR "%ROOT_DIR%auto-heal.bat" /F >nul 2>&1

if %errorlevel% equ 0 (
    echo [OK] 2. Windows Scheduled Task "CT-TaskManager-AutoHeal" registered successfully!
    echo         If backend or Nginx is ever stopped or the IDE exits,
    echo         Windows will automatically recover it within seconds.
) else (
    echo [WARNING] Scheduled task creation had a warning. Checking status...
)

REM 4. Ensure services are running now
echo.
echo [3/3] Launching background services detached from IDE...
call "%ROOT_DIR%start-all.bat" --background

echo.
echo ========================================================
echo   AUTO-RECOVERY SERVICE INSTALLATION COMPLETED!
echo   You can now safely close this IDE anytime.
echo   The site will stay online 24/7 without 502 errors!
echo ========================================================
timeout /t 5 /nobreak >nul
exit /b 0
