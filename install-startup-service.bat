@echo off
title Install CT Task Manager Windows Auto-Startup
echo Installing CT Task Manager to Windows Startup...

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set TARGET_BAT=%STARTUP_DIR%\Start-CT-Task-Manager.bat

(
echo @echo off
echo timeout /t 5 /nobreak ^>nul
echo start "" /min "C:\Users\student\Desktop\Task-Manager-ctu\start-all.bat" --background
) > "%TARGET_BAT%"

if exist "%TARGET_BAT%" (
    echo [OK] Successfully installed auto-start entry in:
    echo      %TARGET_BAT%
    echo The system will now automatically boot and run on every Windows restart.
) else (
    echo [ERROR] Could not write to startup directory.
)
timeout /t 3 /nobreak >nul
