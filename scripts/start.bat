@echo off
chcp 65001 > nul
REM Spusteni Print Agent Server s ngrok
cd /d "%~dp0.."

echo Spoustim Print Agent Server...

REM Spustime server
start /B "" "C:\Program Files\nodejs\node.exe" server.js

REM Pockame, az se server spusti
timeout /t 3 /nobreak > nul

REM Zkontrolujeme, zda server bezi
netstat -an | findstr ":8000" > nul
if %errorlevel% equ 0 (
    echo Server bezi uspesne!
    echo.
    echo Spoustim ngrok...
    powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "scripts\start-ngrok.ps1"
) else (
    echo Server se nespustil
    pause
    exit /b 1
)

pause

