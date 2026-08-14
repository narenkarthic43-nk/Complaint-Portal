@echo off
title Tiruchengode Municipal Corporation Portal Server
echo ======================================================================
echo   🏛️ Tiruchengode Municipal Corporation Portal
echo   Starting Express REST API Server & SQLite Database...
echo ======================================================================
echo.
echo 📡 Backend REST API: http://127.0.0.1:3000/api
echo 🌐 Web Portal URL:   http://127.0.0.1:3000
echo.
echo Launching Web Browser...
start "" "http://127.0.0.1:3000"
echo.
node server.js
pause
