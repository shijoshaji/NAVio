@echo off
setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ========================================
echo  NAViō - Initial Setup
echo ========================================
echo.
echo This script will:
echo   1. Check Python installation
echo   2. Create Python virtual environment
echo   3. Install backend dependencies
echo   4. Check Node.js installation
echo   5. Install frontend dependencies
echo   6. Initialize database
echo.
pause

REM ========================================
REM Step 1: Check Python
REM ========================================
echo.
echo [1/6] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Please install Python 3.10 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% found

REM ========================================
REM Step 2: Create Virtual Environment
REM ========================================
echo.
echo [2/6] Creating Python virtual environment...
if exist "..\venv" (
    echo [SKIP] Virtual environment already exists
) else (
    python -m venv ..\venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created
)

REM ========================================
REM Step 3: Install Backend Dependencies
REM ========================================
echo.
echo [3/6] Installing backend dependencies...
call ..\venv\Scripts\activate.bat
pip install --upgrade pip >nul 2>&1
pip install -r ..\backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed

REM ========================================
REM Step 4: Check Node.js
REM ========================================
echo.
echo [4/6] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo.
    echo Please install Node.js 18 or higher from:
    echo https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version 2^>^&1') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM ========================================
REM Step 5: Install Frontend Dependencies
REM ========================================
echo.
echo [5/6] Installing frontend dependencies...
cd ..\frontend
if exist "node_modules" (
    echo [SKIP] Frontend dependencies already installed
) else (
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    echo [OK] Frontend dependencies installed
)
cd ..

REM ========================================
REM Step 6: Initialize Database
REM ========================================
echo.
echo [6/6] Initializing database...
if exist "backend\mf_tracker.db" (
    echo [SKIP] Database already exists
    echo.
    echo If you want to reset the database, delete backend\mf_tracker.db
) else (
    echo [INFO] Database will be created automatically on first run
    echo [OK] Database initialization ready
)

REM ========================================
REM Setup Complete
REM ========================================
echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Your NAViō application is ready to use.
echo.
echo Next Steps:
echo   1. Run navio_start.bat to start the application locally
echo   2. OR run ..\dockerization\docker-navio_start.bat to use Docker
echo   3. OR run ..\dockerization\podman-navio_start.bat to use Podman
echo.
echo First-time usage:
echo   - The app will open at http://localhost:5174
echo   - Click "Sync NAV" to download mutual fund data
echo   - Start adding funds to your watchlist
echo.
echo For network access from other devices:
echo   - Find your IP: ipconfig
echo   - Access from other devices: http://YOUR_IP:5174
echo.
pause
