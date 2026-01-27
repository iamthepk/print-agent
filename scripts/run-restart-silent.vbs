' Stop + Start skrytě (bez CMD okna). Volá se z server.js při kliku na Restart.
' Nekontrolá restart.bat – ten by otevřel CMD. Děláme stop a start přímo z VBS.
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPath = objFSO.GetParentFolderName(strScriptPath)
strStopBat = strScriptPath & "\stop.bat"
strStartBat = strPath & "\start.bat"

objShell.CurrentDirectory = strPath

' 1) Zastavit server a ngrok (skrytě, výstup do nul, počkat na dokončení)
objShell.Run "cmd.exe /c """ & strStopBat & " NOPAUSE >nul 2>&1""", 0, True

' 2) Chvíli počkat, než se porty uvolní
WScript.Sleep 2000

' 3) Spustit start.bat SILENT skrytě, výstup do nul (nečekat)
objShell.Run "cmd.exe /c """ & strStartBat & " SILENT >nul 2>&1""", 0, False
