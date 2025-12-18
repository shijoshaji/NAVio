@echo off
echo ========================================
echo   NAViō - Docker Desktop Shutdown
echo ========================================
echo.

echo Stopping containers...
docker-compose down

if errorlevel 1 (
    echo [ERROR] Failed to stop containers
    pause
    exit /b 1
)

echo.
echo [✓] Containers stopped successfully
echo.
pause
