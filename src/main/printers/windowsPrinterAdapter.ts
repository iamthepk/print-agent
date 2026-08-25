import { app } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { PrinterRole, SystemPrinter } from "../../shared/protocol";
import type { Logger } from "../logging/logger";
import type { RuntimePaths } from "../runtimePaths";
import type { AdapterOperationResult, AdapterPrintRequest, PrinterAdapter } from "./printerAdapter";

const execFileAsync = promisify(execFile);

interface PowerShellPrinter {
  Name?: string;
  PrinterStatus?: string | number;
  WorkOffline?: boolean;
  Default?: boolean;
}

interface HelperCommand {
  operation: "print" | "open_drawer";
  printerName: string;
  role?: PrinterRole;
  templateId?: string;
  copies?: number;
  payload?: unknown;
}

const normalizeWindowsStatusText = (status: string | number | undefined, workOffline: boolean): string => {
  if (workOffline) {
    return "offline";
  }

  if (status === 0 || status === "0") {
    return "ready";
  }

  return String(status ?? "unknown");
};

export class WindowsPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly paths: RuntimePaths,
    private readonly logger: Logger
  ) {}

  async listPrinters(): Promise<SystemPrinter[]> {
    if (process.platform !== "win32") {
      return [];
    }

    try {
      const command = "Get-Printer | Select-Object Name,PrinterStatus,WorkOffline,Default | ConvertTo-Json -Depth 2 -Compress";
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        command
      ], {
        timeout: 8000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });

      const trimmed = stdout.trim();
      if (!trimmed) {
        return [];
      }

      const parsed = JSON.parse(trimmed) as PowerShellPrinter | PowerShellPrinter[];
      const printers = Array.isArray(parsed) ? parsed : [parsed];
      return printers
        .filter((printer) => typeof printer.Name === "string" && printer.Name.trim())
        .map((printer) => this.mapPowerShellPrinter(printer))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.warn("Windows printer discovery failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  async print(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    const result = await this.runHelper({
      operation: "print",
      printerName: request.printerName,
      role: request.role,
      templateId: request.templateId,
      copies: request.copies,
      payload: request.payload
    });

    if (result.ok || result.errorCode !== "helper_missing") {
      return result;
    }

    return this.printTextFallback(request);
  }

  async openDrawer(printerName: string): Promise<AdapterOperationResult> {
    return this.runHelper({
      operation: "open_drawer",
      printerName
    });
  }

  private mapPowerShellPrinter(printer: PowerShellPrinter): SystemPrinter {
    const workOffline = printer.WorkOffline === true;
    const statusText = normalizeWindowsStatusText(printer.PrinterStatus, workOffline);
    const normalized = statusText.toLowerCase();
    const online = !workOffline
      && !normalized.includes("offline")
      && !normalized.includes("error")
      && !normalized.includes("paperout");

    return {
      name: String(printer.Name),
      online,
      statusText,
      isDefault: printer.Default === true
    };
  }

  private async runHelper(command: HelperCommand): Promise<AdapterOperationResult> {
    const helperPath = await this.findHelperPath();
    if (!helperPath) {
      return {
        ok: false,
        errorCode: "helper_missing",
        message: "WinSpoolerHelper.exe is not available."
      };
    }

    const commandFile = path.join(
      this.paths.dataDir,
      `spooler-command-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );

    try {
      await fs.writeFile(commandFile, JSON.stringify(command), "utf8");
      const { stdout } = await execFileAsync(helperPath, [commandFile], {
        timeout: 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });

      const trimmed = stdout.trim();
      if (!trimmed) {
        return {
          ok: true
        };
      }

      const parsed = JSON.parse(trimmed) as AdapterOperationResult;
      return {
        ok: parsed.ok === true,
        message: typeof parsed.message === "string" ? parsed.message : undefined,
        errorCode: typeof parsed.errorCode === "string" ? parsed.errorCode : undefined
      };
    } catch (error) {
      this.logger.warn("WinSpoolerHelper operation failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      return {
        ok: false,
        errorCode: "helper_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async printTextFallback(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    if (process.platform !== "win32") {
      return {
        ok: false,
        errorCode: "unsupported_platform",
        message: "Windows text fallback is only available on Windows."
      };
    }

    const textFile = path.join(
      this.paths.dataDir,
      `print-fallback-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
    );

    try {
      await fs.writeFile(textFile, this.renderFallbackDocument(request), "utf8");

      const script = [
        "& {",
        "param([string]$FilePath, [string]$PrinterName)",
        "Get-Content -LiteralPath $FilePath -Encoding UTF8 | Out-Printer -Name $PrinterName",
        "}"
      ].join(" ");

      for (let copy = 0; copy < request.copies; copy += 1) {
        await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          script,
          textFile,
          request.printerName
        ], {
          timeout: 30000,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        });
      }

      this.logger.info("Printed through Windows text fallback", {
        role: request.role,
        printerName: request.printerName,
        copies: request.copies
      });

      return {
        ok: true,
        message: `Printed through Windows text fallback on ${request.printerName}.`
      };
    } catch (error) {
      this.logger.warn("Windows text fallback print failed", {
        message: error instanceof Error ? error.message : String(error),
        printerName: request.printerName
      });
      return {
        ok: false,
        errorCode: "windows_text_print_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await fs.unlink(textFile).catch(() => undefined);
    }
  }

  private renderFallbackDocument(request: AdapterPrintRequest): string {
    const title = request.role === "kitchen" ? "KITCHEN TEST PRINT" : "RECEIPT TEST PRINT";
    const lines = [
      title,
      "=".repeat(title.length),
      "",
      `Template: ${request.templateId}`,
      `Role: ${request.role}`,
      `Printer: ${request.printerName}`,
      `Printed at: ${new Date().toISOString()}`,
      "",
      "Payload:",
      this.formatPayload(request.payload),
      "",
      "---",
      "Print Agent Windows text fallback",
      "\f"
    ];

    return lines.join("\r\n");
  }

  private formatPayload(payload: unknown): string {
    if (payload === null || payload === undefined) {
      return "(empty)";
    }

    if (typeof payload === "string") {
      return payload;
    }

    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private async findHelperPath(): Promise<string | null> {
    const candidates = [
      path.join(process.resourcesPath ?? "", "bin", "WinSpoolerHelper.exe"),
      path.join(app.getAppPath(), "bin", "WinSpoolerHelper.exe"),
      path.join(process.cwd(), "bin", "WinSpoolerHelper.exe")
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }

    return null;
  }
}
