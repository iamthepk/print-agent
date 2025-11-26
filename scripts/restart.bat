@echo off
chcp 65001 > nul
REM Restart Print Agent Server a ngrok

echo Restartuji Print Agent Server a ngrok...

REM Zastavime
call "%~dp0stop.bat" NOPAUSE

REM Pockame
timeout /t 2 /nobreak > nul

REM Spustime znovu (start.bat je v root slozce)
call "%~dp0..\start.bat"

