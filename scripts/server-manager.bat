@echo off
REM Print Agent Server Manager
REM Tento skript umožňuje snadné spouštění, zastavování a kontrolu stavu serveru

:menu
cls
echo ========================================
echo    Print Agent Server Manager
echo ========================================
echo.
echo 1. Spustit server (silent)
echo 2. Zastavit server
echo 3. Zkontrolovat stav
echo 4. Spustit server s oknem (debug)
echo 5. Instalovat jako Windows službu
echo 6. Odebrat Windows službu
echo 7. Ukončit
echo.
set /p choice="Vyberte možnost (1-7): "

if "%choice%"=="1" goto start_silent
if "%choice%"=="2" goto stop_server
if "%choice%"=="3" goto check_status
if "%choice%"=="4" goto start_debug
if "%choice%"=="5" goto install_service
if "%choice%"=="6" goto uninstall_service
if "%choice%"=="7" goto exit
goto menu

:start_silent
echo Spouštím server v silent módu...
call start-silent.bat
pause
goto menu

:stop_server
echo Zastavuji server...
call stop-server.bat
pause
goto menu

:check_status
echo Kontroluji stav serveru...
netstat -an | findstr ":800" > nul
if %errorlevel% equ 0 (
    echo ✅ Server běží
    netstat -an | findstr ":800"
) else (
    echo ❌ Server neběží
)
pause
goto menu

:start_debug
echo Spouštím server s oknem pro debug...
cd /d "C:\Users\team\Documents\GitHub\print-agent"
start "Print Agent Server" "C:\Program Files\nodejs\node.exe" server.js
echo Server spuštěn v novém okně
pause
goto menu

:install_service
echo Instaluji Windows službu...
call install-service.bat
pause
goto menu

:uninstall_service
echo Odebírám Windows službu...
call uninstall-service.bat
pause
goto menu

:exit
echo Ukončuji...
exit