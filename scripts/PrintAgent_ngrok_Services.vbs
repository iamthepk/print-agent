Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Cesta k projektu: pokud je VBS zkopírovaný do Startup, použijeme PrintAgentProjectPath.txt
' Jinak: VBS v projektu\scripts\ -> strPath = projekt
strScriptPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPathFile = strScriptPath & "\PrintAgentProjectPath.txt"

If objFSO.FileExists(strPathFile) Then
  ' VBS je v Startup – načteme cestu k projektu ze souboru
  Set objFileIn = objFSO.OpenTextFile(strPathFile, 1)
  strPath = Trim(objFileIn.ReadLine())
  objFileIn.Close
Else
  ' VBS je v projektu\scripts\ – cesta = parent(parent(script))
  strPath = objFSO.GetParentFolderName(strScriptPath)
End If

strStartBat = strPath & "\start.bat"
If Not objFSO.FileExists(strStartBat) Then
  ' Fallback: zkusíme start.bat vedle VBS (pro staré umístění)
  strStartBat = strScriptPath & "\..\start.bat"
  strPath = objFSO.GetParentFolderName(strScriptPath)
End If

' Spustíme start.bat skrytě s parametrem SILENT (bez pause při chybě)
objShell.CurrentDirectory = strPath
objShell.Run "cmd.exe /c """ & strStartBat & """ SILENT", 0, False

' Log pro potvrzení
Set objFile = objFSO.CreateTextFile(strPath & "\server-status.log", True)
objFile.WriteLine "Print Agent Server a ngrok spuštěny (silent): " & Now()
objFile.Close

