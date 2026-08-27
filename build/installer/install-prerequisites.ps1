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
  [Console]::Out.WriteLine(("[{0}] {1}" -f $Level, $Message))
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
    if ($expanded -notmatch "[\\/]" -and $expanded.EndsWith(".exe", [System.StringComparison]::OrdinalIgnoreCase)) {
      $command = Get-Command $expanded -ErrorAction SilentlyContinue
      if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
        return $command.Source
      }
    }

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

function Convert-ToComparableVersion {
  param([AllowEmptyString()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  $match = [regex]::Match($Value, "\d+(\.\d+){0,3}")
  if (-not $match.Success) {
    return $null
  }

  try {
    return [version]$match.Value
  } catch {
    return $null
  }
}

function Get-BundledPackageVersion {
  param([Parameter(Mandatory = $true)][string]$PackageId)

  $packageDir = Join-Path $PSScriptRoot "packages"
  if (-not (Test-Path -LiteralPath $packageDir -PathType Container)) {
    return $null
  }

  $yamlFiles = Get-ChildItem -LiteralPath $packageDir -Filter "*.yaml" -File -ErrorAction SilentlyContinue
  foreach ($yamlFile in $yamlFiles) {
    $content = Get-Content -LiteralPath $yamlFile.FullName -Raw
    if ($content -notmatch "(?m)^PackageIdentifier:\s*$([regex]::Escape($PackageId))\s*$") {
      continue
    }

    $versionMatch = [regex]::Match($content, "(?m)^PackageVersion:\s*(.+?)\s*$")
    if ($versionMatch.Success) {
      return $versionMatch.Groups[1].Value.Trim()
    }
  }

  return $null
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
    [AllowEmptyCollection()][string[]]$SilentArguments = @()
  )

  if ($Patterns.Count -eq 0) {
    return $false
  }

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
    $startProcessArgs = @{
      FilePath = $installer.FullName
      Wait = $true
      PassThru = $true
      WindowStyle = "Hidden"
    }

    if ($SilentArguments.Count -gt 0) {
      $startProcessArgs.ArgumentList = $SilentArguments
    }

    $process = Start-Process @startProcessArgs
    if ($process.ExitCode -ne 0) {
      Add-Warning ("Bundled {0} installer exited with code {1}." -f $DisplayName, $process.ExitCode)
      return $false
    }

    return $true
  }

  return $false
}

function Expand-BundledArchive {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string[]]$Patterns,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if ($Patterns.Count -eq 0) {
    return $false
  }

  $packageDir = Join-Path $PSScriptRoot "packages"
  if (-not (Test-Path -LiteralPath $packageDir -PathType Container)) {
    return $false
  }

  foreach ($pattern in $Patterns) {
    $archive = Get-ChildItem -LiteralPath $packageDir -Filter $pattern -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($null -eq $archive) {
      continue
    }

    Write-InstallerLog -Message ("Extracting bundled {0} archive {1} to {2}" -f $DisplayName, $archive.FullName, $Destination)
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Expand-Archive -LiteralPath $archive.FullName -DestinationPath $Destination -Force
    return $true
  }

  return $false
}

function Ensure-WingetPackage {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string[]]$ExecutableCandidates,
    [AllowEmptyCollection()][string[]]$BundledPatterns = @(),
    [AllowEmptyCollection()][string[]]$BundledSilentArguments = @(),
    [string[]]$BundledArchivePatterns = @(),
    [string]$BundledArchiveDestination = ""
  )

  Write-InstallerLog -Message ("--- Checking {0} ---" -f $DisplayName)
  $bundledVersion = Get-BundledPackageVersion -PackageId $PackageId
  $existingBefore = Get-ExistingExecutable -Candidates $ExecutableCandidates
  if ($null -ne $existingBefore) {
    $version = Get-ExecutableVersion -Path $existingBefore
    Write-InstallerLog -Message ("{0}: already installed at {1}{2}" -f $DisplayName, $existingBefore, $(if ($version) { " (version $version)" } else { "" }))

    $existingComparable = Convert-ToComparableVersion -Value $version
    $bundledComparable = Convert-ToComparableVersion -Value $bundledVersion
    if ($null -ne $bundledComparable -and $null -ne $existingComparable -and $existingComparable -ge $bundledComparable) {
      Write-InstallerLog -Message ("{0}: existing version is current for this installer package. Skipping install." -f $DisplayName)
      return $true
    }

    if ($null -ne $bundledComparable -and $null -ne $existingComparable) {
      Write-InstallerLog -Message ("{0}: existing version is older than bundled version {1}. Updating." -f $DisplayName, $bundledVersion)
    } elseif ($BundledPatterns.Count -gt 0 -or $BundledArchivePatterns.Count -gt 0) {
      Write-InstallerLog -Message ("{0}: version could not be compared. Keeping existing installation unless it fails final validation." -f $DisplayName)
      return $true
    }
  } else {
    Write-InstallerLog -Message ("{0}: not found on this PC. Installing from bundled package or winget fallback." -f $DisplayName)
  }

  if (-not [string]::IsNullOrWhiteSpace($BundledArchiveDestination)) {
    $archiveExpanded = Expand-BundledArchive `
      -DisplayName $DisplayName `
      -Patterns $BundledArchivePatterns `
      -Destination $BundledArchiveDestination

    if ($archiveExpanded) {
      $existingAfterArchive = Get-ExistingExecutable -Candidates $ExecutableCandidates
      if ($null -ne $existingAfterArchive) {
        Write-InstallerLog -Message ("{0}: installed from bundled archive." -f $DisplayName)
        return $true
      }

      Add-Warning ("Bundled {0} archive was extracted, but the expected executable was not found." -f $DisplayName)
    }
  }

  $bundledInstalled = Invoke-BundledInstaller `
    -DisplayName $DisplayName `
    -Patterns $BundledPatterns `
    -SilentArguments $BundledSilentArguments

  if ($bundledInstalled) {
    $existingAfterBundle = Get-ExistingExecutable -Candidates $ExecutableCandidates
    if ($null -ne $existingAfterBundle) {
      Write-InstallerLog -Message ("{0}: installed from bundled installer." -f $DisplayName)
      return $true
    }
  }

  $wingetPath = Get-WingetPath
  if ($null -eq $wingetPath) {
    $existingAfterNoWinget = Get-ExistingExecutable -Candidates $ExecutableCandidates
    if ($null -ne $existingAfterNoWinget) {
      Add-Warning ("{0}: winget.exe was not found, so updates could not be checked. Existing installation will be used." -f $DisplayName)
      return $true
    }

    Add-Warning ("{0}: winget.exe was not found and the tool is missing." -f $DisplayName)
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
    Write-InstallerLog -Message ("{0}: ready at {1}{2}" -f $DisplayName, $existingAfter, $(if ($version) { " (version $version)" } else { "" }))
    return $true
  }

  Add-Warning ("{0}: still missing after installer bootstrap." -f $DisplayName)
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
Write-InstallerLog -Message "Print Agent: application files are installed."
Write-InstallerLog -Message "Printer drivers: skipped intentionally; Windows printer drivers depend on the connected hardware."
Test-WinSpoolerHelper

$vendorDir = Join-Path $PSScriptRoot "..\vendor"

$sumatraReady = Ensure-WingetPackage `
  -DisplayName "SumatraPDF" `
  -PackageId "SumatraPDF.SumatraPDF" `
  -ExecutableCandidates @(
    (Join-Path $vendorDir "sumatra\SumatraPDF.exe"),
    "%SUMATRA_PATH%",
    "%LOCALAPPDATA%\SumatraPDF\SumatraPDF.exe",
    "%ProgramFiles%\SumatraPDF\SumatraPDF.exe",
    "%ProgramFiles(x86)%\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files\SumatraPDF\SumatraPDF.exe",
    "C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe"
  ) `
  -BundledPatterns @("SumatraPDF*.exe", "Sumatra*.exe") `
  -BundledSilentArguments @("-install", "-silent", "-all-users") `
  -BundledArchivePatterns @("SumatraPDF*.zip", "Sumatra*.zip") `
  -BundledArchiveDestination (Join-Path $vendorDir "sumatra")

$irfanReady = Ensure-WingetPackage `
  -DisplayName "IrfanView" `
  -PackageId "IrfanSkiljan.IrfanView" `
  -ExecutableCandidates @(
    (Join-Path $vendorDir "irfanview\i_view64.exe"),
    (Join-Path $vendorDir "irfanview\i_view32.exe"),
    "%IRFANVIEW_PATH%",
    "%ProgramFiles%\IrfanView\i_view64.exe",
    "%ProgramFiles%\IrfanView\i_view32.exe",
    "%ProgramFiles(x86)%\IrfanView\i_view64.exe",
    "%ProgramFiles(x86)%\IrfanView\i_view32.exe",
    "C:\Program Files\IrfanView\i_view64.exe",
    "C:\Program Files\IrfanView\i_view32.exe",
    "C:\Program Files (x86)\IrfanView\i_view64.exe",
    "C:\Program Files (x86)\IrfanView\i_view32.exe"
  ) `
  -BundledPatterns @("iview*.exe", "irfanview*.exe", "IrfanView*.exe") `
  -BundledSilentArguments @("/silent", "/desktop=0", "/thumbs=0", "/group=1", "/allusers=1") `
  -BundledArchivePatterns @("iview*.zip", "irfanview*.zip", "IrfanView*.zip") `
  -BundledArchiveDestination (Join-Path $vendorDir "irfanview")

$ngrokReady = Ensure-WingetPackage `
  -DisplayName "ngrok" `
  -PackageId "Ngrok.Ngrok" `
  -ExecutableCandidates @(
    (Join-Path $vendorDir "ngrok\ngrok.exe"),
    "ngrok.exe",
    "%ProgramFiles%\ngrok\ngrok.exe",
    "%ProgramFiles(x86)%\ngrok\ngrok.exe",
    "%LOCALAPPDATA%\ngrok\ngrok.exe",
    "%LOCALAPPDATA%\Microsoft\WinGet\Links\ngrok.exe"
  ) `
  -BundledPatterns @("ngrok*.exe") `
  -BundledSilentArguments @() `
  -BundledArchivePatterns @("ngrok*.zip") `
  -BundledArchiveDestination (Join-Path $vendorDir "ngrok")

if ($sumatraReady -and $irfanReady -and $ngrokReady -and -not $hadWarnings) {
  Write-InstallerLog -Message "Print Agent prerequisite setup completed successfully."
  exit 0
}

if ($sumatraReady -and $irfanReady -and $ngrokReady) {
  Write-InstallerLog -Level "WARN" -Message "Print Agent prerequisite setup completed with non-blocking warnings."
  exit 1
}

Write-InstallerLog -Level "ERROR" -Message "Print Agent prerequisite setup completed with missing required printer dependencies."
exit 2
