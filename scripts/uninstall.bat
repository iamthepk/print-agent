@echo off
chcp 65001 > nul
REM Odstraneni Print Agent Server Windows sluzby

echo Odebíram Print Agent Server Windows sluzbu...

REM Zkontrolujeme, zda mame opravneni spravce
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Chyba: Tento skript musi byt spusten jako spravce
    echo Kliknete pravym tlacitkem na soubor a vyberte "Spustit jako spravce"
    pause
    exit /b 1
)

REM Zastavime sluzbu
echo Zastavuji sluzbu...
sc stop "PrintAgentService" > nul 2>&1

REM Pockame
timeout /t 3 /nobreak > nul

REM Odebereme sluzbu
echo Odebíram sluzbu...
sc delete "PrintAgentService"

if %errorlevel% equ 0 (
    echo Print Agent Service byl uspesne odebran
) else (
    echo Chyba pri odebirani sluzby
)

pause

