import type { SystemPrinter } from "../../shared/protocol";
import type { ConfigService } from "../config/configService";
import type { AdapterOperationResult, AdapterPrintRequest, PrinterAdapter } from "./printerAdapter";

export class ConfigurablePrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly configService: ConfigService,
    private readonly windowsAdapter: PrinterAdapter,
    private readonly simulatedAdapter: PrinterAdapter
  ) {}

  async listPrinters(): Promise<SystemPrinter[]> {
    return this.activeAdapter().listPrinters();
  }

  async print(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    return this.activeAdapter().print(request);
  }

  async openDrawer(printerName: string): Promise<AdapterOperationResult> {
    return this.activeAdapter().openDrawer(printerName);
  }

  private activeAdapter(): PrinterAdapter {
    return this.configService.getPublicConfig().printerAdapterMode === "simulated"
      ? this.simulatedAdapter
      : this.windowsAdapter;
  }
}
