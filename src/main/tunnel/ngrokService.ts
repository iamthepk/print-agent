import { app } from "electron";
import { execFileSync, spawn, type ChildProcessByStdio } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import type { TunnelRuntimeStatus } from "../../shared/protocol";
import type { ConfigService } from "../config/configService";
import type { Logger } from "../logging/logger";

const LOCAL_INSPECTOR_URL = "http://127.0.0.1:4040/api/tunnels";
const INSPECTOR_PATH = "/api/tunnels";
const PUBLIC_URL_POLL_ATTEMPTS = 30;
const PUBLIC_URL_POLL_INTERVAL_MS = 500;
const AUTOSTART_RETRY_DELAY_MS = 30_000;
const DEFAULT_CONFIG_RETRY_DELAY_MS = 1_000;

type TokenSource = "stored" | "default-config";

interface NgrokTunnelApiResponse {
  tunnels?: Array<{
    public_url?: string;
    proto?: string;
    config?: {
      addr?: string;
    };
  }>;
}

interface NgrokLogLine {
  lvl?: string;
  msg?: string;
  err?: string;
  addr?: string;
  url?: string;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export class NgrokService {
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private runningKey: string | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private inspectorUrl = LOCAL_INSPECTOR_URL;
  private lastOutputError: string | null = null;
  private tokenSource: TokenSource = "default-config";
  private preferDefaultConfigToken = false;
  private status: TunnelRuntimeStatus = {
    provider: "ngrok",
    state: "disabled",
    publicUrl: null,
    message: "Tunnel is disabled."
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger
  ) {}

  getStatus(): TunnelRuntimeStatus {
    return {
      ...this.status
    };
  }

  async reconcile(): Promise<TunnelRuntimeStatus> {
    const config = this.configService.getPublicConfig();
    if (config.tunnelProvider !== "ngrok" || !config.tunnel.autostart) {
      await this.stop("Tunnel is disabled.");
      this.preferDefaultConfigToken = false;
      return this.getStatus();
    }

    this.clearRetryTimer();
    this.preferDefaultConfigToken = false;
    return this.start();
  }

  async start(waitForUrl = false): Promise<TunnelRuntimeStatus> {
    this.clearRetryTimer();

    const config = this.configService.getPublicConfig();
    if (config.tunnelProvider !== "ngrok") {
      await this.stop("Tunnel provider is not ngrok.");
      return this.getStatus();
    }

    const ngrokPath = this.findNgrokPath();
    if (!ngrokPath) {
      await this.stop("ngrok.exe was not found.");
      this.status = {
        provider: "ngrok",
        state: "error",
        publicUrl: config.remoteAccessUrl,
        message: "ngrok.exe was not found. Re-run the Print Agent installer."
      };
      return this.getStatus();
    }

    const args = this.buildArgs();
    const token = this.preferDefaultConfigToken
      ? null
      : this.configService.getNgrokAuthToken();
    const tokenSource: TokenSource = token ? "stored" : "default-config";
    const tokenFingerprint = token
      ? crypto.createHash("sha256").update(token).digest("base64url")
      : tokenSource;
    const nextKey = [ngrokPath, ...args, tokenFingerprint].join("\u0000");
    if (
      this.process
      && this.runningKey === nextKey
      && (this.status.state === "starting" || this.status.state === "online")
    ) {
      if (waitForUrl && this.status.state !== "online") {
        await this.waitForPublicUrl(this.process);
      }
      return this.getStatus();
    }

    await this.stop("Restarting ngrok tunnel.");
    this.inspectorUrl = LOCAL_INSPECTOR_URL;
    this.lastOutputError = null;

    this.status = {
      provider: "ngrok",
      state: "starting",
      publicUrl: config.remoteAccessUrl,
      message: "Starting ngrok tunnel..."
    };

    const tunnelProcess = spawn(ngrokPath, args, {
      env: {
        ...process.env,
        ...(token ? { NGROK_AUTHTOKEN: token } : {})
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.process = tunnelProcess;
    this.runningKey = nextKey;
    this.tokenSource = tokenSource;

    tunnelProcess.stdout.on("data", (chunk: Buffer) => {
      this.handleOutput(tunnelProcess, chunk.toString("utf8"));
    });

    tunnelProcess.stderr.on("data", (chunk: Buffer) => {
      this.handleOutput(tunnelProcess, chunk.toString("utf8"));
    });

    tunnelProcess.once("error", (error) => {
      if (this.process !== tunnelProcess) {
        return;
      }

      this.logger.warn("ngrok process failed", {
        message: error.message
      });
      this.status = {
        provider: "ngrok",
        state: "error",
        publicUrl: null,
        message: error.message
      };
      this.scheduleAutostartRetry(error.message);
    });

    tunnelProcess.once("exit", (code) => {
      if (this.process !== tunnelProcess) {
        return;
      }

      this.clearPollTimer();
      this.process = null;
      this.runningKey = null;
      if (this.status.state !== "disabled") {
        const message = this.lastOutputError
          ?? `ngrok tunnel stopped${typeof code === "number" ? ` with code ${code}` : ""}.`;
        this.status = {
          provider: "ngrok",
          state: "offline",
          publicUrl: this.status.publicUrl,
          message
        };
        if (this.shouldRetryWithDefaultConfigToken()) {
          this.preferDefaultConfigToken = true;
          this.scheduleAutostartRetry(
            `${message} Retrying with ngrok default local config.`,
            DEFAULT_CONFIG_RETRY_DELAY_MS
          );
          return;
        }

        this.scheduleAutostartRetry(message);
      }
    });

    const publicUrlPromise = this.waitForPublicUrl(tunnelProcess);
    if (waitForUrl) {
      await publicUrlPromise;
    }
    return this.getStatus();
  }

  async stop(message = "Tunnel is disabled."): Promise<TunnelRuntimeStatus> {
    this.clearRetryTimer();
    this.clearPollTimer();
    const current = this.process;
    this.process = null;
    this.runningKey = null;

    if (current && !current.killed) {
      current.kill();
      await delay(250);
    }

    this.status = {
      provider: "ngrok",
      state: "disabled",
      publicUrl: null,
      message
    };

    return this.getStatus();
  }

  private buildArgs(): string[] {
    const config = this.configService.getPublicConfig();
    const localTarget = `${config.server.host}:${config.server.port}`;
    const args = [
      "http",
      localTarget,
      "--scheme=https",
      "--log=stdout",
      "--log-format=json",
      "--log-level=info"
    ];

    if (config.tunnel.ngrokDomain) {
      args.push(`--domain=${config.tunnel.ngrokDomain}`);
    }

    return args;
  }

  private handleOutput(
    tunnelProcess: ChildProcessByStdio<null, Readable, Readable>,
    output: string
  ): void {
    if (this.process !== tunnelProcess) {
      return;
    }

    for (const line of output.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as NgrokLogLine;
        this.captureInspectorUrl(parsed);
        this.captureStartedTunnel(tunnelProcess, parsed);

        if (parsed.lvl === "eror" || parsed.lvl === "error") {
          const message = this.sanitizeNgrokMessage(
            parsed.err || parsed.msg || "ngrok reported an error."
          );
          this.lastOutputError = message;
          this.logger.warn("ngrok reported an error", { message });
          this.status = {
            provider: "ngrok",
            state: "error",
            publicUrl: this.status.publicUrl,
            message
          };
        }
      } catch {
        if (/error|failed|ERR_NGROK/i.test(line)) {
          const message = this.sanitizeNgrokMessage(line.trim());
          this.lastOutputError = message;
          this.logger.warn("ngrok reported an error", { message });
          this.status = {
            provider: "ngrok",
            state: "error",
            publicUrl: this.status.publicUrl,
            message
          };
        }
      }
    }
  }

  private async waitForPublicUrl(
    tunnelProcess: ChildProcessByStdio<null, Readable, Readable>
  ): Promise<void> {
    for (let attempt = 0; attempt < PUBLIC_URL_POLL_ATTEMPTS; attempt += 1) {
      if (this.process !== tunnelProcess) {
        return;
      }

      await delay(PUBLIC_URL_POLL_INTERVAL_MS);
      if (this.status.state === "online") {
        return;
      }

      const publicUrl = await this.readPublicUrl();
      if (!publicUrl) {
        continue;
      }

      await this.acceptPublicUrl(tunnelProcess, publicUrl);
      return;
    }

    if (this.process === tunnelProcess && this.status.state === "starting") {
      const message = "ngrok started, but no public URL was reported.";
      this.status = {
        provider: "ngrok",
        state: "error",
        publicUrl: null,
        message
      };
      this.scheduleAutostartRetry(message);
    }
  }

  private schedulePublicUrlRefresh(): void {
    this.clearPollTimer();
    this.pollTimer = setInterval(() => {
      void this.refreshPublicUrl();
    }, 15000);
  }

  private async refreshPublicUrl(): Promise<void> {
    if (!this.process) {
      return;
    }

    const publicUrl = await this.readPublicUrl();
    if (publicUrl && publicUrl !== this.status.publicUrl) {
      await this.acceptPublicUrl(this.process, publicUrl);
    }
  }

  private async readPublicUrl(): Promise<string | null> {
    try {
      const response = await fetch(this.inspectorUrl);
      if (!response.ok) {
        return null;
      }

      const body = await response.json() as NgrokTunnelApiResponse;
      const httpsTunnel = body.tunnels?.find((tunnel) =>
        tunnel.proto === "https" && typeof tunnel.public_url === "string"
          && this.matchesLocalTarget(tunnel.config?.addr)
      );
      return httpsTunnel?.public_url ?? null;
    } catch {
      return null;
    }
  }

  private captureInspectorUrl(parsed: NgrokLogLine): void {
    if (parsed.msg !== "starting web service" || typeof parsed.addr !== "string") {
      return;
    }

    this.inspectorUrl = `http://${parsed.addr.replace(/^https?:\/\//, "")}${INSPECTOR_PATH}`;
  }

  private captureStartedTunnel(
    tunnelProcess: ChildProcessByStdio<null, Readable, Readable>,
    parsed: NgrokLogLine
  ): void {
    if (
      parsed.msg !== "started tunnel"
      || typeof parsed.url !== "string"
      || !this.matchesLocalTarget(parsed.addr)
    ) {
      return;
    }

    void this.acceptPublicUrl(tunnelProcess, parsed.url);
  }

  private async acceptPublicUrl(
    tunnelProcess: ChildProcessByStdio<null, Readable, Readable>,
    publicUrl: string
  ): Promise<void> {
    if (this.process !== tunnelProcess) {
      return;
    }

    this.status = {
      provider: "ngrok",
      state: "online",
      publicUrl,
      message: "ngrok tunnel is online."
    };

    if (this.configService.getPublicConfig().remoteAccessUrl !== publicUrl) {
      await this.configService.patch({
        tunnelProvider: "ngrok",
        remoteAccessUrl: publicUrl
      });
    }

    this.schedulePublicUrlRefresh();
  }

  private matchesLocalTarget(value: string | undefined): boolean {
    if (!value) {
      return false;
    }

    const config = this.configService.getPublicConfig();
    const parsed = this.parseTarget(value);
    if (!parsed) {
      return false;
    }

    return parsed.port === config.server.port
      && this.hostsMatch(parsed.host, config.server.host);
  }

  private parseTarget(value: string): { host: string; port: number } | null {
    try {
      const parsed = new URL(value.includes("://") ? value : `http://${value}`);
      const port = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === "https:"
          ? 443
          : 80;

      if (!Number.isInteger(port)) {
        return null;
      }

      return {
        host: parsed.hostname.toLowerCase(),
        port
      };
    } catch {
      return null;
    }
  }

  private hostsMatch(actual: string, expected: string): boolean {
    const normalize = (host: string): string => host.trim().toLowerCase().replace(/^\[|\]$/g, "");
    const actualHost = normalize(actual);
    const expectedHost = normalize(expected);
    if (actualHost === expectedHost) {
      return true;
    }

    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    return localHosts.has(actualHost) && localHosts.has(expectedHost);
  }

  private sanitizeNgrokMessage(message: string): string {
    return message
      .replace(/("Authtoken"\s*:\s*")[^"]+/gi, "$1[redacted]")
      .replace(/(Authtoken[:=]?\s*)[^\s",}]+/gi, "$1[redacted]")
      .replace(/[A-Za-z0-9]{20,}_[A-Za-z0-9]{20,}/g, "[redacted]");
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleAutostartRetry(
    reason: string,
    retryAfterMs = AUTOSTART_RETRY_DELAY_MS
  ): void {
    if (!this.shouldAutostart() || this.retryTimer) {
      return;
    }

    const config = this.configService.getPublicConfig();
    this.status = {
      provider: "ngrok",
      state: "offline",
      publicUrl: this.status.publicUrl ?? config.remoteAccessUrl,
      message: `${reason} Retrying automatically in ${retryAfterMs / 1000} seconds.`
    };

    this.logger.warn("ngrok autostart retry scheduled", {
      reason,
      retryAfterMs
    });

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.retryAutostart();
    }, retryAfterMs);
  }

  private async retryAutostart(): Promise<void> {
    if (!this.shouldAutostart()) {
      return;
    }

    try {
      await this.stop("Retrying ngrok tunnel.");
      await this.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("ngrok autostart retry failed", { message });
      this.scheduleAutostartRetry(message);
    }
  }

  private shouldAutostart(): boolean {
    const config = this.configService.getPublicConfig();
    return config.tunnelProvider === "ngrok" && config.tunnel.autostart;
  }

  private shouldRetryWithDefaultConfigToken(): boolean {
    return this.tokenSource === "stored"
      && !this.preferDefaultConfigToken
      && this.hasDefaultNgrokAuthToken()
      && this.shouldAutostart();
  }

  private hasDefaultNgrokAuthToken(): boolean {
    const candidates = [
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "ngrok", "ngrok.yml")
        : null,
      path.join(app.getPath("home"), ".ngrok2", "ngrok.yml")
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        const raw = readFileSync(candidate, "utf8");
        if (/^\s*authtoken:\s*\S+/m.test(raw)) {
          return true;
        }
      } catch {
        // Try the next default config location.
      }
    }

    return false;
  }

  private findNgrokPath(): string | null {
    const candidates = [
      this.findOnPath("ngrok.exe"),
      path.join("C:", "ngrok", "ngrok.exe"),
      path.join("C:", "Program Files", "ngrok", "ngrok.exe"),
      path.join("C:", "Program Files (x86)", "ngrok", "ngrok.exe"),
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "ngrok", "ngrok.exe")
        : null,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ngrok.exe")
        : null,
      path.join(process.resourcesPath ?? "", "vendor", "ngrok", "ngrok.exe"),
      path.join(app.getAppPath(), "vendor", "ngrok", "ngrok.exe")
    ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

    const available: Array<{ path: string; version: number[] | null }> = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const normalized = candidate.replace(/^"|"$/g, "");
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (existsSync(normalized)) {
        available.push({
          path: normalized,
          version: this.readNgrokVersion(normalized)
        });
      }
    }

    return available.sort((a, b) => this.compareVersions(b.version, a.version))[0]?.path ?? null;
  }

  private findOnPath(executable: string): string | null {
    const pathValue = process.env.PATH ?? "";
    const segments = pathValue.split(path.delimiter).filter(Boolean);
    for (const segment of segments) {
      const candidate = path.join(segment, executable);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private readNgrokVersion(ngrokPath: string): number[] | null {
    try {
      const output = execFileSync(ngrokPath, ["version"], {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true
      });
      const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
      return match ? match.slice(1).map(Number) : null;
    } catch {
      return null;
    }
  }

  private compareVersions(a: number[] | null, b: number[] | null): number {
    if (!a && !b) {
      return 0;
    }

    if (!a) {
      return -1;
    }

    if (!b) {
      return 1;
    }

    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const diff = (a[index] ?? 0) - (b[index] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }

    return 0;
  }
}
