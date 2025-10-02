@echo off
echo Vytvarim Windows sluzbu pro Print Agent...

REM Instalace služby
sc create "PrintAgent" binPath= "C:\Users\team\Documents\GitHub\print-agent\start-server.bat" start= auto
sc description "PrintAgent" "Print Agent Server pro pokladni zasuvku"

REM Spuštění služby
sc start "PrintAgent"

echo Sluzba byla vytvorena a spustena!
echo Pro zastaveni: sc stop PrintAgent
echo Pro smazani: sc delete PrintAgent
pause

