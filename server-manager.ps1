# Print Agent Server Manager
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start"
)

$ServerPath = "C:\Users\team\Documents\GitHub\print-agent"
$ServerFile = "server.js"

function Start-Server {
    Write-Host "🚀 Spouštím Print Agent Server..." -ForegroundColor Green
    Set-Location $ServerPath
    Start-Process -FilePath "node" -ArgumentList $ServerFile -WindowStyle Minimized
    Start-Sleep -Seconds 2
    Test-Server
}

function Stop-Server {
    Write-Host "🛑 Zastavuji Print Agent Server..." -ForegroundColor Red
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Test-Server {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/healthcheck" -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Server běží na http://localhost:8000" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "❌ Server neběží nebo není dostupný" -ForegroundColor Red
    }
}

function Restart-Server {
    Stop-Server
    Start-Sleep -Seconds 2
    Start-Server
}

switch ($Action) {
    "start" { Start-Server }
    "stop" { Stop-Server }
    "restart" { Restart-Server }
    "status" { Test-Server }
}

