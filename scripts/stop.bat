@echo off
chcp 65001 > nul
REM Zastaveni Print Agent Server a ngrok

echo Zastavuji Print Agent Server a ngrok...

REM Zastavime ngrok
taskkill /F /IM ngrok.exe > nul 2>&1

REM Zastavime server (procesy na portu 8000/8001)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 :8001" 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
)

timeout /t 2 /nobreak > nul

REM Zkontrolujeme
netstat -an | findstr ":8000 :8001" > nul
if %errorlevel% equ 0 (
    echo Varovani: Nektere procesy stale bezi
) else (
    echo Print Agent a ngrok byly uspesne zastaveny
)

REM Pokud byl volan s parametrem NOPAUSE, nepauzujeme
if "%1"=="NOPAUSE" (
    exit /b 0
)

pause

