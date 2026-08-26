import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Lock,
  LogOut,
  Power,
  Printer,
  RefreshCw,
  RotateCcw,
  Save
} from "lucide-react";
import type {
  AdminBootstrap,
  AdminState,
  AgentConfig,
  PrinterAdapterMode,
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
  }
});

export function App() {
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [initialToken, setInitialToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const authenticated = bootstrap?.authenticated === true;

  const dirty = useMemo(() => {
    if (!state || !draft) {
      return false;
    }
    return JSON.stringify(state.config) !== JSON.stringify(draft);
  }, [draft, state]);

  useEffect(() => {
    void loadBootstrap();
  }, []);

  const loadBootstrap = async () => {
    try {
      const nextBootstrap = await window.printAgent.getBootstrap();
      setBootstrap(nextBootstrap);
      if (nextBootstrap.authenticated) {
        await loadState();
      }
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

  const handleSetup = () => runAction(async () => {
    if (pin !== confirmPin) {
      throw new Error("PIN confirmation does not match.");
    }
    const result = await window.printAgent.setupPin(pin);
    setBootstrap((current) => current ? {
      ...current,
      setupRequired: false,
      authenticated: result.authenticated
    } : current);
    setInitialToken(result.initialApiToken);
    setPin("");
    setConfirmPin("");
    await loadState();
  }, "Admin PIN saved.");

  const handleLogin = () => runAction(async () => {
    const result = await window.printAgent.login(pin);
    setBootstrap((current) => current ? {
      ...current,
      authenticated: result.authenticated
    } : current);
    setPin("");
    await loadState();
  });

  const handleLogout = () => runAction(async () => {
    await window.printAgent.logout();
    setBootstrap((current) => current ? {
      ...current,
      authenticated: false
    } : current);
    setState(null);
    setDraft(null);
  });

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
        printerAdapterMode: draft.printerAdapterMode,
        printerRoles: draft.printerRoles
      });
      setState(nextState);
      setDraft(cloneConfig(nextState.config));
    } catch (saveError) {
      setError(readError(saveError));
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  const refresh = () => runAction(loadState, "Status refreshed.");

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

  if (bootstrap.setupRequired && !authenticated) {
    return (
      <AuthScreen
        title="Create admin PIN"
        icon="setup"
        pin={pin}
        confirmPin={confirmPin}
        showConfirm
        busy={busy}
        message={message}
        error={error}
        onPinChange={setPin}
        onConfirmPinChange={setConfirmPin}
        onSubmit={handleSetup}
      />
    );
  }

  if (!authenticated) {
    return (
      <AuthScreen
        title="Admin PIN"
        icon="login"
        pin={pin}
        confirmPin={confirmPin}
        busy={busy}
        message={message}
        error={error}
        onPinChange={setPin}
        onConfirmPinChange={setConfirmPin}
        onSubmit={handleLogin}
      />
    );
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
          <IconButton title="Log out" onClick={handleLogout} disabled={busy}>
            <LogOut size={18} />
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
                tunnelProvider: event.currentTarget.value as TunnelProvider
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

          <div className="button-row">
            <IconButton title="Regenerate token" onClick={regenerateToken} disabled={busy}>
              <KeyRound size={18} />
              <span>New token</span>
            </IconButton>
          </div>
        </div>
      </section>

      <footer className="app-footer">© pK v1.0</footer>
    </main>
  );
}

function AuthScreen(props: {
  title: string;
  icon: "setup" | "login";
  pin: string;
  confirmPin: string;
  showConfirm?: boolean;
  busy: boolean;
  message: string | null;
  error: string | null;
  onPinChange: (value: string) => void;
  onConfirmPinChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const Icon = props.icon === "setup" ? KeyRound : Lock;

  return (
    <main className="auth-shell">
      <form className="auth-panel" onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}>
        <div className="auth-mark">
          <Icon size={28} />
        </div>
        <h1>{props.title}</h1>
        <label className="field">
          <span>PIN</span>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={props.pin}
            onChange={(event) => props.onPinChange(event.currentTarget.value)}
          />
        </label>
        {props.showConfirm && (
          <label className="field">
            <span>Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={props.confirmPin}
              onChange={(event) => props.onConfirmPinChange(event.currentTarget.value)}
            />
          </label>
        )}
        {(props.message || props.error) && (
          <div className={`notice compact ${props.error ? "notice-error" : "notice-ok"}`}>
            {props.error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{props.error ?? props.message}</span>
          </div>
        )}
        <button className="primary-button" disabled={props.busy} type="submit">
          <Lock size={18} />
          <span>{props.showConfirm ? "Create" : "Unlock"}</span>
        </button>
      </form>
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
