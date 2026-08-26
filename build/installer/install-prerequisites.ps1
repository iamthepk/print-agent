#requires -version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$logDir = Join-Path $env:LOCALAPPDATA "PrintAgent\logs"
$logPath = Join-Path $logDir "installer-prerequisites.log"
$hadWarnings = $false

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-InstallerLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO"
  )

  $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  Add-Content -Path $logPath -Value $line -Encoding UTF8
  Write-Output $line
}

function Add-Warning {
  param([Parameter(Mandatory = $true)][string]$Message)

  $script:hadWarnings = $true
  Write-InstallerLog -Level "WARN" -Message $Message
}

function Get-ExistingExecutable {
  param([Parameter(Mandatory = $true)][string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($candidate.Trim('"'))
    if (Test-Path -LiteralPath $expanded -PathType Leaf) {
      return $expanded
    }
  }

  return $null
}

function Get-ExecutableVersion {
  param([Parameter(Mandatory = $true)][string]$Path)

  try {
    $version = (Get-Item -LiteralPath $Path).VersionInfo.ProductVersion
    if ([string]::IsNullOrWhiteSpace($version)) {
      $version = (Get-Item -LiteralPath $Path).VersionInfo.FileVersion
    }
    return $version
  } catch {
    return $null
  }
}

function Get-WingetPath {
  $command = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  $windowsAppsPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"
  if (Test-Path -LiteralPath $windowsAppsPath -PathType Leaf) {
    return $windowsAppsPath
  }

  return $null
}

function Invoke-Winget {
  param(
    [Parameter(Mandatory = $true)][string]$WingetPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-InstallerLog -Message ("winget {0}" -f ($Arguments -join " "))
  $output = & $WingetPath @Arguments 2>&1
  $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }

  foreach ($line in $output) {
    if (-not [string]::IsNullOrWhiteSpace([string]$line)) {
      Write-InstallerLog -Message ("winget: {0}" -f ([string]$line).Trim())
    }
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = ($output -join "`n")
  }
}

function Invoke-BundledInstaller {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string[]]$Patterns,
    [Parameter(Mandatory = $true)][string[]]$SilentArguments
  )

  $packageDir = Join-Path $PSScriptRoot "packages"
  if (-not (Test-Path -LiteralPath $packageDir -PathType Container)) {
    return $false
  }

  foreach ($pattern in $Patterns) {
    $installer = Get-ChildItem -LiteralPath $packageDir -Filter $pattern -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($null -eq $installer) {
      continue
    }

    Write-InstallerLog -Message ("Installing {0} from bundled installer {1}" -f $DisplayName, $installer.FullName)
    $process = Start-Process -FilePath $installer.FullName -ArgumentList $SilentArguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0) {
      Add-Warning ("Bundled {0} installer exited with code {1}." -f $DisplayName, $process.ExitCode)
      return $false
    }

    return $true
  }

  return $false
}

function Ensure-WingetPackage {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string[]]$ExecutableCandidates,
    [Parameter(Mandatory = $true)][string[]]$BundledPatterns,
    [Parameter(Mandatory = $true)][string[]]$BundledSilentArguments
  )

  $existingBefore = Get-ExistingExecutable -Candidates $ExecutableCandidates
  if ($null -ne $existingBefore) {
    $version = Get-ExecutableVersion -Path $existingBefore
    Write-InstallerLog -Message ("{0} found at {1}{2}" -f $DisplayName, $existingBefore, $(if ($version) { " (version $version)" } else { "" }))
  } else {
    Write-InstallerLog -Message ("{0} was not found locally." -f $DisplayName)
  }

  $bundledInstalled = Invoke-BundledInstaller `
    -DisplayName $DisplayName `
    -Patterns $BundledPatterns `
    -SilentArguments $BundledSilentArguments

  if ($bundledInstalled) {
    $existingAfterBundle = Get-ExistingExecutable -Candidates $ExecutableCandidates
    if ($null -ne $existingAfterBundle) {
      Write-InstallerLog -Message ("{0} is ready after bundled installer." -f $DisplayName)
      return $true
    }
  }

  $wingetPath = Get-WingetPath
  if ($null -eq $wingetPath) {
    $existingAfterNoWinget = Get-ExistingExecutable -Candidates $ExecutableCandidates
    if ($null -ne $existingAfterNoWinget) {
      Add-Warning ("winget.exe was not found, so {0} could not be checked for updates. Existing installation will be used." -f $DisplayName)
      return $true
    }

    Add-Warning ("winget.exe was not found and {0} is missing." -f $DisplayName)
    return $false
  }

  [void](Invoke-Winget -WingetPath $wingetPath -Arguments @(
    "source",
    "update",
    "--name",
    "winget",
    "--disable-interactivity"
  ))

  $shouldInstall = $null -eq $existingBefore

  if ($null -ne $existingBefore) {
    $upgrade = Invoke-Winget -WingetPath $wingetPath -Arguments @(
      "upgrade",
      "--source",
      "winget",
      "--id",
      $PackageId,
      "--exact",
      "--silent",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--disable-interactivity"
    )

    if ($upgrade.Output -match "No installed package found") {
      $shouldInstall = $true
      Write-InstallerLog -Message ("{0} is installed locally, but winget does not manage it yet. Trying winget install to bring it onto the managed latest package." -f $DisplayName)
    }

    if ($upgrade.ExitCode -ne 0 -and $upgrade.Output -notmatch "No applicable update|No installed package found") {
      Add-Warning ("{0} update check finished with winget exit code {1}." -f $DisplayName, $upgrade.ExitCode)
    }
  }

  $existingAfterUpgrade = Get-ExistingExecutable -Candidates $ExecutableCandidates
  if ($null -eq $existingAfterUpgrade -or $shouldInstall) {
    $install = Invoke-Winget -WingetPath $wingetPath -Arguments @(
      "install",
      "--source",
      "winget",
      "--id",
      $PackageId,
      "--exact",
      "--silent",
      "--accept-source-agreements",
      "--accept-package-agreements",
      "--disable-interactivity"
    )

    if ($install.ExitCode -ne 0 -and $install.Output -notmatch "already installed|No available upgrade") {
      Add-Warning ("{0} install finished with winget exit code {1}." -f $DisplayName, $install.ExitCode)
    }
  }

  $existingAfter = Get-ExistingExecutable -Candidates $ExecutableCandidates
  if ($null -ne $existingAfter) {
    $version = Get-ExecutableVersion -Path $existingAfter
    Write-InstallerLog -Message ("{0} is ready at {1}{2}" -f $DisplayName, $existingAfter, $(if ($version) { " (version $version)" } else { "" }))
    return $true
  }

  Add-Warning ("{0} is still missing after installer bootstrap." -f $DisplayName)
  return $false
}

function Test-WinSpoolerHelper {
  $candidates = @(
    (Join-Path $PSScriptRoot "..\bin\WinSpoolerHelper.exe"),
    (Join-Path $env:ProgramFiles "Print Agent\resources\bin\WinSpoolerHelper.exe")
  )

  $helper = Get-ExistingExecutable -Candidates $candidates
  if ($null -ne $helper) {
    Write-InstallerLog -Message ("WinSpoolerHelper.exe found at {0}" -f $helper)
    return
  }

  Write-InstallerLog -Message "WinSpoolerHelper.exe is not bundled. Print Agent will use the built-in Windows spooler fallback for RAW receipt and drawer commands."
}

Write-InstallerLog -Message "Starting Print Agent prerequisite setup."
Test-WinSpoolerHelper

$sumatraReady = Ensure-WingetPackage `
  -DisplayName "SumatraPDF" `
  -PackageId "SumatraPDF.SumatraPDF" `
  -ExecutableCandidates @(
    "%SUMATRA_PATH%",
    "%LOCALAPPDATA%\SumatraPDF\SumatraPDF.exe",
    "%ProgramFiles%\SumatraPDF\SumatraPDF.exe",
    "%ProgramFiles(x86)%\SumatraPDF\SumatraPDF.exe"
  ) `
  -BundledPatterns @("SumatraPDF*.exe", "Sumatra*.exe") `
  -BundledSilentArguments @("-install", "-silent")

$irfanReady = Ensure-WingetPackage `
  -DisplayName "IrfanView" `
  -PackageId "IrfanSkiljan.IrfanView" `
  -ExecutableCandidates @(
    "%IRFANVIEW_PATH%",
    "%ProgramFiles%\IrfanView\i_view64.exe",
    "%ProgramFiles%\IrfanView\i_view32.exe",
    "%ProgramFiles(x86)%\IrfanView\i_view64.exe",
    "%ProgramFiles(x86)%\IrfanView\i_view32.exe"
  ) `
  -BundledPatterns @("iview*.exe", "irfanview*.exe", "IrfanView*.exe") `
  -BundledSilentArguments @("/silent", "/desktop=0", "/thumbs=0", "/group=1", "/allusers=1")

if ($sumatraReady -and $irfanReady -and -not $hadWarnings) {
  Write-InstallerLog -Message "Print Agent prerequisite setup completed successfully."
  exit 0
}

if ($sumatraReady -and $irfanReady) {
  Write-InstallerLog -Level "WARN" -Message "Print Agent prerequisite setup completed with non-blocking warnings."
  exit 1
}

Write-InstallerLog -Level "ERROR" -Message "Print Agent prerequisite setup completed with missing required printer dependencies."
exit 2
