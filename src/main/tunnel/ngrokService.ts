import { app } from "electron";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import type { TunnelRuntimeStatus } from "../../shared/protocol";
import type { ConfigService } from "../config/configService";
import type { Logger } from "../logging/logger";

const LOCAL_INSPECTOR_URL = "http://127.0.0.1:4040/api/tunnels";

interface NgrokTunnelApiResponse {
  tunnels?: Array<{
    public_url?: string;
    proto?: string;
  }>;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export class NgrokService {
  private process: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private runningKey: string | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
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
      return this.getStatus();
    }

    return this.start();
  }

  async start(waitForUrl = false): Promise<TunnelRuntimeStatus> {
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
    const token = this.configService.getNgrokAuthToken();
    const tokenFingerprint = token
      ? crypto.createHash("sha256").update(token).digest("base64url")
      : "";
    const nextKey = [ngrokPath, ...args, tokenFingerprint].join("\u0000");
    if (this.process && this.runningKey === nextKey) {
      return this.getStatus();
    }

    await this.stop("Restarting ngrok tunnel.");

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

    tunnelProcess.stdout.on("data", (chunk: Buffer) => {
      this.handleOutput(chunk.toString("utf8"));
    });

    tunnelProcess.stderr.on("data", (chunk: Buffer) => {
      this.handleOutput(chunk.toString("utf8"));
    });

    tunnelProcess.once("error", (error) => {
      this.logger.warn("ngrok process failed", {
        message: error.message
      });
      this.status = {
        provider: "ngrok",
        state: "error",
        publicUrl: null,
        message: error.message
      };
    });

    tunnelProcess.once("exit", (code) => {
      this.clearPollTimer();
      this.process = null;
      this.runningKey = null;
      if (this.status.state !== "disabled") {
        this.status = {
          provider: "ngrok",
          state: "offline",
          publicUrl: this.status.publicUrl,
          message: `ngrok tunnel stopped${typeof code === "number" ? ` with code ${code}` : ""}.`
        };
      }
    });

    const publicUrlPromise = this.waitForPublicUrl();
    if (waitForUrl) {
      await publicUrlPromise;
    }
    return this.getStatus();
  }

  async stop(message = "Tunnel is disabled."): Promise<TunnelRuntimeStatus> {
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

  private handleOutput(output: string): void {
    for (const line of output.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as { lvl?: string; msg?: string; err?: string };
        if (parsed.lvl === "eror" || parsed.lvl === "error") {
          this.status = {
            provider: "ngrok",
            state: "error",
            publicUrl: this.status.publicUrl,
            message: parsed.err || parsed.msg || "ngrok reported an error."
          };
        }
      } catch {
        if (/error|failed|ERR_NGROK/i.test(line)) {
          this.status = {
            provider: "ngrok",
            state: "error",
            publicUrl: this.status.publicUrl,
            message: line.trim()
          };
        }
      }
    }
  }

  private async waitForPublicUrl(): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!this.process) {
        return;
      }

      await delay(500);
      const publicUrl = await this.readPublicUrl();
      if (!publicUrl) {
        continue;
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
      return;
    }

    if (this.process && this.status.state === "starting") {
      this.status = {
        provider: "ngrok",
        state: "error",
        publicUrl: null,
        message: "ngrok started, but no public URL was reported."
      };
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
      this.status = {
        provider: "ngrok",
        state: "online",
        publicUrl,
        message: "ngrok tunnel is online."
      };
      await this.configService.patch({
        tunnelProvider: "ngrok",
        remoteAccessUrl: publicUrl
      });
    }
  }

  private async readPublicUrl(): Promise<string | null> {
    try {
      const response = await fetch(LOCAL_INSPECTOR_URL);
      if (!response.ok) {
        return null;
      }

      const body = await response.json() as NgrokTunnelApiResponse;
      const httpsTunnel = body.tunnels?.find((tunnel) =>
        tunnel.proto === "https" && typeof tunnel.public_url === "string"
      );
      return httpsTunnel?.public_url ?? null;
    } catch {
      return null;
    }
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private findNgrokPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath ?? "", "vendor", "ngrok", "ngrok.exe"),
      path.join(app.getAppPath(), "vendor", "ngrok", "ngrok.exe"),
      path.join("C:", "Program Files", "ngrok", "ngrok.exe"),
      path.join("C:", "Program Files (x86)", "ngrok", "ngrok.exe"),
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "ngrok", "ngrok.exe")
        : null,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ngrok.exe")
        : null,
      this.findOnPath("ngrok.exe")
    ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

    for (const candidate of candidates) {
      const normalized = candidate.replace(/^"|"$/g, "");
      if (existsSync(normalized)) {
        return normalized;
      }
    }

    return null;
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
}
