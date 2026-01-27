@echo off
chcp 65001 > nul
REM Vytvoří zkratku Print Agent do složky Po spuštění (Startup)
REM Spusťte z kořene projektu: scripts\install-startup.bat

cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File "%~dp0install-startup.ps1" "%CD%"

pause
