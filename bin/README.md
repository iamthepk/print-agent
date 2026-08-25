# Native helper slot

The production build is expected to include `WinSpoolerHelper.exe` in this
directory. The TypeScript Windows printer adapter already looks for that helper
in the packaged Electron resources first, then in this development directory.

Until the helper binary is added, print and drawer operations return the explicit
`helper_missing` error while printer discovery still works through PowerShell.
