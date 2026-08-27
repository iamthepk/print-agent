# Optional offline prerequisite installers

The Print Agent installer runs `build/installer/install-prerequisites.ps1`
after the Electron app files are installed.

If this directory contains approved offline installers, the bootstrap script uses
them before falling back to `winget`:

- `SumatraPDF*.exe` or `Sumatra*.exe`
- `SumatraPDF*.zip` or `Sumatra*.zip`
- `iview*.exe`, `irfanview*.exe`, or `IrfanView*.exe`
- `iview*.zip`, `irfanview*.zip`, or `IrfanView*.zip`
- `ngrok*.zip` or `ngrok*.exe`

Keep license/distribution approval outside the codebase before bundling third
party installers here. If this folder only contains this README, the installer
uses `winget` to install or update SumatraPDF, IrfanView, and ngrok.
