# POS Print Agent Integration

This document describes how a cloud or web POS should connect to the local
Windows Print Agent.

## Overview

Print Agent exposes a local token-protected HTTP API for printing receipts,
kitchen labels, and cash drawer pulses from POS workflows. POS applications
should treat Print Agent as an external desktop service running on the Windows
workstation connected to the printers.

The POS side is responsible for:

- storing the Print Agent base URL and API token on the local POS device,
- exposing terminal/register print settings,
- sending print jobs to the Print Agent HTTP API,
- handling printer or tunnel outages without blocking checkout indefinitely.

Print Agent itself remains a separately installed Windows application.

## Supported Topology

One Print Agent installation belongs to exactly one logical POS/register. Do
not connect two concurrently active POS/registers to the same Print Agent.

A tablet or cloud POS may use the agent remotely only as the client of that
same logical register. The agent should not be used as a shared print service
for multiple active registers.

Under this one-to-one rule, `jobId` does not need a device ID component. If
multi-register sharing is introduced later, add device identity to `jobId` and
redesign isolation and deduplication rules first.

## Connection URL

Use the correct base URL for the POS deployment:

- Same Windows workstation as the POS: `http://127.0.0.1:47821`
- Cloud POS, tablet, or another device: use the Remote access URL shown in
  Print Agent

If the Remote access URL is empty, enable and configure an ngrok or custom
tunnel in Print Agent first.

## Security

The Print Agent API token is per workstation/device. Store it only in a local
device store, not in shared organization settings or backend tables. Never log
the token.

Non-sensitive per-device settings can be stored locally, such as enabled
toggles, base URL, print timing, and cash drawer behavior.

For all HTTP endpoints, send either:

```text
Authorization: Bearer <token>
x-print-agent-token: <token>
```

## Endpoints

- `GET /health`: detailed status, capabilities, and configured printer status
- `GET /printers`: available Windows printers
- `GET /config`: current Print Agent configuration
- `PATCH /config`: update Print Agent configuration
- `POST /test/receipt`: print a receipt test
- `POST /test/kitchen`: print a kitchen label test
- `POST /test/drawer`: open the configured cash drawer
- `POST /print-jobs`: submit production print jobs

Use `/print-jobs` for new POS code. `/print-job` may exist as a compatibility
alias, but it should not be used for new integrations.

## POS Settings

Add or update a printer or terminal settings panel with:

- Print Agent enabled toggle
- Base URL
- API token
- Receipt printing toggle
- Kitchen labels toggle
- Kitchen label timing selector
- Open cash drawer for cash payments toggle

Use POS-facing wording for kitchen prep labels, such as `Kitchen labels` and
`Kitchen printer`.

Kitchen label timing values:

- `on_add`: print a kitchen label when an item is added or confirmed into the
  order
- `after_payment`: print kitchen labels only after the order/payment is
  completed

Recommended settings actions:

- Test connection
- Test receipt
- Test kitchen label
- Test cash drawer

Use a 5-8 second request timeout and show actionable errors.

## Print Job Request

Submit jobs to:

```http
POST {baseUrl}/print-jobs
Content-Type: application/json
```

Example request body:

```json
{
  "jobId": "pos-<role>-<orderId>-<event>-<versionOrTimestamp>",
  "tasks": [
    {
      "role": "receipt",
      "templateId": "receipt.default",
      "copies": 1,
      "payload": {
        "orderId": "<order id>",
        "createdAt": "<ISO timestamp>",
        "items": [],
        "totals": {},
        "payments": []
      }
    },
    {
      "role": "kitchen",
      "templateId": "kitchen.default",
      "copies": 1,
      "payload": {
        "orderId": "<order id>",
        "itemId": "<line item id>",
        "productName": "<drink/item name>",
        "modifiers": [],
        "note": "",
        "createdAt": "<ISO timestamp>"
      }
    },
    {
      "role": "cash_drawer",
      "payload": {
        "reason": "cash_payment",
        "orderId": "<order id>"
      }
    }
  ]
}
```

## Trigger Rules

- Receipt: send after order/payment completion only when receipt printing is
  enabled or the operator explicitly requests a receipt.
- Kitchen labels: send only for products/items that need preparation labels.
- Prefer one kitchen task/job per physical label.
- Cash drawer: send only after a cash payment is accepted and the cash drawer
  setting is enabled.
- Manual reprint/reopen actions must create a fresh `jobId`.

## Deduplication

Print Agent deduplicates automatic jobs by `jobId` plus normalized request
content for roughly 24 hours.

An exact retry of the same job returns `already_processed`. If the POS reuses a
`jobId` for a different operation, such as sending a receipt in one request and
a cash drawer pulse in another, Print Agent accepts the distinct request for
compatibility and logs an integration warning.

If the response status is `already_processed`, do not retry automatically and
do not show it as a failure.

## Error Handling

- `401 bad_token`: show that the Print Agent token is invalid or missing.
- `failed` or `invalid_request`: show a non-blocking print warning with a
  manual retry/reprint action.
- Network timeout/offline: surface that Print Agent is unavailable, but do not
  block checkout indefinitely.
- Cash drawer and receipt printing should not use silent retry loops.

## TypeScript Helper

```typescript
async function sendPrintAgentJob(baseUrl: string, token: string, job: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/print-jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(job),
      signal: controller.signal
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.message || `Print Agent request failed with HTTP ${response.status}`);
    }

    return body;
  } finally {
    window.clearTimeout(timeout);
  }
}
```

## Validation Checklist

- One Print Agent is assigned to one logical POS/register and is not shared by
  multiple concurrently active registers.
- Operator can save Base URL and token on a single POS device.
- Test connection displays Print Agent health.
- Test receipt prints on the configured receipt printer.
- Test kitchen label prints on the configured kitchen printer.
- Test cash drawer opens the configured drawer.
- A cash order opens the drawer exactly once.
- Duplicate automatic order submission with the same `jobId` and same payload
  returns `already_processed` and does not reprint.
- Reusing a `jobId` with different tasks or payload is logged as an integration
  warning.
- Manual reprint uses a fresh `jobId`.
- POS checkout still completes when Print Agent is offline.
- API token is not logged and is not synced to shared backend storage.
