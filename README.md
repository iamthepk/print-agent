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
In `Windows` backend mode, receipt and kitchen jobs fall back to Windows
`Out-Printer` text printing when the helper is missing. Cash drawer pulses still
require the helper because opening the drawer needs raw printer commands. Use
`Simulated` backend mode for local UI/API tests without physical printer output.

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
4. Click `Save`.
5. Click `Test`.

The fallback prints a plain text diagnostic page through Windows. It is useful
for proving that the agent can reach the printer, but it is not the final
thermal receipt/sticker layout.

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
