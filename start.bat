@echo off
chcp 65001 > nul
REM Print Agent Server - Rychly start (s ngrok)

REM Prejdeme do adresare, kde je tento skript
cd /d "%~dp0"

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
    powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-ngrok.ps1"
) else (
    echo Server se nespustil
    if not "%1"=="SILENT" pause
    exit /b 1
)

REM Pro Windows sluzbu musi skript bezet - pouzijeme nekonecnu smycku
REM Pokud je spusten manualne, uzivatel muze stisknout Ctrl+C pro ukonceni
:keepalive
timeout /t 30 /nobreak > nul
REM Zkontrolujeme, zda server stale bezi
netstat -an | findstr ":8000" > nul
if %errorlevel% neq 0 (
    REM Server se zastavil - ukoncime
    exit /b 1
)
goto keepalive
