@echo off
chcp 65001 > nul
REM Zastaveni Print Agent Server
REM Tento skript najde a ukonci pouze procesy bezici na portu 8000 nebo 8001

echo Zastavuji Print Agent Server...

REM Najdeme vsechny procesy bezici na portu 8000 nebo 8001 a ukoncime je
set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 :8001" 2^>nul') do (
    echo Nasel jsem proces s PID %%a na portu 8000/8001, ukoncuji...
    taskkill /PID %%a /F > nul 2>&1
    if !errorlevel! equ 0 set found=1
)

REM Pokud nenasli jsme zadny proces, server nebezi
if %found%==0 (
    echo Server nebezi na portu 8000/8001
    goto :check
)

REM Pockame, aby se procesy ukoncily
timeout /t 3 /nobreak > nul

:check
REM Zkontrolujeme, zda server uz nebezi
netstat -an | findstr ":8000 :8001" > nul 2>&1
if %errorlevel% equ 0 (
    echo Varovani: Nektere procesy stale bezi na portu 8000/8001
    REM Zkusime jeste jednou ukoncit zbyvajici procesy
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 :8001" 2^>nul') do (
        echo Ukoncuji zbyvajici proces s PID %%a...
        taskkill /PID %%a /F > nul 2>&1
    )
    timeout /t 1 /nobreak > nul
) else (
    if %found%==1 (
        echo Print Agent Server byl uspesne zastaven
    )
)

REM Pokud byl skript volan s parametrem NOPAUSE, nepauzujeme
if "%1"=="NOPAUSE" goto :end
pause
:end
