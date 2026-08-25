import type { SystemPrinter } from "../../shared/protocol";
import type { Logger } from "../logging/logger";
import type { AdapterOperationResult, AdapterPrintRequest, PrinterAdapter } from "./printerAdapter";

const DEFAULT_SIMULATED_PRINTERS: SystemPrinter[] = [
  {
    name: "Simulated Receipt Printer",
    online: true,
    statusText: "ready",
    isDefault: true
  },
  {
    name: "Simulated Kitchen Printer",
    online: true,
    statusText: "ready"
  },
  {
    name: "Simulated Drawer Port",
    online: true,
    statusText: "ready"
  }
];

export class SimulatedPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly getConfiguredPrinterNames: () => string[],
    private readonly logger: Logger
  ) {}

  async listPrinters(): Promise<SystemPrinter[]> {
    const printersByName = new Map<string, SystemPrinter>();

    for (const printer of DEFAULT_SIMULATED_PRINTERS) {
      printersByName.set(printer.name, printer);
    }

    for (const name of this.getConfiguredPrinterNames()) {
      if (!printersByName.has(name)) {
        printersByName.set(name, {
          name,
          online: true,
          statusText: "simulated"
        });
      }
    }

    return [...printersByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async print(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    this.logger.info("Simulated print operation", {
      role: request.role,
      printerName: request.printerName,
      templateId: request.templateId,
      copies: request.copies
    });

    return {
      ok: true,
      message: `Simulated print on ${request.printerName}.`
    };
  }

  async openDrawer(printerName: string): Promise<AdapterOperationResult> {
    this.logger.info("Simulated cash drawer operation", {
      printerName
    });

    return {
      ok: true,
      message: `Simulated drawer pulse on ${printerName}.`
    };
  }
}
