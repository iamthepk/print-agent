#requires -version 5.1

[CmdletBinding()]
param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$packageDir = Join-Path $rootDir "build\installer\packages"

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

if ($Clean) {
  Get-ChildItem -LiteralPath $packageDir -File |
    Where-Object { $_.Name -ne "README.md" } |
    Remove-Item -Force
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

Write-Host "Downloaded installer package files:"
Get-ChildItem -LiteralPath $packageDir -File |
  Where-Object { $_.Name -ne "README.md" } |
  Sort-Object Name |
  ForEach-Object {
    Write-Host (" - {0} ({1:N0} bytes)" -f $_.Name, $_.Length)
  }
