@echo off
REM Odstranění Print Agent Server Windows služby
REM Tento skript odebere Windows službu

echo Odebírám Print Agent Server Windows službu...

REM Zkontrolujeme, zda máme oprávnění správce
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Chyba: Tento skript musí být spuštěn jako správce
    echo Klikněte pravým tlačítkem na soubor a vyberte "Spustit jako správce"
    pause
    exit /b 1
)

REM Zastavíme službu
echo Zastavuji službu...
sc stop "PrintAgentService" > nul 2>&1

REM Počkáme chvilku
timeout /t 3 /nobreak > nul

REM Odebereme službu
echo Odebírám službu...
sc delete "PrintAgentService"

if %errorlevel% equ 0 (
    echo Print Agent Service byl úspěšně odebrán
) else (
    echo Chyba při odebírání služby
)

pause
