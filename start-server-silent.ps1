# Silent Print Agent Server Starter
$ServerPath = "C:\Users\team\Documents\GitHub\print-agent"
$LogFile = "$env:TEMP\print-agent.log"

# Změníme na správný adresář
Set-Location $ServerPath

# Spustíme server v pozadí a přesměrujeme výstup do log souboru
$ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
$ProcessInfo.FileName = "node"
$ProcessInfo.Arguments = "server.js"
$ProcessInfo.WorkingDirectory = $ServerPath
$ProcessInfo.UseShellExecute = $false
$ProcessInfo.RedirectStandardOutput = $true
$ProcessInfo.RedirectStandardError = $true
$ProcessInfo.CreateNoWindow = $true

$Process = New-Object System.Diagnostics.Process
$Process.StartInfo = $ProcessInfo
$Process.Start() | Out-Null

# Uložíme PID pro pozdější správu
$Process.Id | Out-File -FilePath "$env:TEMP\print-agent.pid" -Encoding ASCII

# Přesměrujeme výstup do log souboru
$Process.BeginOutputReadLine()
$Process.BeginErrorReadLine()

# Přidáme event handlery pro logování
$Process.add_OutputDataReceived({
        if ($EventArgs.Data) {
            "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $($EventArgs.Data)" | Add-Content -Path $LogFile
        }
    })

$Process.add_ErrorDataReceived({
        if ($EventArgs.Data) {
            "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): ERROR: $($EventArgs.Data)" | Add-Content -Path $LogFile
        }
    })
