@echo off
echo ========================================
echo   NAViō - Docker Desktop Startup
echo ========================================
echo.

REM Check if Docker Desktop is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [✓] Docker Desktop is running
echo.

REM Build and start containers
echo Checking database initialization...
if not exist "..\backend\mf_tracker.db" (
    echo [INFO] Creating empty database file for volume mount...
    type nul > "..\backend\mf_tracker.db"
)
echo Starting Auto-Backup Job...
start "ShijoBackup" "..\localrun\navio_start_backup_job.bat"

echo.
echo Application is starting...
echo Building and starting containers...
docker-compose up --build -d

if errorlevel 1 (
    echo [ERROR] Failed to start containers
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Containers Started Successfully!
echo ========================================
echo.
echo Local Access:
echo   Frontend: http://localhost:5174
echo   Backend:  http://localhost:8002
echo   API Docs: http://localhost:8002/docs
echo.
echo Network Access (from other devices):
for /f "tokens=*" %%a in ('powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '169.254' -and $_.IPAddress -notmatch '^172\.' } | Select-Object -ExpandProperty IPAddress"') do (
    echo   ➜  Network: http://%%a:5174
    echo   ➜  Network: http://%%a:8002
)
echo.
echo Useful Commands:
echo   View logs:    docker-compose logs -f
echo   Stop:         docker-navio_stop.bat
echo.

timeout /t 3 >nul
start http://localhost:5174

pause
