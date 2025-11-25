@echo off
REM Wrapper skript pro spuštění Print Agent Server s ngrok
REM Tento skript se používá pro Windows službu a automatické spuštění

cd /d "%~dp0.."

REM Spustíme Node.js server
start /B "" "C:\Program Files\nodejs\node.exe" server.js

REM Počkáme, až se server spustí
timeout /t 5 /nobreak > nul

REM Zkontrolujeme, zda server běží
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    REM Server běží - spustíme ngrok na pozadí
    REM Použijeme start s /B pro spuštění na pozadí
    start /B "" powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-ngrok.ps1" -Port 8000
)

REM Pro Windows službu musí skript běžet - použijeme nekonečnou smyčku
REM Služba bude držet tento proces běžící
:keepalive
timeout /t 30 /nobreak > nul
REM Zkontrolujeme, zda server stále běží
netstat -an | findstr ":800" > nul
if %errorlevel% neq 0 (
    REM Server se zastavil - ukončíme službu
    exit /b 1
)
goto keepalive

