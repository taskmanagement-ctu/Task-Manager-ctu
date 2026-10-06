@echo off
title CT Task Manager - Stop Servers
echo Stopping Nginx...
cd /d "C:\Users\student\Desktop\Task-Manager\nginx"
nginx.exe -s stop >nul 2>&1
echo Stopping Node Backend...
taskkill /F /FI "WINDOWTITLE eq CT-Backend*" >nul 2>&1
echo Done.
pause
