@echo off
chcp 65001 > nul
REM Instalace Print Agent Server jako Windows sluzba (s ngrok)

echo Instaluji Print Agent Server jako Windows sluzbu...

REM Zkontrolujeme, zda mame opravneni spravce
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Chyba: Tento skript musi byt spusten jako spravce
    echo Kliknete pravym tlacitkem na soubor a vyberte "Spustit jako spravce"
    pause
    exit /b 1
)

REM Cesta k projektu
set PROJECT_PATH=%~dp0..
set WRAPPER_SCRIPT=%PROJECT_PATH%\scripts\start-with-ngrok.bat

REM Vytvorime sluzbu
sc create "PrintAgentService" ^
    binPath= "cmd.exe /c \"%WRAPPER_SCRIPT%\"" ^
    start= auto ^
    displayname= "Print Agent Service" ^
    description= "Lokalni tiskovy agent pro POS system s ngrok"

if %errorlevel% equ 0 (
    echo Sluzba byla uspesne vytvorena
    echo Spoustim sluzbu...
    sc start "PrintAgentService"
    
    if %errorlevel% equ 0 (
        echo Print Agent Service byl uspesne spusten
        echo Sluzba se bude automaticky spoustet pri startu systemu
    ) else (
        echo Chyba pri spousteni sluzby
    )
) else (
    echo Chyba pri vytvareni sluzby
)

echo.
echo Pro zastaveni sluzby pouzijte: sc stop "PrintAgentService"
echo Pro odebrani sluzby pouzijte: scripts\uninstall.bat
pause

