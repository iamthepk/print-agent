# PowerShell skript pro spusteni ngroku a ziskani HTTPS URL
# Tento skript spusti ngrok tunel k lokalnimu serveru na portu 8000

param(
    [int]$Port = 8000,
    [int]$MaxRetries = 10,
    [int]$RetryDelay = 2
)

$ErrorActionPreference = "Stop"

Write-Host "Spoustim ngrok tunel..." -ForegroundColor Cyan

# Zkontrolujeme, zda ngrok je v PATH
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Host "ERROR: Ngrok nebyl nalezen v PATH. Ujistete se, ze je ngrok nainstalovan." -ForegroundColor Red
    Write-Host "INFO: Instalace: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Zkontrolujeme, zda server bezi na portu 8000
Write-Host "Kontroluji, zda server bezi na portu $Port..." -ForegroundColor Yellow
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
    Write-Host "WARNING: Server na portu $Port jeste nebezi. Spoustim ngrok i tak..." -ForegroundColor Yellow
}
else {
    Write-Host "OK: Server bezi na portu $Port" -ForegroundColor Green
}

# Zkontrolujeme, zda uz ngrok nebezi
$ngrokProcess = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "WARNING: Ngrok uz bezi. Ukoncuji stary proces..." -ForegroundColor Yellow
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Spustime ngrok na pozadi (BEZ autentizace - dulezite!)
Write-Host "Spoustim ngrok http $Port..." -ForegroundColor Cyan
$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http $Port" -WindowStyle Hidden -PassThru

if (-not $ngrokProcess) {
    Write-Host "ERROR: Nepodarilo se spustit ngrok" -ForegroundColor Red
    exit 1
}

Write-Host "Cekam na spusteni ngroku..." -ForegroundColor Yellow
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
    Write-Host ""
    Write-Host "OK: Ngrok tunel je aktivni!" -ForegroundColor Green
    Write-Host "HTTPS URL: $ngrokUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Ulozime URL do souboru
    $urlFile = Join-Path (Split-Path $PSScriptRoot -Parent) "ngrok-url.txt"
    $ngrokUrl | Out-File -FilePath $urlFile -Encoding UTF8 -NoNewline
    Write-Host "URL ulozena do: $urlFile" -ForegroundColor Gray
    
    # Zkusime zkopirovat URL do schranky (volitelne)
    try {
        Set-Clipboard -Value $ngrokUrl
        Write-Host "URL zkopirovana do schranky" -ForegroundColor Gray
    }
    catch {
        # Ignorujeme chyby pri kopirovani
    }
    
    return $ngrokUrl
}
else {
    Write-Host "WARNING: Nepodarilo se ziskat ngrok URL z API" -ForegroundColor Yellow
    Write-Host "INFO: Ngrok muze byt stale spousten. Zkuste otevrit http://127.0.0.1:4040" -ForegroundColor Yellow
    return $null
}
