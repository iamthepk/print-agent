@echo off
REM Build script for WinSpoolerHelper.exe
REM Requires .NET 6.0 SDK or later

echo ============================================
echo Building WinSpoolerHelper.exe
echo ============================================
echo.

REM Check if dotnet is available
where dotnet >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: dotnet CLI not found in PATH
    echo Please install .NET 6.0 SDK or later from:
    echo https://dotnet.microsoft.com/download
    exit /b 1
)

echo Checking .NET version...
dotnet --version
echo.

echo Building release configuration (self-contained, single-file)...
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:PublishReadyToRun=true

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo Build SUCCESS!
    echo ============================================
    echo.
    echo Output: bin\Release\net6.0\win-x64\publish\WinSpoolerHelper.exe
    echo.
    echo Copy to print agent root:
    echo copy bin\Release\net6.0\win-x64\publish\WinSpoolerHelper.exe ..\..\WinSpoolerHelper.exe
    echo.
) else (
    echo.
    echo ============================================
    echo Build FAILED!
    echo ============================================
    exit /b 1
)
