@echo off
REM Instalace Print Agent Server jako Windows služba
REM Tento skript vytvoří Windows službu pro automatické spouštění

echo Instaluji Print Agent Server jako Windows službu...

REM Zkontrolujeme, zda máme oprávnění správce
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Chyba: Tento skript musí být spuštěn jako správce
    echo Klikněte pravým tlačítkem na soubor a vyberte "Spustit jako správce"
    pause
    exit /b 1
)

REM Cesta k projektu
set PROJECT_PATH=C:\Users\team\Documents\GitHub\print-agent
set NODE_PATH=C:\Program Files\nodejs\node.exe
set WRAPPER_SCRIPT=%PROJECT_PATH%\scripts\start-with-ngrok.bat

REM Vytvoříme službu pomocí sc.exe
REM Použijeme wrapper skript, který spustí server i ngrok
sc create "PrintAgentService" ^
    binPath= "cmd.exe /c \"%WRAPPER_SCRIPT%\"" ^
    start= auto ^
    displayname= "Print Agent Service" ^
    description= "Lokální tiskový agent pro POS systém s ngrok"

if %errorlevel% equ 0 (
    echo Služba byla úspěšně vytvořena
    echo Spouštím službu...
    sc start "PrintAgentService"
    
    if %errorlevel% equ 0 (
        echo Print Agent Service byl úspěšně spuštěn
        echo Služba se bude automaticky spouštět při startu systému
    ) else (
        echo Chyba při spouštění služby
    )
) else (
    echo Chyba při vytváření služby
)

echo.
echo Pro zastavení služby použijte: sc stop "PrintAgentService"
echo Pro odebrání služby použijte: sc delete "PrintAgentService"
pause