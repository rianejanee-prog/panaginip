@echo off
title Stop Server
color 0C
cls
echo ============================================
echo   Stopping Lab Inventory Server...
echo ============================================
taskkill /F /IM node.exe 2>nul
if %errorlevel%==0 (
    echo   Server stopped successfully.
) else (
    echo   No server running.
)
echo.
pause
