export const AGENT_VERSION = "1.0.0";
export const PROTOCOL_VERSION = "1";

export const PRINTER_ROLES = ["receipt", "kitchen", "cash_drawer"] as const;

export type PrinterRole = (typeof PRINTER_ROLES)[number];

export type TunnelProvider = "none" | "ngrok" | "custom";

export type PrinterAdapterMode = "windows" | "simulated";

export type ReceiptPrintMode = "pdf" | "escpos";

export type AgentStatus = "ok" | "degraded" | "error";

export interface ServerConfig {
  host: string;
  port: number;
}

export interface PrinterRoleConfig {
  enabled: boolean;
  printerName: string | null;
  paperName?: string | null;
  receiptPrintMode?: ReceiptPrintMode;
}

export type PrinterRoleConfigs = Record<PrinterRole, PrinterRoleConfig>;

export interface AgentConfig {
  server: ServerConfig;
  remoteAccessUrl: string | null;
  tunnelProvider: TunnelProvider;
  printerAdapterMode: PrinterAdapterMode;
  printerRoles: PrinterRoleConfigs;
}

export interface AgentConfigPatch {
  server?: Partial<ServerConfig>;
  remoteAccessUrl?: string | null;
  tunnelProvider?: TunnelProvider;
  printerAdapterMode?: PrinterAdapterMode;
  printerRoles?: Partial<Record<PrinterRole, Partial<PrinterRoleConfig>>>;
}

export interface PrinterPaperSize {
  name: string;
  width: number;
  height: number;
  isDefault?: boolean;
}

export interface SystemPrinter {
  name: string;
  online: boolean | null;
  statusText: string;
  isDefault?: boolean;
  driverName?: string;
  defaultPaperName?: string | null;
  defaultLandscape?: boolean | null;
  paperSizes?: PrinterPaperSize[];
}

export interface RolePrinterStatus {
  configured: boolean;
  enabled: boolean;
  online: boolean | null;
  name: string | null;
  statusText: string;
}

export type RolePrinterStatuses = Record<PrinterRole, RolePrinterStatus>;

export interface AgentHealth {
  status: AgentStatus;
  agentVersion: string;
  protocolVersion: string;
}

export interface DetailedAgentHealth extends AgentHealth {
  capabilities: {
    receipt: boolean;
    kitchen: boolean;
    cashDrawer: boolean;
  };
  printers: RolePrinterStatuses;
}

export interface PrintTask {
  role: PrinterRole;
  templateId?: "receipt.default" | "kitchen.default" | string;
  copies?: number;
  payload: unknown;
}

export interface PrintJobRequest {
  jobId: string;
  tasks: PrintTask[];
}

export type PrintOperationStatus =
  | "printed"
  | "opened"
  | "skipped"
  | "failed";

export interface PrintOperationResult {
  role: PrinterRole;
  status: PrintOperationStatus;
  printerName: string | null;
  message?: string;
  errorCode?: string;
}

export type PrintJobStatus =
  | "processed"
  | "already_processed"
  | "failed"
  | "invalid_request";

export interface PrintJobResponse {
  jobId: string;
  status: PrintJobStatus;
  results: PrintOperationResult[];
}

export interface AdminBootstrap {
  agentVersion: string;
  protocolVersion: string;
  localUrl: string;
  setupRequired: boolean;
  authenticated: boolean;
  initialApiToken: string | null;
}

export interface AdminState {
  config: AgentConfig;
  health: DetailedAgentHealth;
  printers: SystemPrinter[];
  localUrl: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
