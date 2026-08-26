import fs from "node:fs/promises";
import type {
  AgentConfig,
  AgentConfigPatch,
  PrinterAdapterMode,
  ReceiptPrintMode,
  PrinterRole,
  PrinterRoleConfig,
  PrinterRoleConfigs,
  ServerConfig,
  TunnelProvider
} from "../../shared/protocol";
import { PRINTER_ROLES } from "../../shared/protocol";
import { generateApiToken, hashSecret, validateAdminPin, verifySecret } from "../auth/secrets";
import type { Logger } from "../logging/logger";
import type { RuntimePaths } from "../runtimePaths";
import { ensureRuntimePaths } from "../runtimePaths";

interface StoredAgentConfig extends AgentConfig {
  auth: {
    apiTokenHash: string;
    apiTokenCreatedAt: string;
    apiTokenShownAt: string | null;
    adminPinHash: string | null;
  };
}

const DEFAULT_PORT = 47821;

const createDefaultRoleConfig = (): PrinterRoleConfigs => ({
  receipt: {
    enabled: true,
    printerName: null,
    paperName: null,
    receiptPrintMode: "pdf"
  },
  kitchen: {
    enabled: false,
    printerName: null,
    paperName: null
  },
  cash_drawer: {
    enabled: false,
    printerName: null,
    paperName: null
  }
});

const defaultServerConfig = (): ServerConfig => ({
  host: "127.0.0.1",
  port: DEFAULT_PORT
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const normalizeTunnelProvider = (value: unknown): TunnelProvider => {
  if (value === "ngrok" || value === "custom") {
    return value;
  }
  return "none";
};

const normalizePrinterAdapterMode = (value: unknown): PrinterAdapterMode => {
  return value === "simulated" ? "simulated" : "windows";
};

const normalizeReceiptPrintMode = (value: unknown): ReceiptPrintMode => {
  return value === "escpos" ? "escpos" : "pdf";
};

const normalizeServer = (value: unknown): ServerConfig => {
  const input = isRecord(value) ? value : {};
  const host = typeof input.host === "string" && input.host.trim() ? input.host.trim() : "127.0.0.1";
  const port = typeof input.port === "number" && Number.isInteger(input.port) ? input.port : DEFAULT_PORT;

  return {
    host,
    port: port > 0 && port < 65536 ? port : DEFAULT_PORT
  };
};

const normalizeRole = (role: PrinterRole, value: unknown): PrinterRoleConfig => {
  const input = isRecord(value) ? value : {};
  const enabled = typeof input.enabled === "boolean" ? input.enabled : role === "receipt";
  const printerName = typeof input.printerName === "string" && input.printerName.trim()
    ? input.printerName.trim()
    : null;
  const paperName = typeof input.paperName === "string" && input.paperName.trim()
    ? input.paperName.trim()
    : null;

  return {
    enabled,
    printerName,
    paperName,
    receiptPrintMode: role === "receipt"
      ? normalizeReceiptPrintMode(input.receiptPrintMode)
      : undefined
  };
};

const normalizeRoles = (value: unknown): PrinterRoleConfigs => {
  const input = isRecord(value) ? value : {};
  const roles = createDefaultRoleConfig();

  for (const role of PRINTER_ROLES) {
    roles[role] = normalizeRole(role, input[role]);
  }

  return roles;
};

const redactConfig = (stored: StoredAgentConfig): AgentConfig => ({
  server: stored.server,
  remoteAccessUrl: stored.remoteAccessUrl,
  tunnelProvider: stored.tunnelProvider,
  printerAdapterMode: stored.printerAdapterMode,
  printerRoles: stored.printerRoles
});

export class ConfigService {
  private config: StoredAgentConfig | null = null;
  private initialApiToken: string | null = null;

  constructor(
    private readonly paths: RuntimePaths,
    private readonly logger: Logger
  ) {}

  async init(): Promise<void> {
    await ensureRuntimePaths(this.paths);
    this.config = await this.readOrCreate();
  }

  getPublicConfig(): AgentConfig {
    return redactConfig(this.requireConfig());
  }

  getLocalUrl(): string {
    const { host, port } = this.requireConfig().server;
    return `http://${host}:${port}`;
  }

  isSetupRequired(): boolean {
    return !this.requireConfig().auth.adminPinHash;
  }

  verifyAdminPin(pin: string): boolean {
    return verifySecret(pin, this.requireConfig().auth.adminPinHash ?? undefined);
  }

  async setAdminPin(pin: string): Promise<void> {
    validateAdminPin(pin);
    const config = this.requireConfig();
    config.auth.adminPinHash = hashSecret(pin);
    await this.save();
    this.logger.info("Admin PIN configured");
  }

  verifyApiToken(token: string | undefined): boolean {
    if (!token) {
      return false;
    }
    return verifySecret(token, this.requireConfig().auth.apiTokenHash);
  }

  consumeInitialApiToken(): string | null {
    const token = this.initialApiToken;
    if (token) {
      this.initialApiToken = null;
      const config = this.requireConfig();
      config.auth.apiTokenShownAt = new Date().toISOString();
      void this.save();
    }
    return token;
  }

  async regenerateApiToken(): Promise<string> {
    const token = generateApiToken();
    const config = this.requireConfig();
    config.auth.apiTokenHash = hashSecret(token);
    config.auth.apiTokenCreatedAt = new Date().toISOString();
    config.auth.apiTokenShownAt = null;
    await this.save();
    this.logger.warn("API token regenerated");
    return token;
  }

  async patch(patch: AgentConfigPatch): Promise<AgentConfig> {
    const config = this.requireConfig();

    if (patch.server) {
      config.server = normalizeServer({
        ...config.server,
        ...patch.server
      });
    }

    if ("remoteAccessUrl" in patch) {
      const nextUrl = patch.remoteAccessUrl?.trim() ?? null;
      config.remoteAccessUrl = nextUrl || null;
    }

    if (patch.tunnelProvider) {
      config.tunnelProvider = normalizeTunnelProvider(patch.tunnelProvider);
    }

    if (patch.printerAdapterMode) {
      config.printerAdapterMode = normalizePrinterAdapterMode(patch.printerAdapterMode);
    }

    if (patch.printerRoles) {
      for (const role of PRINTER_ROLES) {
        const rolePatch = patch.printerRoles[role];
        if (!rolePatch) {
          continue;
        }

        config.printerRoles[role] = normalizeRole(role, {
          ...config.printerRoles[role],
          ...rolePatch
        });
      }
    }

    await this.save();
    this.logger.info("Configuration updated");
    return this.getPublicConfig();
  }

  private async readOrCreate(): Promise<StoredAgentConfig> {
    try {
      const raw = await fs.readFile(this.paths.configFile, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const normalized = this.normalizeStored(parsed);
      await this.write(normalized);
      return normalized;
    } catch (error) {
      const token = generateApiToken();
      this.initialApiToken = token;

      const createdAt = new Date().toISOString();
      const config: StoredAgentConfig = {
        server: defaultServerConfig(),
        remoteAccessUrl: null,
        tunnelProvider: "none",
        printerAdapterMode: "windows",
        printerRoles: createDefaultRoleConfig(),
        auth: {
          apiTokenHash: hashSecret(token),
          apiTokenCreatedAt: createdAt,
          apiTokenShownAt: null,
          adminPinHash: null
        }
      };

      await this.write(config);
      this.logger.info("Initial configuration created");

      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("Existing configuration could not be read; created a fresh config", {
          message: error instanceof Error ? error.message : String(error)
        });
      }

      return config;
    }
  }

  private normalizeStored(value: unknown): StoredAgentConfig {
    const input = isRecord(value) ? value : {};
    const auth = isRecord(input.auth) ? input.auth : {};

    if (typeof auth.apiTokenHash !== "string" || !auth.apiTokenHash) {
      const token = generateApiToken();
      this.initialApiToken = token;
      auth.apiTokenHash = hashSecret(token);
      auth.apiTokenCreatedAt = new Date().toISOString();
      auth.apiTokenShownAt = null;
    }

    return {
      server: normalizeServer(input.server),
      remoteAccessUrl: typeof input.remoteAccessUrl === "string" && input.remoteAccessUrl.trim()
        ? input.remoteAccessUrl.trim()
        : null,
      tunnelProvider: normalizeTunnelProvider(input.tunnelProvider),
      printerAdapterMode: normalizePrinterAdapterMode(input.printerAdapterMode),
      printerRoles: normalizeRoles(input.printerRoles),
      auth: {
        apiTokenHash: String(auth.apiTokenHash),
        apiTokenCreatedAt: typeof auth.apiTokenCreatedAt === "string"
          ? auth.apiTokenCreatedAt
          : new Date().toISOString(),
        apiTokenShownAt: typeof auth.apiTokenShownAt === "string" ? auth.apiTokenShownAt : null,
        adminPinHash: typeof auth.adminPinHash === "string" ? auth.adminPinHash : null
      }
    };
  }

  private async save(): Promise<void> {
    await this.write(this.requireConfig());
  }

  private async write(config: StoredAgentConfig): Promise<void> {
    await fs.writeFile(this.paths.configFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  private requireConfig(): StoredAgentConfig {
    if (!this.config) {
      throw new Error("ConfigService has not been initialized.");
    }
    return this.config;
  }
}
