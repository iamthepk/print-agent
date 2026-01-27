' Spustí start.bat SILENT skrytě (bez CMD okna). Volá se z restart.bat.
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPath = objFSO.GetParentFolderName(strScriptPath)
strStartBat = strPath & "\start.bat"

objShell.CurrentDirectory = strPath
objShell.Run "cmd.exe /c """ & strStartBat & """ SILENT", 0, False
