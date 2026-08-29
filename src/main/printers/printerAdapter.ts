import type { PrinterRole, ReceiptPrintMode, SystemPrinter } from "../../shared/protocol";

export interface AdapterPrintRequest {
  jobId?: string;
  role: PrinterRole;
  printerName: string;
  paperName?: string | null;
  templateId: string;
  copies: number;
  payload: unknown;
  receiptPrintMode?: ReceiptPrintMode;
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
