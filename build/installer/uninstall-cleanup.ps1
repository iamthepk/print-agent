$ErrorActionPreference = "Continue"

$script:failed = $false

function Write-Info {
  param([string]$Message)
  [Console]::Out.WriteLine("[INFO] $Message")
}

function Write-Warn {
  param([string]$Message)
  [Console]::Out.WriteLine("[WARN] $Message")
}

function Add-Target {
  param(
    [System.Collections.Generic.HashSet[string]]$Targets,
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return
  }

  [void]$Targets.Add($Path)
}

function Remove-TargetDirectory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Info "Not found: $Path"
    return
  }

  try {
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    Write-Info "Removing: $resolved"
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop
  } catch {
    $script:failed = $true
    Write-Warn "Could not remove '$Path': $($_.Exception.Message)"
  }
}

function Remove-StartupRegistration {
  Write-Info "Removing Print Agent startup registrations."

  try {
    & schtasks.exe /Delete /TN "Print Agent" /F *> $null
  } catch {
    Write-Warn "Could not remove Print Agent scheduled task: $($_.Exception.Message)"
  }

  $runValueNames = @(
    "PrintAgent",
    "app.printagent.desktop",
    "electron.app.Print Agent",
    "electron.app.Lootea Print Agent",
    "Print Agent"
  )
  $runKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
  )

  foreach ($runKey in $runKeys) {
    if (-not (Test-Path -LiteralPath $runKey)) {
      continue
    }

    foreach ($valueName in $runValueNames) {
      try {
        Remove-ItemProperty -LiteralPath $runKey -Name $valueName -Force -ErrorAction SilentlyContinue
      } catch {
        Write-Warn "Could not remove startup registry value '$valueName' from '$runKey': $($_.Exception.Message)"
      }
    }
  }
}

Write-Info "Starting Print Agent uninstall cleanup."
Remove-StartupRegistration

$targets = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

Add-Target $targets (Join-Path $env:APPDATA "PrintAgent")
Add-Target $targets (Join-Path $env:LOCALAPPDATA "PrintAgent")
Add-Target $targets (Join-Path $env:APPDATA "print-agent-desktop")
Add-Target $targets (Join-Path $env:LOCALAPPDATA "print-agent-desktop")
Add-Target $targets (Join-Path $env:APPDATA "Print Agent")
Add-Target $targets (Join-Path $env:LOCALAPPDATA "Print Agent")

if ($env:USERPROFILE) {
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Roaming\PrintAgent")
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Local\PrintAgent")
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Roaming\print-agent-desktop")
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Local\print-agent-desktop")
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Roaming\Print Agent")
  Add-Target $targets (Join-Path $env:USERPROFILE "AppData\Local\Print Agent")
}

$usersRoot = Join-Path $env:SystemDrive "Users"
if (Test-Path -LiteralPath $usersRoot) {
  Get-ChildItem -LiteralPath $usersRoot -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Add-Target $targets (Join-Path $_.FullName "AppData\Roaming\PrintAgent")
    Add-Target $targets (Join-Path $_.FullName "AppData\Local\PrintAgent")
    Add-Target $targets (Join-Path $_.FullName "AppData\Roaming\print-agent-desktop")
    Add-Target $targets (Join-Path $_.FullName "AppData\Local\print-agent-desktop")
    Add-Target $targets (Join-Path $_.FullName "AppData\Roaming\Print Agent")
    Add-Target $targets (Join-Path $_.FullName "AppData\Local\Print Agent")
  }
}

$targets | Sort-Object | ForEach-Object {
  Remove-TargetDirectory $_
}

if ($script:failed) {
  Write-Warn "Print Agent uninstall cleanup finished with warnings."
  exit 1
}

Write-Info "Print Agent uninstall cleanup finished."
exit 0
