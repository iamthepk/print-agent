# Print Agent

Windows-only desktop print agent with a local admin UI, tray entrypoint, and
HTTP API for POS printing.

## Current scope

Implemented in this first pass:

- Electron main process with tray menu.
- React/Vite admin UI protected by an admin PIN.
- Runtime config outside the repository.
- API token generation, one-time reveal, regeneration, and scrypt hashing.
- Printer roles: `receipt`, `kitchen`, `cash_drawer`.
- Cash drawer mapped to its own selected printer.
- Local HTTP API contract:
  - `GET /health`
  - `GET /printers`
  - `GET /config`
  - `PATCH /config`
  - `POST /print-jobs`
  - `POST /test/receipt`
  - `POST /test/kitchen`
  - `POST /test/drawer`
- 24-hour local dedupe for `jobId`.
- Windows printer discovery through PowerShell.
- Isolated adapter slot for `WinSpoolerHelper.exe`.
- Simulated printer backend for UI/API testing without native printer output.
- NSIS installer configuration through `electron-builder`.

The repository does not yet include the native `WinSpoolerHelper.exe` binary.
In `Windows` backend mode, receipt jobs and ESC/POS-like printers fall back to
direct Windows RAW spooler output when the helper is missing. Other kitchen
printers fall back to Windows driver/GDI text rendering. Cash drawer tests fall
back to an ESC/POS drawer pulse. Use `Simulated` backend mode for local UI/API
tests without physical printer output.

## Runtime paths

```text
Config:
  %APPDATA%\PrintAgent\config.json

Logs:
  %LOCALAPPDATA%\PrintAgent\logs\

Runtime data:
  %LOCALAPPDATA%\PrintAgent\runtime\
```

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

## Testing

Use `Simulated` printer backend when `WinSpoolerHelper.exe` is not available.
This validates the desktop UI, API contract, token auth, drawer flow, and dedupe
without sending anything to a physical printer.

1. Open Print Agent.
2. Create or enter the admin PIN.
3. In `Connection`, set `Printer backend` to `Simulated`.
4. Click `Save`.
5. Select simulated printers for `Receipt`, `Kitchen`, and `Cash drawer`.
6. Click `Save` again.
7. Run each `Test` button.

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

Switch `Printer backend` back to `Windows` when the native helper is available.

To print a real page without the helper:

1. Make sure the printer is installed and visible in Windows.
2. Keep `Printer backend` set to `Windows`.
3. Select the installed printer for `Receipt` or `Kitchen`.
4. For label printers, select the media size that matches the roll installed in
   the printer.
5. Click `Save`.
6. Click `Test`.

The fallback prints a diagnostic page through Windows. On receipt/ESC-POS
printers it uses RAW spooler output; on other printers it renders text through
the installed Windows driver. It is useful for proving that the agent can reach
the printer, but it is not the final receipt/sticker layout.

For a direct RAW spooler test without opening the app:

```powershell
.\scripts\send-raw-printer-test.ps1 -PrinterName "EPSON TM-T20III Receipt"
.\scripts\send-raw-printer-test.ps1 -PrinterName "EPSON TM-T20III Receipt" -Mode drawer
```

For a direct Windows-driver test without opening the app:

```powershell
.\scripts\send-gdi-printer-test.ps1 -PrinterName "Brother QL-700" -PaperName "62mm x 29mm"
```

The drawer command only works when the cash drawer is physically connected to
that printer's drawer port and the printer supports the ESC/POS pulse command.

## Token auth

Sensitive HTTP endpoints accept either header:

```text
Authorization: Bearer <token>
x-print-agent-token: <token>
```

`GET /health` is public without a token and returns only minimal status. With a
valid token, it returns detailed capabilities and configured printer status.

## Example print job

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
