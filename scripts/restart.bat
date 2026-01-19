@echo off
chcp 65001 > nul
REM Restart Print Agent Server a ngrok

echo Restartuji Print Agent Server a ngrok...

REM Zastavime
call "%~dp0stop.bat" NOPAUSE

REM Pockame
timeout /t 2 /nobreak > nul

REM Spustime znovu (start.bat je v root slozce)
REM Pouzijeme start /MIN pro spusteni v minimalizovanem okne (proces musi bezet nezávisle)
cd /d "%~dp0.."
start /MIN "" "%~dp0..\start.bat"

