@echo off
title GitHub Actions Self-Hosted Runner - CT Task Manager
set RUNNER_DIR=C:\actions-runner

if not exist "%RUNNER_DIR%\run.cmd" (
    echo [ERROR] Runner is not installed in %RUNNER_DIR%.
    echo Run setup-github-runner.bat first to configure it.
    pause
    exit /b 1
)

echo Starting GitHub Actions Self-Hosted Runner for CT Task Manager...
cd /d "%RUNNER_DIR%"
call "%RUNNER_DIR%\run.cmd"
