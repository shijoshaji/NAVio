@echo off
echo ========================================
echo   NAViō - Podman Startup
echo ========================================
echo.

REM Check if Podman is installed
podman --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Podman is not installed!
    echo Please install Podman and try again.
    echo Download: https://podman.io/getting-started/installation
    pause
    exit /b 1
)

echo [✓] Podman is installed
echo.

echo Starting Auto-Backup Job...
start "ShijoBackup" "..\localrun\navio_start_backup_job.bat"

echo.
echo Application is starting...
echo Building and starting containers...
podman-compose up --build -d

if errorlevel 1 (
    echo [WARNING] podman-compose not found, trying docker-compose with podman...
    docker-compose up --build -d
    if errorlevel 1 (
        echo [ERROR] Failed to start containers
        pause
        exit /b 1
    )
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
echo   View logs:    podman-compose logs -f
echo   Stop:         podman-navio_stop.bat
echo.

timeout /t 3 >nul
start http://localhost:5174

pause
