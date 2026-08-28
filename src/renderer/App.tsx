import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Globe2,
  KeyRound,
  Play,
  Power,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Square
} from "lucide-react";
import type {
  AdminBootstrap,
  AdminState,
  AgentConfig,
  PrinterAdapterMode,
  ReceiptPrintMode,
  PrinterRole,
  PrinterRoleConfig,
  SystemPrinter,
  TunnelProvider
} from "../shared/protocol";
import { PRINTER_ROLES } from "../shared/protocol";

const ROLE_LABELS: Record<PrinterRole, string> = {
  receipt: "Receipt",
  kitchen: "Kitchen",
  cash_drawer: "Cash drawer"
};

const TUNNEL_LABELS: Record<TunnelProvider, string> = {
  none: "None",
  ngrok: "Ngrok",
  custom: "Custom"
};

const ADAPTER_LABELS: Record<PrinterAdapterMode, string> = {
  windows: "Windows",
  simulated: "Simulated"
};

const RECEIPT_PRINT_MODE_LABELS: Record<ReceiptPrintMode, string> = {
  pdf: "SumatraPDF (PDF)",
  escpos: "POS/ESC raw"
};

const maskUrl = (url: string | null): string => {
  if (!url) {
    return "Not set";
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/...`;
  } catch {
    return url.length > 18 ? `${url.slice(0, 12)}...${url.slice(-4)}` : url;
  }
};

const cloneConfig = (config: AgentConfig): AgentConfig => ({
  server: {
    ...config.server
  },
  remoteAccessUrl: config.remoteAccessUrl,
  tunnelProvider: config.tunnelProvider,
  printerAdapterMode: config.printerAdapterMode,
  printerRoles: {
    receipt: {
      ...config.printerRoles.receipt
    },
    kitchen: {
      ...config.printerRoles.kitchen
    },
    cash_drawer: {
      ...config.printerRoles.cash_drawer
    }
  },
  tunnel: {
    ...config.tunnel
  }
});

const TUNNEL_STATE_LABELS = {
  disabled: "Disabled",
  starting: "Starting",
  online: "Online",
  offline: "Offline",
  error: "Error"
} as const;

const STATE_REFRESH_INTERVAL_MS = 10_000;

export function App() {
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ngrokAuthTokenInput, setNgrokAuthTokenInput] = useState("");

  const dirty = useMemo(() => {
    if (!state || !draft) {
      return false;
    }
    return JSON.stringify(state.config) !== JSON.stringify(draft)
      || ngrokAuthTokenInput.trim().length > 0;
  }, [draft, ngrokAuthTokenInput, state]);

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!bootstrap) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (busy || dirty || draft?.tunnelProvider !== "ngrok") {
        return;
      }

      void loadState().catch(() => undefined);
    }, STATE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [bootstrap, busy, dirty, draft?.tunnelProvider]);

  const loadBootstrap = async () => {
    try {
      const nextBootstrap = await window.printAgent.getBootstrap();
      setBootstrap(nextBootstrap);
      setInitialToken(nextBootstrap.initialApiToken);
      await loadState();
    } catch (loadError) {
      setError(readError(loadError));
    }
  };

  const loadState = async () => {
    const nextState = await window.printAgent.getState();
    setState(nextState);
    setDraft(cloneConfig(nextState.config));
  };

  const runAction = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (success) {
        setMessage(success);
      }
    } catch (actionError) {
      setError(readError(actionError));
    } finally {
      setBusy(false);
    }
  };

  const updateRole = (role: PrinterRole, patch: Partial<PrinterRoleConfig>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const next = cloneConfig(current);
      next.printerRoles[role] = {
        ...next.printerRoles[role],
        ...patch
      };

      return next;
    });
  };

  const saveConfig = async () => {
    if (!draft) {
      return;
    }

    setBusy(true);
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const nextState = await window.printAgent.saveConfig({
        remoteAccessUrl: draft.remoteAccessUrl,
        tunnelProvider: draft.tunnelProvider,
        tunnel: {
          autostart: draft.tunnel.autostart,
          ngrokDomain: draft.tunnel.ngrokDomain,
          ...(ngrokAuthTokenInput.trim()
            ? { ngrokAuthToken: ngrokAuthTokenInput.trim() }
            : {})
        },
        printerAdapterMode: draft.printerAdapterMode,
        printerRoles: draft.printerRoles
      });
      setState(nextState);
      setDraft(cloneConfig(nextState.config));
      setNgrokAuthTokenInput("");
    } catch (saveError) {
      setError(readError(saveError));
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  const refresh = () => runAction(loadState, "Status refreshed.");

  const runTunnelAction = (action: "start" | "stop") => runAction(async () => {
    const nextState = action === "start"
      ? await window.printAgent.startTunnel()
      : await window.printAgent.stopTunnel();
    setState(nextState);
    setDraft(cloneConfig(nextState.config));
  }, action === "start" ? "Tunnel started." : "Tunnel stopped.");

  const runTest = (role: PrinterRole) => runAction(async () => {
    const result = await window.printAgent.runTest(role);
    const expectedStatus = role === "cash_drawer" ? "opened" : "printed";
    if (result.status !== expectedStatus) {
      throw new Error(result.message ?? result.errorCode ?? "Test failed.");
    }
  }, `${ROLE_LABELS[role]} test ${role === "cash_drawer" ? "opened" : "printed"}.`);

  const regenerateToken = () => runAction(async () => {
    const token = await window.printAgent.regenerateToken();
    setInitialToken(token);
  }, "New token generated.");

  if (!bootstrap) {
    return <LoadingScreen />;
  }

  if (!state || !draft) {
    return <LoadingScreen />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <h1>Print Agent</h1>
        </div>
        <div className="topbar-actions">
          <IconButton
            title={dirty ? "Save configuration" : "Configuration saved"}
            onClick={() => void saveConfig()}
            disabled={!dirty || busy}
            className={dirty ? "primary" : "saved"}
          >
            <Save size={18} />
            <span>{saving ? "Saving" : dirty ? "Save" : "Saved"}</span>
          </IconButton>
          <IconButton title="Refresh" onClick={refresh} disabled={busy}>
            <RefreshCw size={18} />
          </IconButton>
          <IconButton title="Export log" onClick={() => void runAction(async () => {
            await window.printAgent.exportLogs();
          }, "Log exported.")} disabled={busy}>
            <Download size={18} />
          </IconButton>
          <IconButton title="Restart" onClick={() => void window.printAgent.restart()}>
            <RotateCcw size={18} />
          </IconButton>
          <IconButton title="Quit" onClick={() => void window.printAgent.quit()}>
            <Power size={18} />
          </IconButton>
        </div>
      </header>

      {(message || error) && (
        <div className={`notice ${error ? "notice-error" : "notice-ok"}`} role="status">
          {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{error ?? message}</span>
        </div>
      )}

      {initialToken && (
        <section className="token-panel">
          <div>
            <div className="section-label">API token</div>
            <code>{initialToken}</code>
          </div>
          <IconButton title="Copy API token" onClick={() => void navigator.clipboard.writeText(initialToken)}>
            <Copy size={18} />
            <span>Copy</span>
          </IconButton>
        </section>
      )}

      <section className="endpoint-bar">
        <div className="endpoint-group">
          <span>Local API</span>
          <button
            className="endpoint-copy"
            title="Copy local URL"
            type="button"
            onClick={() => void navigator.clipboard.writeText(state.localUrl)}
          >
            <strong>{state.localUrl}</strong>
            <Copy size={15} />
          </button>
        </div>

        <div className="endpoint-group remote">
          <span>Remote</span>
          <strong>{maskUrl(draft.remoteAccessUrl)}</strong>
          <small>{TUNNEL_LABELS[draft.tunnelProvider]}</small>
        </div>
      </section>

      <section className="layout-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="section-label">Printers</div>
              <h2>Printer roles</h2>
            </div>
          </div>

          <div className="role-list">
            {PRINTER_ROLES.map((role) => (
              <RoleRow
                key={role}
                role={role}
                roleConfig={draft.printerRoles[role]}
                savedRoleConfig={state.config.printerRoles[role]}
                printers={state.printers}
                status={state.health.printers[role]}
                onChange={(patch) => updateRole(role, patch)}
                onTest={() => runTest(role)}
                busy={busy}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="section-label">Connection</div>
              <h2>Access</h2>
            </div>
            <IconButton title="Copy remote URL" onClick={() => void runAction(async () => {
              await window.printAgent.copyRemoteUrl();
            }, "URL copied.")}>
              <Copy size={18} />
            </IconButton>
          </div>

          <label className="field">
            <span>Printer backend</span>
            <select
              value={draft.printerAdapterMode}
              onChange={(event) => setDraft({
                ...draft,
                printerAdapterMode: event.currentTarget.value as PrinterAdapterMode
              })}
            >
              {Object.entries(ADAPTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tunnel provider</span>
            <select
              value={draft.tunnelProvider}
              onChange={(event) => setDraft({
                ...draft,
                tunnelProvider: event.currentTarget.value as TunnelProvider,
                tunnel: {
                  ...draft.tunnel,
                  autostart: event.currentTarget.value === "ngrok"
                    ? draft.tunnel.autostart
                    : false
                }
              })}
            >
              {Object.entries(TUNNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Remote access URL</span>
            <input
              value={draft.remoteAccessUrl ?? ""}
              onChange={(event) => setDraft({
                ...draft,
                remoteAccessUrl: event.currentTarget.value || null
              })}
              placeholder="https://..."
            />
          </label>

          {draft.tunnelProvider === "ngrok" && (
            <div className="tunnel-box">
              <div className="tunnel-status">
                <Globe2 size={18} />
                <div>
                  <strong className={`tunnel-state ${state.tunnel.state}`}>
                    {TUNNEL_STATE_LABELS[state.tunnel.state]}
                  </strong>
                  <span>{state.tunnel.publicUrl ?? state.tunnel.message ?? "No public URL"}</span>
                </div>
              </div>

              <label className="toggle field-toggle">
                <input
                  type="checkbox"
                  checked={draft.tunnel.autostart}
                  onChange={(event) => setDraft({
                    ...draft,
                    tunnel: {
                      ...draft.tunnel,
                      autostart: event.currentTarget.checked
                    }
                  })}
                />
                <span>Start ngrok automatically</span>
              </label>

              <label className="field">
                <span>Ngrok authtoken</span>
                <input
                  type="password"
                  value={ngrokAuthTokenInput}
                  onChange={(event) => setNgrokAuthTokenInput(event.currentTarget.value)}
                  placeholder={draft.tunnel.ngrokAuthTokenSet ? "Saved" : "Paste ngrok authtoken"}
                />
              </label>

              <label className="field">
                <span>Reserved domain</span>
                <input
                  value={draft.tunnel.ngrokDomain ?? ""}
                  onChange={(event) => setDraft({
                    ...draft,
                    tunnel: {
                      ...draft.tunnel,
                      ngrokDomain: event.currentTarget.value || null
                    }
                  })}
                  placeholder="optional: example.ngrok.dev"
                />
              </label>

              <div className="button-row">
                <IconButton
                  title="Start ngrok tunnel"
                  onClick={() => runTunnelAction("start")}
                  disabled={busy || dirty}
                >
                  <Play size={18} />
                  <span>Start tunnel</span>
                </IconButton>
                <IconButton
                  title="Stop ngrok tunnel"
                  onClick={() => runTunnelAction("stop")}
                  disabled={busy}
                >
                  <Square size={18} />
                  <span>Stop tunnel</span>
                </IconButton>
              </div>
            </div>
          )}

          <div className="button-row">
            <IconButton title="Regenerate token" onClick={regenerateToken} disabled={busy}>
              <KeyRound size={18} />
              <span>New token</span>
            </IconButton>
          </div>
        </div>
      </section>

      <footer className="app-footer">Print Agent v{bootstrap.agentVersion}</footer>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="auth-shell">
      <div className="loading-panel">
        <div className="boot-loader" aria-label="Loading">
          <span />
          <span />
          <span />
        </div>
        <div className="loading-copy">
          <strong>Starting up...</strong>
          <span>Preparing Print Agent</span>
        </div>
      </div>
    </main>
  );
}

function RoleRow(props: {
  role: PrinterRole;
  roleConfig: PrinterRoleConfig;
  savedRoleConfig: PrinterRoleConfig;
  printers: SystemPrinter[];
  status: AdminState["health"]["printers"][PrinterRole];
  onChange: (patch: Partial<PrinterRoleConfig>) => void;
  onTest: () => void;
  busy: boolean;
}) {
  const roleDirty = JSON.stringify(props.roleConfig) !== JSON.stringify(props.savedRoleConfig);
  const selectedPrinter = props.printers.find((printer) => printer.name === props.roleConfig.printerName);
  const paperSizes = selectedPrinter?.paperSizes ?? [];
  const showMediaSelect = props.role === "kitchen" && paperSizes.length > 0;
  const showReceiptModeSelect = props.role === "receipt";
  const statusTone = props.status.online === true
    ? "online"
    : props.status.online === false
      ? "offline"
      : "neutral";
  const statusText = roleDirty ? "Unsaved" : props.status.statusText;

  return (
    <div className="role-row">
      <div className="role-title">
        <div>
          <strong>{ROLE_LABELS[props.role]}</strong>
          <span className={`role-status ${roleDirty ? "neutral" : statusTone}`}>{statusText}</span>
        </div>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={props.roleConfig.enabled}
          onChange={(event) => props.onChange({ enabled: event.currentTarget.checked })}
        />
        <span>Enabled</span>
      </label>

      <div className="printer-select-stack">
        <select
          value={props.roleConfig.printerName ?? ""}
          onChange={(event) => {
            const printerName = event.currentTarget.value || null;
            const printer = props.printers.find((candidate) => candidate.name === printerName);
            props.onChange({
              printerName,
              paperName: props.role === "cash_drawer" ? null : printer?.defaultPaperName ?? null
            });
          }}
        >
          <option value="">None</option>
          {props.printers.map((printer) => (
            <option key={printer.name} value={printer.name}>
              {printer.name}{printer.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>

        {showMediaSelect && (
          <select
            aria-label={`${ROLE_LABELS[props.role]} media size`}
            title={`${ROLE_LABELS[props.role]} media size`}
            value={props.roleConfig.paperName ?? ""}
            onChange={(event) => props.onChange({ paperName: event.currentTarget.value || null })}
          >
            <option value="">Printer default</option>
            {paperSizes.map((paperSize) => (
              <option key={paperSize.name} value={paperSize.name}>
                {paperSize.name}{paperSize.isDefault ? " (driver)" : ""}
              </option>
            ))}
          </select>
        )}

        {showReceiptModeSelect && (
          <select
            aria-label="Receipt print method"
            title="Receipt print method"
            value={props.roleConfig.receiptPrintMode ?? "pdf"}
            onChange={(event) =>
              props.onChange({
                receiptPrintMode: event.currentTarget.value as ReceiptPrintMode
              })
            }
          >
            {Object.entries(RECEIPT_PRINT_MODE_LABELS).map(([mode, label]) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      <IconButton
        title={roleDirty ? `Save ${ROLE_LABELS[props.role]} changes before test` : `Test ${ROLE_LABELS[props.role]}`}
        onClick={props.onTest}
        disabled={props.busy || roleDirty}
      >
        <Printer size={18} />
        <span>Test</span>
      </IconButton>
    </div>
  );
}

function IconButton(props: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button${props.className ? ` ${props.className}` : ""}`}
      title={props.title}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
