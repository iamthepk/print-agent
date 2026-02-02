@echo off
chcp 65001 > nul
REM Print Agent Server - Rychly start (s ngrok)

REM Prejdeme do adresare, kde je tento skript
cd /d "%~dp0"

echo Spoustim Print Agent Server...

REM Spustime server
start /B "" "C:\Program Files\nodejs\node.exe" server.js

REM Cekame, az server nabinduje port 8000 (max 25 sekund, kontrola kazdou sekundu)
setlocal enabledelayedexpansion
set tries=0
:waitloop
timeout /t 1 /nobreak > nul
netstat -an | findstr ":8000" > nul
if %errorlevel% equ 0 goto serverok
set /a tries+=1
if !tries! geq 25 goto serverfailed
goto waitloop

:serverfailed
endlocal
echo Server se nespustil ani po 25 sekundach
if not "%1"=="SILENT" pause
exit /b 1

:serverok
endlocal
echo Server bezi uspesne!
echo.
echo Spoustim ngrok...
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-ngrok.ps1"

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
