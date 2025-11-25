@echo off
REM Silent spouštění Print Agent Server
REM Tento skript spustí server bez zobrazení okna

cd /d "C:\Users\team\Documents\GitHub\print-agent"

REM Spustíme Node.js v pozadí bez zobrazení okna
start /B "" "C:\Program Files\nodejs\node.exe" server.js > nul 2>&1

REM Počkáme chvilku a zkontrolujeme, zda server běží
timeout /t 2 /nobreak > nul

REM Zkontrolujeme, zda server běží na portu 8000 nebo 8001
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    echo Print Agent Server byl spuštěn úspěšně
    
    REM Spustíme ngrok na pozadí (pokud je dostupný)
    REM Použijeme PowerShell pro spuštění ngroku
    powershell -ExecutionPolicy Bypass -WindowStyle Hidden -Command "& '%~dp0start-ngrok.ps1' -Port 8000" > nul 2>&1
) else (
    echo Chyba: Print Agent Server se nespustil
    pause
)
