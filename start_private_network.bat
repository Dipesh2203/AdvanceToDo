@echo off
setlocal
cd /d "%~dp0"

set LOG_FILE=%~dp0start_private_network.log
echo =============================================> "%LOG_FILE%"
echo [%date% %time%] Batch launch started>> "%LOG_FILE%"
echo [INFO] Working directory: %CD%

REM ===== Private network server settings =====
@REM set PORT=3000
set PORT=8080

:LOOP
:: Check if the current port is in use
netstat -ano | findstr /R /C:":%PORT% " >nul
if %errorlevel% equ 0 (
    echo Port %PORT% is occupied. Trying next port...
    set /a PORT+=1
    goto LOOP
)

echo Selected available port: %PORT%

REM ===== Reminder email settings (edit these) =====
set SMTP_HOST=smtp.gmail.com
set SMTP_PORT=587
set SMTP_SECURE=false
set SMTP_USER=dipesh.shs11@gmail.com
set SMTP_FROM=dipesh.shs11@gmail.com
set REMINDER_EMAIL_TO=dipeshkumar20141903@gmail.com
set SMTP_PASS=gjudgreclhhfgktw

if "%SMTP_PASS%"=="" (
    echo [WARN] SMTP_PASS is empty. Email reminders are disabled until you set it.
)

where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed or not available in PATH.
    echo Install Node.js from https://nodejs.org and try again.
    echo [%date% %time%] ERROR Node.js not found>> "%LOG_FILE%"
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Error: npm is not available in PATH.
    echo [%date% %time%] ERROR npm not found>> "%LOG_FILE%"
    pause
    exit /b 1
)

if not exist package.json (
    echo Error: package.json not found. Run this script from the project folder.
    echo [%date% %time%] ERROR package.json missing>> "%LOG_FILE%"
    pause
    exit /b 1
)

echo.
echo [INFO] Starting Advance Todo on private network...

echo URL (this PC): http://localhost:%PORT%
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } | Select-Object -ExpandProperty IPAddress -First 1)"') do set IP=%%i
echo.

set URL=http://%IP%:%PORT%
echo.
echo [INFO] Scan this QR code from your phone:
node -e "require('qrcode-terminal').generate('%URL%')"
echo.

echo [INFO] Running npm start...
echo [%date% %time%] Running npm start>> "%LOG_FILE%"
call npm start >> "%LOG_FILE%" 2>&1
set EXIT_CODE=%errorlevel%

echo.
echo [INFO] Server process ended with code %EXIT_CODE%.
echo [INFO] Full log: %LOG_FILE%

if not "%EXIT_CODE%"=="0" (
    echo Server exited with code %EXIT_CODE%.
    echo Check log file for details.
)

pause
endlocal
