@echo off
setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"


echo ========================================
echo  NAViō - Track.Analyze.Optimize
echo ========================================
echo.

echo Starting Auto-Backup Job...
start "ShijoBackup" "navio_start_backup_job.bat"
echo.
REM Check if virtual environment exists
if not exist "..\venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found!
    echo Please run: python -m venv ..\venv
    echo Then install dependencies: ..\venv\Scripts\pip install -r ..\backend\requirements.txt
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "..\frontend\node_modules" (
    echo ERROR: Frontend dependencies not found!
    echo.
    echo Please run navio_initial_setup.bat first to set up the application.
    echo.
    pause
    exit /b 1
)

:: Start Backend (accessible from network)
start "NAViō Backend" cmd /k "cd /d "%SCRIPT_DIR%..\backend" && ..\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8002 --reload"

:: Start Frontend (accessible from network)
start "NAViō Frontend" cmd /k "cd /d "%SCRIPT_DIR%..\frontend" && npm run dev -- --host 0.0.0.0 --port 5174"

echo Application starting...
echo.
echo Local Access:
echo   Frontend: http://localhost:5174
echo   Backend:  http://localhost:8002
echo.
echo Network Access (use your PC's IP address):
echo   Find your IP: ipconfig (look for IPv4 Address)
echo   Frontend: http://YOUR_IP:5174
echo   Backend:  http://YOUR_IP:8002
echo.
echo To stop: Close both command windows
echo.

:: Launch Browser
timeout /t 5 >nul
start http://localhost:5174

echo.
echo To stop the application, run: navio_stop.bat
echo.
