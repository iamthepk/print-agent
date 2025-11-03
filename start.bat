@echo off
chcp 65001 > nul
REM Print Agent Server - Rychly start
REM Tento skript spusti server pomoci nejlepsiho dostupneho zpusobu

echo Spoustim Print Agent Server...

REM Zkusime spustit pomoci VBS skriptu (nejtisi)
if exist "scripts\start-silent.vbs" (
    echo Pouzivam VBS silent mod...
    cscript //nologo "scripts\start-silent.vbs"
    goto :check
)

REM Pokud VBS neni dostupny, pouzijeme BAT
if exist "scripts\start-silent.bat" (
    echo Pouzivam BAT silent mod...
    call "scripts\start-silent.bat"
    goto :check
)

REM Pokud nic neni dostupny, spustime primo
echo Spoustim primo Node.js...
node server.js
goto :end

:check
timeout /t 2 /nobreak > nul
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    echo Server bezi uspesne!
    echo Dostupné na: http://localhost:8000
) else (
    echo Server se nespustil
)

:end
pause
