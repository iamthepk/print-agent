# Native helper slot

The production build is expected to include `WinSpoolerHelper.exe` in this
directory. The TypeScript Windows printer adapter already looks for that helper
in the packaged Electron resources first, then in this development directory.

Until the helper binary is added, the Windows adapter falls back to its built-in
PowerShell/C# bridge for RAW receipt printing and cash drawer pulses. Kitchen
labels and PDF receipts use the installed Windows printer driver through
IrfanView/SumatraPDF where possible.
