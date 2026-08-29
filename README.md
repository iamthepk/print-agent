# Print Agent

Windows desktop print bridge for web and cloud POS applications.

Print Agent runs on a Windows workstation with access to local printers and
exposes a small token-protected HTTP API. A browser-based POS can use that API
to print receipts, kitchen labels, and cash drawer pulses without relying on
the browser print dialog.

## Project Status

`main` contains Print Agent v2: the maintained desktop app and Windows
installer.

The original Print Agent v1 implementation is preserved only as sanitized
legacy history on the `legacy/v1-history` branch. V1 used a Node-based server
and an external ngrok startup script; new deployments should use v2.

## Features

- Electron desktop app with tray integration and a local admin UI.
- Windows login starts the agent hidden in the tray; a manual launch opens the admin UI.
- Windows NSIS installer built with `electron-builder`.
- Token-protected HTTP API for POS integrations.
- One-time API token reveal, token regeneration, and local token hashing.
- Printer roles for `receipt`, `kitchen`, and `cash_drawer`.
- Receipt printing through SumatraPDF/PDF or POS/ESC raw mode.
- Kitchen label printing through image/PDF and Windows printer fallback paths.
- Cash drawer pulse through the configured receipt/drawer printer.
- 24-hour local dedupe by `jobId`.
- Windows printer discovery through PowerShell.
- Optional ngrok tunnel management from the admin UI.
- Installer prerequisite bootstrap for SumatraPDF, IrfanView, and ngrok.
- Simulated printer backend for local UI/API testing without physical printers.

## Architecture

```text
Cloud or web POS
  -> Print Agent Remote access URL
  -> ngrok/custom tunnel if enabled
  -> local Print Agent HTTP API
  -> Windows printer backend
  -> receipt printer, kitchen printer, cash drawer
```

The POS stores only the Print Agent base URL and API token for the local
terminal/device. Printer selection, ngrok settings, runtime logs, and token
state live on the Windows workstation.

## Security Model

All HTTP endpoints require a Print Agent API token. The token can be sent with
either header:

```text
Authorization: Bearer <token>
x-print-agent-token: <token>
```

The Print Agent API token is stored locally as a hash. The ngrok authtoken is
stored locally using Electron safe storage when available. Remote tunnel URLs
can be public, but they should not be useful without the API token.

Do not commit generated tokens, ngrok authtokens, store-specific tunnel URLs, or
local config files. See [SECURITY.md](SECURITY.md) for the vulnerability
reporting policy.

## Runtime Paths

```text
Config:
  %APPDATA%\PrintAgent\config.json

Logs:
  %LOCALAPPDATA%\PrintAgent\logs\

Runtime data:
  %LOCALAPPDATA%\PrintAgent\runtime\
```

## Installer

The app is intended to be distributed as a Windows installer. Customer/register
PCs do not need Node.js, npm, a cloned repository, or source files after
installation.

The installer also checks and prepares the external tools used by Print Agent:

- SumatraPDF for PDF receipt printing and PDF fallback output.
- IrfanView for image-based kitchen label printing.
- ngrok for optional HTTPS remote access from a cloud or web POS.

If these tools are already present, the installer keeps or updates the existing
installation. If they are missing, it installs them from approved bundled
packages or from Windows Package Manager. Printer drivers are not bundled; they
must be installed separately for the specific receipt, label, or cash drawer
hardware at each location.

The installer can prepare runtime prerequisites in two modes:

1. Fully bundled: put approved SumatraPDF, IrfanView, and ngrok offline
   installers or portable archives in `build/installer/packages` before running
   `npm run dist`, or run `npm run dist:offline` to download them on the build
   machine first.
2. Online bootstrap: if `build/installer/packages` contains only the README, the
   installer falls back to `winget` on the target PC and installs or updates
   SumatraPDF, IrfanView, and ngrok from Windows Package Manager.

The installer shows prerequisite progress and writes bootstrap logs to:

```text
%LOCALAPPDATA%\PrintAgent\logs\installer-prerequisites.log
```

Printer drivers are intentionally not bundled. They depend on the actual
hardware installed at each location.

## Uninstall Behavior

The uninstaller removes the installed Print Agent application files and local
Print Agent state from local Windows user profiles, including:

- `%APPDATA%\PrintAgent`
- `%LOCALAPPDATA%\PrintAgent`
- Electron user-data folders used by Print Agent

This deletes the saved API token, ngrok settings, logs, and runtime dedupe data.
A later install starts fresh and generates a new API token. Normal upgrades that
do not uninstall first keep the existing configuration so POS connections do not
break unexpectedly.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run dist
```

`npm run dev` starts Vite and Electron. The admin UI is loaded through the
Electron preload bridge, so it is not expected to work as a standalone browser
page.

`package.json` is marked `private` intentionally to prevent accidental npm
publishing. The project is distributed as an app installer, not as an npm
package.

## Offline Installer Packages

To prepare a self-contained installer on the build machine:

```bash
npm run dist:offline
```

This downloads approved package installers/archives into
`build/installer/packages`. Those files are ignored by git. Review third-party
license and redistribution terms before sharing an installer that bundles those
packages.

## Testing

Use the `Simulated` printer backend when physical printers are unavailable. This
validates the desktop UI, API contract, token auth, drawer flow, and dedupe
without sending anything to a printer.

1. Open Print Agent.
2. In `Connection`, set `Printer backend` to `Simulated`.
3. Click `Save`.
4. Select simulated printers for `Receipt`, `Kitchen`, and `Cash drawer`.
5. Click `Save` again.
6. Run each `Test` button.

For API testing, generate or copy the API token in the admin UI and run:

```powershell
$token = "<token>"
$headers = @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Uri "http://127.0.0.1:47821/health" -Headers $headers

$body = @{
  jobId = "manual-test-001"
  tasks = @(
    @{
      role = "receipt"
      templateId = "receipt.default"
      payload = @{
        orderId = "manual-test-001"
        total = 190
      }
    },
    @{
      role = "cash_drawer"
      payload = @{
        reason = "cash_payment"
      }
    }
  )
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:47821/print-jobs" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

Run the last request a second time with the same `jobId`; it should return
`already_processed`. Change `jobId` for a manual reprint.

Switch `Printer backend` back to `Windows` for real printer output.

## Real Printer Checks

1. Make sure the printer is installed and visible in Windows.
2. Keep `Printer backend` set to `Windows`.
3. Select the installed printer for `Receipt`, `Kitchen`, or `Cash drawer`.
4. For label printers, select the media size that matches the roll installed in
   the printer.
5. Click `Save`.
6. Click `Test`.

The fallback paths can prove that the agent can reach a printer even when the
optional native helper is not bundled. Receipt/ESC-POS printers can use RAW
spooler output; other printers can render through the installed Windows driver.

For a direct RAW spooler test without opening the app:

```powershell
.\scripts\send-raw-printer-test.ps1 -PrinterName "Your Receipt Printer"
.\scripts\send-raw-printer-test.ps1 -PrinterName "Your Receipt Printer" -Mode drawer
```

For a direct Windows-driver test without opening the app:

```powershell
.\scripts\send-gdi-printer-test.ps1 -PrinterName "Your Label Printer" -PaperName "62mm x 29mm"
```

The drawer command only works when the cash drawer is physically connected to
that printer's drawer port and the printer supports the ESC/POS pulse command.

## API Contract

```text
GET   /health
GET   /printers
GET   /config
PATCH /config
POST  /print-jobs
POST  /print-job
POST  /test/receipt
POST  /test/kitchen
POST  /test/drawer
```

`/print-job` is a compatibility alias. New integrations should use
`/print-jobs`.

Example print job:

```json
{
  "jobId": "receipt-2026-08-25-0001",
  "tasks": [
    {
      "role": "receipt",
      "templateId": "receipt.default",
      "payload": {
        "orderId": "0001",
        "total": 190
      }
    },
    {
      "role": "cash_drawer",
      "payload": {
        "reason": "cash_payment"
      }
    }
  ]
}
```

Repeated automatic requests with the same `jobId` return `already_processed`.
Manual reprints should use a fresh `jobId`.

## POS Integration

Use [docs/POS_PRINT_AGENT_INTEGRATION.md](docs/POS_PRINT_AGENT_INTEGRATION.md)
as a practical guide for wiring a POS to this agent.

## License

Print Agent source code is released under the [MIT License](LICENSE).
Third-party tools, installers, fonts, and assets may have their own license or
redistribution terms.
