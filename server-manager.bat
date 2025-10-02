@echo off
title Print Agent Manager
echo ========================================
echo    PRINT AGENT SERVER MANAGER
echo ========================================
echo.
echo 1. Spustit server (tichy rezim)
echo 2. Zastavit server
echo 3. Restartovat server
echo 4. Zkontrolovat stav
echo 5. Zobrazit logy
echo 6. Exit
echo.
set /p choice="Vyberte moznost (1-6): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto exit

:start
echo Spoustim server v tichym rezimu...
cd /d "C:\Users\team\Documents\GitHub\print-agent"
start /B node server.js
timeout /t 2 /nobreak >nul
goto status

:stop
echo Zastavuji server...
taskkill /F /IM node.exe >nul 2>&1
echo Server zastaven.
pause
goto menu

:restart
echo Restartuji server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
cd /d "C:\Users\team\Documents\GitHub\print-agent"
start /B node server.js
timeout /t 2 /nobreak >nul
goto status

:status
echo Kontroluji stav serveru...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/healthcheck' -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host 'Server bezi na http://localhost:8000' -ForegroundColor Green } } catch { Write-Host 'Server nebezi' -ForegroundColor Red }"
pause
goto menu

:logs
echo Zobrazuji logy...
if exist "%TEMP%\print-agent.log" (
    type "%TEMP%\print-agent.log"
) else (
    echo Zadne logy nebyly nalezeny.
)
pause
goto menu

:menu
cls
goto start

:exit
echo Ukoncuji...
exit
