Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Získáme cestu k VBS skriptu a přejdeme do root složky projektu
strScriptPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(strScriptPath)

' Nejjednodušší řešení: spustíme start.bat skrytě (dělá to samé, ale spolehlivěji)
' Použijeme cmd.exe s /c, aby se spustil a pak zavřel
strStartBat = strPath & "\start.bat"
objShell.Run "cmd.exe /c """ & strStartBat & """", 0, False

' Vytvoříme log soubor pro potvrzení
Set objFile = objFSO.CreateTextFile(strPath & "\server-status.log", True)
objFile.WriteLine "Print Agent Server a ngrok spuštěny pomocí start.bat: " & Now()
objFile.Close

