@echo off
chcp 65001 > nul
REM Pomocny skript pro npm restart - zastavi server a spusti ho znovu (SILENT)

REM Nejprve zastavime server (silent)
call "%~dp0stop-server.bat" NOPAUSE > nul 2>&1

REM Pockame, aby se procesy ukoncily
timeout /t 2 /nobreak > nul

REM Zkontrolujeme a pripadne ukoncime zbyvajici procesy na portu 8000/8001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 :8001" 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
)

REM Pockame jeste chvili
timeout /t 1 /nobreak > nul

REM Spustime server znovu pomoci start-silent scriptu (SILENT)
cd /d "%~dp0.."
if exist "scripts\start-silent.vbs" (
    cscript //nologo "scripts\start-silent.vbs" > nul 2>&1
) else if exist "scripts\start-silent.bat" (
    call "scripts\start-silent.bat" > nul 2>&1
) else if exist "start.bat" (
    REM Fallback na start.bat, ale bez otevreni okna
    start /B "" cmd /c "start.bat > nul 2>&1"
) else (
    REM Posledni moznost - spustime primo node bez okna
    start /B "" "C:\Program Files\nodejs\node.exe" server.js > nul 2>&1
)

