@echo off
REM Zastavení Print Agent Server
REM Tento skript najde a ukončí všechny běžící instance Node.js serveru

echo Zastavuji Print Agent Server...

REM Najdeme všechny Node.js procesy běžící na portu 8000 nebo 8001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":800"') do (
    echo Ukončuji proces s PID %%a
    taskkill /PID %%a /F > nul 2>&1
)

REM Počkáme chvilku
timeout /t 2 /nobreak > nul

REM Zkontrolujeme, zda server už neběží
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    echo Varování: Některé procesy stále běží
) else (
    echo Print Agent Server byl úspěšně zastaven
)

pause
