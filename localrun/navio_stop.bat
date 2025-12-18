@echo off
echo ========================================
echo  NAViō - Stopping...
echo ========================================
echo.

REM 1. Kill the underlying processes (Server & Frontend) directly
echo Stopping processes...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

REM 2. Close the specific command prompt windows that were opened
echo Closing terminal windows...
taskkill /F /FI "WINDOWTITLE eq NAViō Backend*" /IM cmd.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq NAViō Frontend*" /IM cmd.exe /T >nul 2>&1

echo.
echo Application stopped. Closing self...
timeout /t 2 >nul
