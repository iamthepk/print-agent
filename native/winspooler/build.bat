@echo off
REM Build script for WinSpoolerHelper.exe (single-file, no DLL)
REM Requires .NET 10.0 SDK (or edit WinSpoolerHelper.csproj for net8.0)

cd /d "%~dp0"

echo ============================================
echo Building WinSpoolerHelper.exe (single-file)
echo ============================================
echo.

where dotnet >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: dotnet CLI not found in PATH
    echo Install .NET SDK from https://dotnet.microsoft.com/download
    exit /b 1
)

dotnet --version
echo.

echo Publishing: self-contained, single-file (no DLL)...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=false -p:IncludeNativeLibrariesForSelfExtract=true

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Build FAILED!
    exit /b 1
)

set "OUT=bin\Release\net10.0\win-x64\publish\WinSpoolerHelper.exe"
if not exist "%OUT%" (
    echo ERROR: Output not found at %OUT%
    exit /b 1
)

echo.
echo Copying to print-agent root...
copy /Y "%OUT%" "..\..\WinSpoolerHelper.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS: WinSpoolerHelper.exe updated in project root. No DLL required.
) else (
    echo Copy failed. Manually: copy "%OUT%" "..\..\WinSpoolerHelper.exe"
)
