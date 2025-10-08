Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Změníme na správný adresář
strPath = "C:\Users\team\Documents\GitHub\print-agent"
objShell.CurrentDirectory = strPath

' Spustíme server v pozadí bez zobrazení okna (0 = skryté okno)
objShell.Run "node server.js", 0, False

' Počkáme chvilku a zkontrolujeme, zda server běží
WScript.Sleep 3000

' Zkontrolujeme, zda server běží na portu 8000 nebo 8001
Set objExec = objShell.Exec("netstat -an | findstr :800")
strOutput = objExec.StdOut.ReadAll

If InStr(strOutput, ":800") > 0 Then
    ' Server běží - můžeme vytvořit log soubor pro potvrzení
    Set objFile = objFSO.CreateTextFile(strPath & "\server-status.log", True)
    objFile.WriteLine "Print Agent Server spuštěn úspěšně: " & Now()
    objFile.Close
Else
    ' Server se nespustil - vytvoříme error log
    Set objFile = objFSO.CreateTextFile(strPath & "\server-error.log", True)
    objFile.WriteLine "Chyba při spouštění Print Agent Server: " & Now()
    objFile.Close
End If
