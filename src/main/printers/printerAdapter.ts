import type { PrinterRole, SystemPrinter } from "../../shared/protocol";

export interface AdapterPrintRequest {
  role: PrinterRole;
  printerName: string;
  paperName?: string | null;
  templateId: string;
  copies: number;
  payload: unknown;
}

export interface AdapterOperationResult {
  ok: boolean;
  message?: string;
  errorCode?: string;
}

export interface PrinterAdapter {
  listPrinters(): Promise<SystemPrinter[]>;
  print(request: AdapterPrintRequest): Promise<AdapterOperationResult>;
  openDrawer(printerName: string): Promise<AdapterOperationResult>;
}
