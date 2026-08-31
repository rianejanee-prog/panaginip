@echo off
title Cabiao SHS Lab Inventory System
color 0B
cls
echo ============================================
echo   Cabiao SHS Lab Inventory System
echo   Starting server...
echo ============================================
echo.
cd /d "%~dp0"
node server/server.js
pause
