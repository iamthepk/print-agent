@echo off
chcp 65001 > nul
REM Restart Print Agent Server a ngrok
REM Volá se z localhost (server.js) přes "start", aby přežil ukončení Node procesu.

set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo Restartuji Print Agent Server a ngrok...

REM Zastavime server a ngrok (zabije i Node, který nás spustil - my už běžíme samostatně)
call "%~dp0stop.bat" NOPAUSE

REM Pockame, az se porty uvolni
timeout /t 2 /nobreak > nul

REM Spustime start.bat skryte (bez CMD okna) pres VBS
wscript "%~dp0run-start-silent.vbs"

