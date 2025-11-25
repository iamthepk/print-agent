# PowerShell skript pro spuštění ngroku a získání HTTPS URL
# Tento skript spustí ngrok tunel k lokálnímu serveru na portu 8000

param(
    [int]$Port = 8000,
    [int]$MaxRetries = 10,
    [int]$RetryDelay = 2
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Spouštím ngrok tunel..." -ForegroundColor Cyan

# Zkontrolujeme, zda ngrok je v PATH
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokPath) {
    Write-Host "❌ Ngrok nebyl nalezen v PATH. Ujistěte se, že je ngrok nainstalován." -ForegroundColor Red
    Write-Host "💡 Instalace: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

# Zkontrolujeme, zda server běží na portu 8000
Write-Host "🔍 Kontroluji, zda server běží na portu $Port..." -ForegroundColor Yellow
$serverRunning = $false
for ($i = 0; $i -lt $MaxRetries; $i++) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($connection) {
            $serverRunning = $true
            break
        }
    } catch {
        # Ignorujeme chyby
    }
    if ($i -lt $MaxRetries - 1) {
        Start-Sleep -Seconds $RetryDelay
    }
}

if (-not $serverRunning) {
    Write-Host "⚠️ Server na portu $Port ještě neběží. Spouštím ngrok i tak..." -ForegroundColor Yellow
} else {
    Write-Host "✅ Server běží na portu $Port" -ForegroundColor Green
}

# Zkontrolujeme, zda už ngrok neběží
$ngrokProcess = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($ngrokProcess) {
    Write-Host "⚠️ Ngrok už běží. Ukončuji starý proces..." -ForegroundColor Yellow
    Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Spustíme ngrok na pozadí (BEZ autentizace - důležité!)
Write-Host "🌐 Spouštím ngrok http $Port..." -ForegroundColor Cyan
$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http $Port" -WindowStyle Hidden -PassThru

if (-not $ngrokProcess) {
    Write-Host "❌ Nepodařilo se spustit ngrok" -ForegroundColor Red
    exit 1
}

Write-Host "⏳ Čekám na spuštění ngroku..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Zkusíme získat URL z ngrok API
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
    } catch {
        # Ignorujeme chyby a zkusíme znovu
    }
    
    if ($i -lt $MaxRetries - 1) {
        Start-Sleep -Seconds $RetryDelay
    }
}

if ($ngrokUrl) {
    Write-Host ""
    Write-Host "✅ Ngrok tunel je aktivní!" -ForegroundColor Green
    Write-Host "🌐 HTTPS URL: $ngrokUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Uložíme URL do souboru
    $urlFile = Join-Path $PSScriptRoot ".." "ngrok-url.txt"
    $ngrokUrl | Out-File -FilePath $urlFile -Encoding UTF8 -NoNewline
    Write-Host "💾 URL uložena do: $urlFile" -ForegroundColor Gray
    
    # Zkusíme zkopírovat URL do schránky (volitelné)
    try {
        Set-Clipboard -Value $ngrokUrl
        Write-Host "📋 URL zkopírována do schránky" -ForegroundColor Gray
    } catch {
        # Ignorujeme chyby při kopírování
    }
    
    return $ngrokUrl
} else {
    Write-Host "⚠️ Nepodařilo se získat ngrok URL z API" -ForegroundColor Yellow
    Write-Host "💡 Ngrok může být stále spouštěn. Zkuste otevřít http://127.0.0.1:4040 pro webové rozhraní" -ForegroundColor Yellow
    return $null
}

