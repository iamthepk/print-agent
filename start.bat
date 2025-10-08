@echo off
REM Print Agent Server - Rychlý start
REM Tento skript spustí server pomocí nejlepšího dostupného způsobu

echo 🖨️ Spouštím Print Agent Server...

REM Zkusíme spustit pomocí VBS skriptu (nejtišší)
if exist "scripts\start-silent.vbs" (
    echo ✅ Používám VBS silent mód...
    cscript //nologo "scripts\start-silent.vbs"
    goto :check
)

REM Pokud VBS není dostupný, použijeme BAT
if exist "scripts\start-silent.bat" (
    echo ✅ Používám BAT silent mód...
    call "scripts\start-silent.bat"
    goto :check
)

REM Pokud nic není dostupný, spustíme přímo
echo ⚠️ Spouštím přímo Node.js...
node server.js
goto :end

:check
timeout /t 2 /nobreak > nul
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    echo ✅ Server běží úspěšně!
    echo 🌐 Dostupné na: http://localhost:8000
) else (
    echo ❌ Server se nespustil
)

:end
pause
