# Print Agent v2 QA Specification

Date: 2026-08-25

This document captures the product and technical decisions from QA for the new version of Print Agent. It serves as the implementation specification for the standalone `print-agent-v2` repository.

## Goal

Create a Windows-only Print Agent as a standalone application with an installer, its own admin UI, printer selection by role, and no dependency on a source code checkout.

POS and Print Agent will remain part of one product ecosystem long term, but their installation will stay separate:

- POS runs as a web application.
- Print Agent is installed only on a Windows PC that has access to the printers and cash drawer.
- POS settings include a link to the finished Print Agent installer.

## Core Decisions

- Print Agent v2 will be developed in a separate repository/branch so the current working version is not broken.
- The first version is Windows-only.
- Print Agent will be a standalone application with an installer.
- Print Agent will have its own local admin UI panel.
- POS will not support printing through the browser print dialog.
- POS will print only through Print Agent, or it will not print at all.
- Printers are configured in the Print Agent UI, not in POS.
- POS can only enable/disable what it wants to print and read the agent status.

## Professional Product Direction

Print Agent v2 should feel like a normal desktop product application, not like a loose collection of scripts.

Recommended stack for the first version:

- Electron desktop shell,
- TypeScript across the whole project,
- React/Vite admin UI inside the Electron renderer,
- Node HTTP API in the internal application layer,
- Windows printer adapter isolated behind an interface,
- electron-builder NSIS installer for `.exe` installation.

Product principles:

- the user does not run `.bat`, `.vbs`, `.ps1`, or a terminal,
- the production application runs without a visible console,
- the tray icon is the main entry point into the UI and quick status,
- build/dev scripts may exist, but they are not part of the user flow,
- configuration, logs, and runtime data live outside the repository/source checkout,
- the app has a clear name, version, diagnostics, log export, and readable error states,
- Windows-specific printing is in a separate adapter so macOS/CUPS or another backend can be added later,
- the installer and tray UI should be first-class parts of the product, not an afterthought.

## Target Runtime Model

The current state is not a real Windows Service. Today the agent starts through a Windows Startup shortcut that calls VBS and `start.bat`.

For v2:

- Agent runs silently in the background.
- Agent starts after the user logs into Windows through desktop runtime autostart.
- Agent has an icon in the tray.
- Agent restarts automatically after a crash.
- Windows Service is not the default for now because printers, tray UI, and driver/user-session integration may be more reliable inside a logged-in user session.
- Service mode can be considered later if printer subsystem access is verified.

The tray menu must include at least:

- Open Print Agent
- Restart
- Copy remote URL
- Quit

## Installer

Installer for the first version:

- allows selecting the installation path,
- installs the agent outside the source checkout,
- bundles the required runtime files including `WinSpoolerHelper.exe`,
- creates config/log/runtime folders outside the repository,
- configures autostart after login,
- starts the agent after installation,
- adds an uninstaller,
- preserves config during upgrades,
- shows a new API token for POS integration on first launch.

Recommended locations:

```text
Install:
  C:\Program Files\Print Agent

Config:
  %APPDATA%\PrintAgent\config.json

Logs:
  %LOCALAPPDATA%\PrintAgent\logs\
```

## Print Roles

The first version will support at most these roles:

- `receipt` - one receipt printer,
- `kitchen` - one kitchen/bar/prep printer,
- `cash_drawer` - the printer through which the cash drawer pulse is sent.

Rules:

- `cash_drawer` has its own printer selection in Agent UI.
- `cash_drawer` may use the same physical printer as `receipt`, but it is not locked to it.
- Each role may be disabled/None.
- If POS wants `receipt + kitchen`, but the agent has no kitchen role configured, POS will not allow saving the configuration if the agent is available and the status can be verified.
- If the agent is offline, POS may save the settings with a warning and verify them after reconnect.

The word `sticker` will be phased out gradually:

- today's drink sticker printing is called `kitchen` in the new contract,
- POS code will gradually be migrated from sticker terminology to kitchen terminology,
- the current DB field `print_sticker` is mapped as `printKitchen` for now,
- later the DB/UI will be split into `print_kitchen` and `print_receipt`.

## POS Behavior

POS Printing Settings will contain one field for the Print Agent URL and print behavior settings.

POS configures:

- Print Agent enabled/disabled,
- receipt printing enabled/disabled,
- kitchen printing enabled/disabled,
- open drawer on cash payment enabled/disabled.

POS only displays:

- agent connected/disconnected,
- agent version,
- protocol version,
- receipt printer status,
- kitchen printer status,
- cash drawer mapping,
- warnings such as `Kitchen printer not configured`.

POS does not change:

- selection of a specific printer,
- printer roles,
- token in the agent,
- agent remote tunnel configuration.

## Status and Errors

The existing system indicators in POS remain the main quick signal. The print indicator shows the basic state:

- green: agent/printing available,
- red: agent offline, bad token, missing role, or printer error.

Error detail is shown through a toast and in Printing Settings.

Error handling rules:

- Payment/sale never gets stuck because of printing.
- When Print Agent does not work, the receipt is still saved.
- When receipt printing fails, POS shows a warning toast.
- When kitchen printing fails, POS shows a warning toast.
- When a printer reports paper out/offline/error, POS shows a warning toast and the process continues.
- Agent offline means nothing prints. There is no browser fallback.
- The receipt must be possible to find later and print through the existing reprint flow.

Print Agent UI must show live printer status:

- refresh every 10 seconds,
- refresh when POS/Agent UI is opened.

## Test Mode

For development and QA without the native helper, Agent may support an explicit test backend:

- `printerAdapterMode: "windows"` - real Windows backend,
- `printerAdapterMode: "simulated"` - simulated backend without physical printing.

Rules:

- default for production is `windows`,
- `simulated` is enabled manually in Agent UI,
- test backend returns successful receipt/kitchen/drawer results without sending anything to a printer,
- simulated mode is used to verify UI, API contract, token auth, drawer flow, and dedupe,
- real printing is verified only with `WinSpoolerHelper.exe`.

Until `WinSpoolerHelper.exe` is added, the `windows` backend may support a basic fallback:

- receipt and ESC/POS-like printers are sent through the Windows RAW spooler,
- other kitchen printers may be sent through the Windows driver/GDI as plain text,
- label printers may store the exact media format by role,
- cash drawer test may send an ESC/POS drawer pulse through the RAW spooler,
- fallback verifies that the agent can see and address a Windows printer,
- fallback is not the final thermal/sticker layout,
- drawer fallback works only if the drawer is physically connected to an ESC/POS printer or a compatible drawer port.

## Kitchen Printing

`kitchen` means general prep printing for a bar/kitchen/prep area.

Current use case:

- it is today's drink sticker,
- it prints for the given item/drink,
- the trigger remains the same as today,
- it prints when an item is added/updated according to the current POS flow.

Future use case:

- POS may later print food items or kitchen tickets,
- `kitchen` may remain the general name,
- the template can later be extended or selectable.

## Deduplication

The goal of deduplication is protection against double-clicks, retries, and duplicate requests. It is not a queue for later printing.

Rules:

- Every automatic print job has a stable `jobId`.
- The agent processes the same `jobId` with the same normalized content only once.
- If POS sends the same `jobId` and the same content again, the agent returns a status such as `already_processed`.
- If POS uses the same `jobId` for a different operation or payload, the agent processes it for compatibility and logs an integration warning.
- Manual reprint always has a new `jobId` so it prints again.
- Item update has a new `jobId` because it is a new version of kitchen printing.
- Multi-device concurrent POS is not supported in the first version.
- The first version supports one active POS device per store/location and one Print Agent.
- Dedupe history may be kept locally for the current business day or 24 hours.
- Dedupe history may be persisted to disk, but after restart it must not print anything by itself.

## Token and Pairing

Token protects all sensitive agent actions.

Rules:

- Token is generated during installation or first launch.
- Token is shown only once.
- UI clearly says the token is secret and must not be shared.
- The token stored in the agent should be a hash, not plaintext.
- POS token is entered manually.
- POS stores the token locally for the specific browser/device.
- If the token is lost, an admin generates a new token.
- After regeneration, POS stops working until the new token is entered.
- `open drawer` uses the same token as printing.

Recommended storage split:

- `localStorage`: Print Agent URL and token for the specific POS device.
- Supabase: non-sensitive preferences such as `printReceipts`, `printKitchen`, `openDrawerOnCash`.

## Remote URL and Ngrok

Ngrok remains a supported remote access option because POS may run on a tablet or another PC while printers may be connected to a server Windows PC.

Decisions:

- Ngrok/remote tunnel may remain part of the supported setup.
- There is no automatic URL sync through Supabase.
- Admin copies the remote URL from Print Agent UI.
- POS has one `Print Agent URL` field.
- After the URL and token are entered, POS performs a test connection.
- POS saves the URL only after a successful test if the agent is available.
- If the agent is offline, POS may save the settings with a warning.
- In POS UI, the URL is displayed masked, not in full.
- A regular employee must not see the full remote URL or token.
- Local Agent Admin UI has no PIN; the HTTP API remains protected by the API token.

The technical name in code should be generic:

- `remoteAccessUrl`,
- `tunnelProvider: "ngrok"`.

POS should not be tightly coupled to ngrok. It only needs to know the URL.

## Print Agent API v2

Recommended target contract:

```text
GET  /health
GET  /printers
GET  /config
PATCH /config
POST /print-jobs
POST /test/receipt
POST /test/kitchen
POST /test/drawer
```

HTTP endpoints require a token:

- `/health`,
- `/printers`,
- `/config`,
- `/print-jobs`,
- `/test/receipt`,
- `/test/kitchen`,
- `/test/drawer`,
- legacy endpoints, if they remain preserved.

`/health` with a valid token returns:

```json
{
  "status": "ok",
  "agentVersion": "0.1.0",
  "protocolVersion": "1"
}
```

Detailed status with token:

```json
{
  "status": "ok",
  "agentVersion": "0.1.0",
  "protocolVersion": "1",
  "capabilities": {
    "receipt": true,
    "kitchen": true,
    "cashDrawer": true
  },
  "printers": {
    "receipt": {
      "configured": true,
      "online": true,
      "name": "EPSON TM-T20III Receipt"
    },
    "kitchen": {
      "configured": true,
      "online": true,
      "name": "Brother QL-700"
    },
    "cashDrawer": {
      "configured": true,
      "online": true,
      "name": "EPSON TM-T20III Receipt"
    }
  }
}
```

## Templates

The first version does not support template selection in UI.

It will use:

- `receipt.default` - current receipt template, gradually cleaned of brand-specific hardcoding,
- `kitchen.default` - today's drink sticker layout, but named kitchen in the contract and UI.

Later:

- template selector in Agent UI,
- multiple receipt templates,
- multiple kitchen/ticket templates,
- more general template for food.

Brand-specific items should gradually move from the template into payload or configuration:

- logo,
- company name,
- address,
- footer texts,
- QR code,
- label/kitchen message,
- field visibility.

## Public Release and Monorepo

Repository merge should happen only after the Print Agent v2 contract is stabilized.

Recommended target monorepo shape:

```text
pos/
  apps/
    web/
    print-agent/
  packages/
    print-protocol/
    shared/
  supabase/
    migrations/
    functions/
    config.toml
  docs/
    printing.md
    print-agent.md
    deployment.md
  package.json
  vercel.json
```

Merge makes sense for:

- shared print protocol,
- unified documentation,
- GitHub Releases with the agent installer,
- POS and agent compatibility,
- public release as one product.

Merge must not mean shared installation. POS and Print Agent remain separate runtime applications.

## Implementation Order

1. Save this QA/spec document into a feature branch.
2. Add runtime config outside the repository.
3. Add print role model: `receipt`, `kitchen`, `cash_drawer`.
4. Add admin UI for printer selection and status display.
5. Add token auth and one-time token display.
6. Add/migrate endpoints to `/health`, `/printers`, `/config`, `/print-jobs`.
7. Add dedupe through `jobId`.
8. Preserve legacy endpoints temporarily if it helps gradual POS integration.
9. Update POS `printAgent.ts` to the new contract and `kitchen` terminology.
10. Update POS Printing Settings.
11. Prepare Electron shell, tray integration, and local admin UI.
12. Prepare standalone build and NSIS installer.
13. Only then handle the monorepo merge.

## Current Preserved Behavior

During v2 implementation, preserve:

- receipt is saved in POS before printing,
- printing after payment runs asynchronously,
- print error does not reverse payment or block sale,
- receipt reprint in POS remains,
- kitchen/sticker reprint in POS remains,
- cash drawer opens on cash payment if enabled in POS,
- manual open drawer button remains.

## Open Items for Later

- real Windows Service mode,
- macOS/CUPS adapter,
- AirPrint/WiFi/Bluetooth printing,
- template selector,
- multiple printers for one role,
- full multi-device support,
- cloud relay instead of a public tunnel,
- code signing for the installer.
