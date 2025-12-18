@echo off
echo Starting Auto-Backup Job...
powershell -ExecutionPolicy Bypass -File "%~dp0navio_auto_backup_db.ps1"
pause