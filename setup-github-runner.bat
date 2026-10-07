@echo off
title Setup GitHub Self-Hosted Runner - CT Task Manager
echo ========================================================
echo       GITHUB SELF-HOSTED RUNNER CONFIGURATION
echo       Repository: taskmanagement-ctu/Task-Manager-ctu
echo ========================================================
echo.

set RUNNER_DIR=C:\actions-runner
set REPO_URL=https://github.com/taskmanagement-ctu/Task-Manager-ctu

if not exist "%RUNNER_DIR%" (
    mkdir "%RUNNER_DIR%"
)

cd /d "%RUNNER_DIR%"

if not exist "%RUNNER_DIR%\config.cmd" (
    echo [ERROR] Runner binaries not found in %RUNNER_DIR%.
    pause
    exit /b 1
)

echo [1/2] Preparing Runner Registration...
echo.
echo To get a Registration Token:
echo  1. Open your browser and go to:
echo     %REPO_URL%/settings/actions/runners/new
echo  2. Copy the token string shown after '--token'
echo.

set TOKEN=%1
if "%TOKEN%"=="" (
    set /p TOKEN="Enter your GitHub Runner Registration Token: "
)

if "%TOKEN%"=="" (
    echo [ERROR] Token cannot be empty.
    pause
    exit /b 1
)

echo.
echo [2/2] Registering runner to repository...
call "%RUNNER_DIR%\config.cmd" --url %REPO_URL% --token %TOKEN% --name "CTU-Local-Server" --labels "self-hosted,windows,x64" --work "_work" --unattended --replace

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Runner registration failed.
    echo Please verify that the token is valid (tokens expire after 1 hour).
    pause
    exit /b 1
)

echo.
echo ========================================================
echo        RUNNER CONFIGURED SUCCESSFULLY!
echo ========================================================
echo.
echo Starting GitHub Actions Runner in the background...
start "CTU-GitHub-Runner" /min cmd /c "cd /d C:\actions-runner && run.cmd"

echo.
echo The runner is now active and listening for jobs!
echo Whenever changes are pushed to 'main', GitHub Actions will
echo automatically execute .github/workflows/deploy.yml
echo to pull commits, rebuild, and reload the server.
echo.
pause
