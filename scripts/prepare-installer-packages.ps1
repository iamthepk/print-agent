#requires -version 5.1

[CmdletBinding()]
param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$packageDir = Join-Path $rootDir "build\installer\packages"
$vendorNgrokDir = Join-Path $rootDir "build\vendor\ngrok"

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

if ($Clean) {
  Get-ChildItem -LiteralPath $packageDir -File |
    Where-Object { $_.Name -ne "README.md" } |
  Remove-Item -Force
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

function Get-NgrokCliVersion {
  param([Parameter(Mandatory = $true)][string]$NgrokPath)

  try {
    $output = & $NgrokPath version 2>$null
    $match = [regex]::Match(($output -join "`n"), "\d+(\.\d+){0,3}")
    if ($match.Success) {
      return $match.Value
    }
  } catch {
    return $null
  }

  return $null
}

function Add-LocalNgrokPackage {
  $ngrokPath = Get-ExistingExecutable -Candidates @(
    "C:\ngrok\ngrok.exe",
    "ngrok.exe",
    "%ProgramFiles%\ngrok\ngrok.exe",
    "%ProgramFiles(x86)%\ngrok\ngrok.exe",
    "%LOCALAPPDATA%\ngrok\ngrok.exe",
    "%LOCALAPPDATA%\Microsoft\WinGet\Links\ngrok.exe"
  )

  if ($null -eq $ngrokPath) {
    Write-Host "No local ngrok.exe found to bundle into build/vendor."
    return
  }

  $version = Get-NgrokCliVersion -NgrokPath $ngrokPath
  if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Host "Local ngrok.exe found at $ngrokPath, but its version could not be detected."
    return
  }

  New-Item -ItemType Directory -Force -Path $vendorNgrokDir | Out-Null
  Copy-Item -LiteralPath $ngrokPath -Destination (Join-Path $vendorNgrokDir "ngrok.exe") -Force

  $tempDir = Join-Path $env:TEMP ("print-agent-ngrok-" + [guid]::NewGuid().ToString("N"))
  $zipPath = Join-Path $packageDir ("Ngrok_{0}_X64_portable_en-US.zip" -f $version)
  $yamlPath = Join-Path $packageDir ("Ngrok_{0}_X64_portable_en-US.yaml" -f $version)

  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  try {
    Copy-Item -LiteralPath $ngrokPath -Destination (Join-Path $tempDir "ngrok.exe") -Force
    Compress-Archive -LiteralPath (Join-Path $tempDir "ngrok.exe") -DestinationPath $zipPath -Force
  } finally {
    if (Test-Path -LiteralPath $tempDir) {
      Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
  }

  $sha = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest = @(
    "PackageIdentifier: Ngrok.Ngrok",
    "PackageVersion: $version",
    "Moniker: ngrok",
    "PackageLocale: en-US",
    "Publisher: ngrok, Inc.",
    "PackageName: Ngrok",
    "License: Proprietary",
    "ShortDescription: Tunnel local ports to public URLs and inspect traffic",
    "Installers:",
    "- Architecture: x64",
    "  InstallerType: zip",
    "  NestedInstallerType: portable",
    "  InstallerSha256: $sha",
    "  NestedInstallerFiles:",
    "  - RelativeFilePath: ngrok.exe",
    "    PortableCommandAlias: ngrok",
    "ManifestVersion: 1.4.0",
    "ManifestType: merged"
  )
  Set-Content -LiteralPath $yamlPath -Value $manifest -Encoding UTF8

  Write-Host "Bundled local ngrok $version from $ngrokPath"
}

$winget = Get-Command winget.exe -ErrorAction SilentlyContinue
if ($null -eq $winget) {
  throw "winget.exe is required on the build machine to prepare offline installer packages."
}

$packages = @(
  @{
    Name = "SumatraPDF"
    Id = "SumatraPDF.SumatraPDF"
    Architecture = "x64"
  },
  @{
    Name = "IrfanView"
    Id = "IrfanSkiljan.IrfanView"
    Architecture = "x64"
  },
  @{
    Name = "ngrok"
    Id = "Ngrok.Ngrok"
    Architecture = "x64"
  }
)

Write-Host "Preparing offline Print Agent prerequisite packages in $packageDir"
Write-Host "Review third-party license terms before distributing the generated installer."

foreach ($package in $packages) {
  Write-Host "Downloading $($package.Name) ($($package.Id))..."

  & $winget.Source download `
    --source winget `
    --id $package.Id `
    --exact `
    --architecture $package.Architecture `
    --download-directory $packageDir `
    --accept-source-agreements `
    --accept-package-agreements `
    --skip-dependencies `
    --disable-interactivity

  if ($LASTEXITCODE -ne 0) {
    throw "winget download failed for $($package.Id) with exit code $LASTEXITCODE."
  }
}

Add-LocalNgrokPackage

Write-Host "Downloaded installer package files:"
Get-ChildItem -LiteralPath $packageDir -File |
  Where-Object { $_.Name -ne "README.md" } |
  Sort-Object Name |
  ForEach-Object {
    Write-Host (" - {0} ({1:N0} bytes)" -f $_.Name, $_.Length)
  }
