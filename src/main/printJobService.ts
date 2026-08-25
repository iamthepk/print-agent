import type {
  DetailedAgentHealth,
  PrintJobRequest,
  PrintJobResponse,
  PrintOperationResult,
  PrinterRole,
  RolePrinterStatus,
  RolePrinterStatuses,
  SystemPrinter
} from "../shared/protocol";
import { AGENT_VERSION, PRINTER_ROLES, PROTOCOL_VERSION } from "../shared/protocol";
import type { ConfigService } from "./config/configService";
import type { DedupeStore } from "./dedupe/dedupeStore";
import type { Logger } from "./logging/logger";
import type { PrinterAdapter } from "./printers/printerAdapter";

export class PrintJobService {
  constructor(
    private readonly configService: ConfigService,
    private readonly adapter: PrinterAdapter,
    private readonly dedupeStore: DedupeStore,
    private readonly logger: Logger
  ) {}

  async getPrinters(): Promise<SystemPrinter[]> {
    return this.adapter.listPrinters();
  }

  async getRoleStatuses(): Promise<RolePrinterStatuses> {
    const config = this.configService.getPublicConfig();
    const systemPrinters = await this.adapter.listPrinters();
    const byName = new Map(systemPrinters.map((printer) => [printer.name, printer]));
    const result = {} as RolePrinterStatuses;

    for (const role of PRINTER_ROLES) {
      const roleConfig = config.printerRoles[role];
      const printer = roleConfig.printerName ? byName.get(roleConfig.printerName) : undefined;
      result[role] = this.buildRoleStatus(roleConfig.enabled, roleConfig.printerName, printer);
    }

    return result;
  }

  async getDetailedHealth(): Promise<DetailedAgentHealth> {
    const printers = await this.getRoleStatuses();
    const hasBlockingIssue = PRINTER_ROLES.some((role) => {
      const status = printers[role];
      return status.enabled && (!status.configured || status.online === false);
    });

    return {
      status: hasBlockingIssue ? "degraded" : "ok",
      agentVersion: AGENT_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        receipt: true,
        kitchen: true,
        cashDrawer: true
      },
      printers
    };
  }

  async processJob(request: PrintJobRequest): Promise<PrintJobResponse> {
    const validationError = this.validateJobRequest(request);
    if (validationError) {
      return {
        jobId: request?.jobId ?? "",
        status: "invalid_request",
        results: [{
          role: "receipt",
          status: "failed",
          printerName: null,
          errorCode: "invalid_request",
          message: validationError
        }]
      };
    }

    const existing = this.dedupeStore.get(request.jobId);
    if (existing) {
      this.logger.info("Duplicate print job suppressed", { jobId: request.jobId });
      return existing;
    }

    const results: PrintOperationResult[] = [];

    for (const task of request.tasks) {
      const role = task.role;
      const roleConfig = this.configService.getPublicConfig().printerRoles[role];
      const printerName = roleConfig.printerName;

      if (!roleConfig.enabled || !printerName) {
        results.push({
          role,
          status: "skipped",
          printerName: printerName ?? null,
          errorCode: "role_not_configured",
          message: `${role} is disabled or not configured.`
        });
        continue;
      }

      if (role === "cash_drawer") {
        const result = await this.adapter.openDrawer(printerName);
        results.push({
          role,
          status: result.ok ? "opened" : "failed",
          printerName,
          message: result.message,
          errorCode: result.errorCode
        });
        continue;
      }

      const result = await this.adapter.print({
        role,
        printerName,
        templateId: task.templateId ?? `${role}.default`,
        copies: Math.max(1, Math.min(10, task.copies ?? 1)),
        payload: task.payload
      });

      results.push({
        role,
        status: result.ok ? "printed" : "failed",
        printerName,
        message: result.message,
        errorCode: result.errorCode
      });
    }

    const response: PrintJobResponse = {
      jobId: request.jobId,
      status: results.some((result) => result.status === "failed") ? "failed" : "processed",
      results
    };

    await this.dedupeStore.remember(request.jobId, response);
    return response;
  }

  async runTest(role: PrinterRole): Promise<PrintOperationResult> {
    const request: PrintJobRequest = {
      jobId: `manual-test-${role}-${Date.now()}`,
      tasks: [{
        role,
        templateId: role === "kitchen" ? "kitchen.default" : "receipt.default",
        payload: {
          kind: "test",
          createdAt: new Date().toISOString()
        }
      }]
    };

    const response = await this.processJob(request);
    return response.results[0];
  }

  private buildRoleStatus(
    enabled: boolean,
    printerName: string | null,
    printer: SystemPrinter | undefined
  ): RolePrinterStatus {
    if (!enabled) {
      return {
        configured: false,
        enabled,
        online: null,
        name: printerName,
        statusText: "disabled"
      };
    }

    if (!printerName) {
      return {
        configured: false,
        enabled,
        online: null,
        name: null,
        statusText: "not_configured"
      };
    }

    if (!printer) {
      return {
        configured: true,
        enabled,
        online: false,
        name: printerName,
        statusText: "not_found"
      };
    }

    return {
      configured: true,
      enabled,
      online: printer.online,
      name: printer.name,
      statusText: printer.statusText
    };
  }

  private validateJobRequest(request: unknown): string | null {
    if (typeof request !== "object" || request === null) {
      return "Body must be a JSON object.";
    }

    const candidate = request as Partial<PrintJobRequest>;
    if (typeof candidate.jobId !== "string" || !candidate.jobId.trim()) {
      return "jobId is required.";
    }

    if (!Array.isArray(candidate.tasks) || candidate.tasks.length === 0) {
      return "tasks must be a non-empty array.";
    }

    for (const task of candidate.tasks) {
      if (typeof task !== "object" || task === null) {
        return "Each task must be an object.";
      }

      const role = (task as { role?: unknown }).role;
      if (!PRINTER_ROLES.includes(role as PrinterRole)) {
        return "Task role must be receipt, kitchen, or cash_drawer.";
      }
    }

    return null;
  }
}
