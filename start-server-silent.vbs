Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Změníme na správný adresář
strPath = "C:\Users\team\Documents\GitHub\print-agent"
objShell.CurrentDirectory = strPath

' Spustíme server v pozadí bez zobrazení okna
objShell.Run "node server.js", 0, False
