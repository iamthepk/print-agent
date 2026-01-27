# Vytvoří zkratku Print Agent do složky Po spuštění (Startup)
# Volá se z install-startup.bat nebo přímo: .\install-startup.ps1

$ErrorActionPreference = 'Stop'
$ProjectRoot = if ($args[0]) { $args[0] } else { (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$VbsPath = Join-Path $ProjectRoot 'scripts\PrintAgent_ngrok_Services.vbs'

if (-not (Test-Path $VbsPath)) {
    Write-Host "CHYBA: Soubor nenalezen: $VbsPath" -ForegroundColor Red
    exit 1
}

$startupPath = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupPath 'Print Agent.lnk'

$sh = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$sh.TargetPath = $VbsPath
$sh.WorkingDirectory = $ProjectRoot
$sh.Save()

Write-Host 'Zkratka vytvorena v Po spusteni (Startup).' -ForegroundColor Green
Write-Host "Cesta: $startupPath"
