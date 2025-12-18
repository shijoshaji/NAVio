@echo off
echo ========================================
echo   NAViō - Podman Shutdown
echo ========================================
echo.

echo Stopping containers...
podman-compose down

if errorlevel 1 (
    echo [WARNING] podman-compose not found, trying docker-compose with podman...
    docker-compose down
    if errorlevel 1 (
        echo [ERROR] Failed to stop containers
        pause
        exit /b 1
    )
)

echo.
echo [✓] Containers stopped successfully
echo.
pause
