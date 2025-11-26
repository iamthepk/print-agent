# PowerShell skript pro spusteni ngroku a ziskani HTTPS URL
# Tento skript spusti ngrok tunel k lokalnimu serveru na portu 8000

param(
    [int]$Port = 8000,
    [int]$MaxRetries = 10,
    [int]$RetryDelay = 2
)

$ErrorActionPreference = "Continue"

# Logovaci soubor (teď jsme v rootu, takže cesta je jednodušší)
$logFile = Join-Path $PSScriptRoot "ngrok.log"
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host $Message
}

Write-Log "Spoustim ngrok tunel..."

# Zkontrolujeme, zda ngrok je v PATH
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
$ngrokExe = "ngrok"

if (-not $ngrokPath) {
    Write-Log "WARNING: Ngrok nebyl nalezen v PATH. Zkousim najit na obvyklych mistech..."
    
    # Zkusime najit ngrok na obvyklych mistech
    $possiblePaths = @(
        "$env:ProgramFiles\ngrok\ngrok.exe",
        "$env:ProgramFiles(x86)\ngrok\ngrok.exe",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\ngrok.exe",
        "$env:USERPROFILE\AppData\Local\Microsoft\WindowsApps\ngrok.exe",
        "C:\ngrok\ngrok.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $ngrokExe = $path
            Write-Log "OK: Ngrok nalezen na: $path"
            break
        }
    }
    
    if ($ngrokExe -eq "ngrok") {
        Write-Log "ERROR: Ngrok nebyl nalezen. Ujistete se, ze je ngrok nainstalovan."
        Write-Log "INFO: Instalace: https://ngrok.com/download"
        exit 1
    }
}

# Zkontrolujeme, zda server bezi na portu 8000
Write-Log "Kontroluji, zda server bezi na portu $Port..."
$serverRunning = $false
for ($i = 0; $i -lt $MaxRetries; $i++) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($connection) {
            $serverRunning = $true
            break
        }
    }
    catch {
        # Ignorujeme chyby
    }
    if ($i -lt $MaxRetries - 1) {
        Start-Sleep -Seconds $RetryDelay
    }
}

if (-not $serverRunning) {
    Write-Log "WARNING: Server na portu $Port jeste nebezi. Spoustim ngrok i tak..."
}
else {
    Write-Log "OK: Server bezi na portu $Port"
}

# Zkontrolujeme, zda uz ngrok nebezi
$ngrokProcess = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Log "WARNING: Ngrok uz bezi. Ukoncuji stary proces..."
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Spustime ngrok na pozadi (BEZ autentizace - dulezite!)
Write-Log "Spoustim ngrok http $Port..."
try {
    $ngrokProcess = Start-Process -FilePath $ngrokExe -ArgumentList "http $Port" -WindowStyle Hidden -PassThru -ErrorAction Stop
    
    if (-not $ngrokProcess) {
        Write-Log "ERROR: Nepodarilo se spustit ngrok (proces je null)"
        exit 1
    }
    
    Write-Log "OK: Ngrok proces spusten (PID: $($ngrokProcess.Id))"
}
catch {
    Write-Log "ERROR: Nepodarilo se spustit ngrok: $($_.Exception.Message)"
    exit 1
}

Write-Log "Cekam na spusteni ngroku..."
Start-Sleep -Seconds 3

# Zkusime ziskat URL z ngrok API
$ngrokUrl = $null
$apiUrl = "http://127.0.0.1:4040/api/tunnels"

for ($i = 0; $i -lt $MaxRetries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 2 -ErrorAction Stop
        $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        
        if ($httpsTunnel -and $httpsTunnel.public_url) {
            $ngrokUrl = $httpsTunnel.public_url
            break
        }
    }
    catch {
        # Ignorujeme chyby a zkusime znovu
    }
    
    if ($i -lt $MaxRetries - 1) {
        Start-Sleep -Seconds $RetryDelay
    }
}

if ($ngrokUrl) {
    Write-Log ""
    Write-Log "OK: Ngrok tunel je aktivni!"
    Write-Log "HTTPS URL: $ngrokUrl"
    Write-Log ""
    
    # Ulozime URL do souboru (teď jsme v rootu)
    $urlFile = Join-Path $PSScriptRoot "ngrok-url.txt"
    $ngrokUrl | Out-File -FilePath $urlFile -Encoding UTF8 -NoNewline
    Write-Log "URL ulozena do: $urlFile"
    
    # Zkusime zkopirovat URL do schranky (volitelne)
    try {
        Set-Clipboard -Value $ngrokUrl
        Write-Log "URL zkopirovana do schranky"
    }
    catch {
        # Ignorujeme chyby pri kopirovani
    }
    
    return $ngrokUrl
}
else {
    Write-Log "WARNING: Nepodarilo se ziskat ngrok URL z API"
    Write-Log "INFO: Ngrok muze byt stale spousten. Zkuste otevrit http://127.0.0.1:4040"
    
    # Zkontrolujeme, jestli ngrok proces stale bezi
    $ngrokRunning = Get-Process -Name ngrok -ErrorAction SilentlyContinue
    if ($ngrokRunning) {
        Write-Log "OK: Ngrok proces stale bezi (PID: $($ngrokRunning.Id))"
    }
    else {
        Write-Log "ERROR: Ngrok proces nebezi!"
    }
    
    return $null
}

