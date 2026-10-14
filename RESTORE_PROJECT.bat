@echo off
setlocal
set BACKUP_DIR=z:\HR_PORTAL_BACKUPS\2026-01-10_Stable_DataConsolidated
set PROJECT_DIR=z:\HR PORTAL

echo ============================================================
echo !!! HR PORTAL PROJECT RESTORATION UTILITY !!!
echo ============================================================
echo This script will restore the project to the STABLE version from Jan 10.
echo Source: %BACKUP_DIR%
echo Target: %PROJECT_DIR%
echo.
echo WARNING: This will overwrite files in the project directory.
echo.
set /p confirm="Are you sure you want to proceed? (Y/N): "
if /i "%confirm%" neq "Y" goto :cancel

if not exist "%BACKUP_DIR%" (
    echo [ERROR] Backup directory not found: %BACKUP_DIR%
    goto :end
)

echo.
echo [1/2] Restoring files from backup...
robocopy "%BACKUP_DIR%" "%PROJECT_DIR%" /E /XD node_modules .git .next dist .vercel backups /R:1 /W:1

echo.
echo [2/2] Restoration complete!
echo.
echo NOTE: Run 'npm install' if dependencies were modified.
echo.
goto :end

:cancel
echo Restoration cancelled.
:end
pause
