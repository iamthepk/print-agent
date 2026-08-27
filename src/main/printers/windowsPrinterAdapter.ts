import { app } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { PrinterPaperSize, PrinterRole, SystemPrinter } from "../../shared/protocol";
import type { Logger } from "../logging/logger";
import type { RuntimePaths } from "../runtimePaths";
import { generateKitchenLabelPng } from "../templates/kitchenLabelImageTemplate";
import { renderKitchenLabelEscPos, renderKitchenLabelText } from "../templates/kitchenLabelTemplate";
import { renderReceiptEscPos, renderReceiptText } from "../templates/receiptEscposTemplate";
import { generateReceiptPdf } from "../templates/receiptPdfTemplate";
import type { AdapterOperationResult, AdapterPrintRequest, PrinterAdapter } from "./printerAdapter";

const execFileAsync = promisify(execFile);

const RAW_PRINTER_SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$Base64Payload,
  [Parameter(Mandatory=$true)][string]$DocumentName
)

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinterBridge
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int Send(string printerName, byte[] bytes, string documentName)
    {
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr unmanagedBytes = IntPtr.Zero;
        bool docStarted = false;
        bool pageStarted = false;

        try
        {
            if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            DOCINFOA docInfo = new DOCINFOA();
            docInfo.pDocName = documentName;
            docInfo.pDataType = "RAW";

            if (!StartDocPrinter(hPrinter, 1, docInfo))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            docStarted = true;

            if (!StartPagePrinter(hPrinter))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            pageStarted = true;

            unmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, unmanagedBytes, bytes.Length);

            int written;
            if (!WritePrinter(hPrinter, unmanagedBytes, bytes.Length, out written))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            return written;
        }
        finally
        {
            if (unmanagedBytes != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(unmanagedBytes);
            }

            if (pageStarted)
            {
                EndPagePrinter(hPrinter);
            }

            if (docStarted)
            {
                EndDocPrinter(hPrinter);
            }

            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
        }
    }
}
'@

Add-Type -TypeDefinition $source
$bytes = [Convert]::FromBase64String($Base64Payload)
$written = [RawPrinterBridge]::Send($PrinterName, $bytes, $DocumentName)
@{ written = $written } | ConvertTo-Json -Compress
`;

const DRIVER_PRINT_SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$Base64Text,
  [Parameter(Mandatory=$true)][string]$DocumentName,
  [AllowEmptyString()][string]$SelectedPaperName,
  [Parameter(Mandatory=$true)][int]$Copies,
  [AllowEmptyString()][string]$LayoutMode = 'normal'
)

Add-Type -AssemblyName System.Drawing

function Apply-CurrentPrintConfiguration {
  param(
    [Parameter(Mandatory=$true)]$Doc,
    [Parameter(Mandatory=$true)][string]$PrinterName
  )

  try {
    $configuration = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($configuration.PrintTicketXML)) {
      return
    }

    $ticket = [xml]$configuration.PrintTicketXML
    $namespaces = New-Object System.Xml.XmlNamespaceManager($ticket.NameTable)
    $namespaces.AddNamespace('psf', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework')
    $namespaces.AddNamespace('psk', 'http://schemas.microsoft.com/windows/2003/08/printschemakeywords')

    $orientationNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageOrientation']/psf:Option", $namespaces)
    if ($null -ne $orientationNode) {
      $Doc.DefaultPageSettings.Landscape = $orientationNode.GetAttribute('name') -eq 'psk:Landscape'
    }

    $mediaNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageMediaSize']/psf:Option", $namespaces)
    if ($null -eq $mediaNode) {
      return
    }

    $widthNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeWidth']/psf:Value", $namespaces)
    $heightNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeHeight']/psf:Value", $namespaces)
    if ($null -eq $widthNode -or $null -eq $heightNode) {
      return
    }

    $targetWidth = [int][Math]::Round([double]$widthNode.InnerText / 254.0)
    $targetHeight = [int][Math]::Round([double]$heightNode.InnerText / 254.0)

    foreach ($paperSize in $Doc.PrinterSettings.PaperSizes) {
      $widthMatches = [Math]::Abs($paperSize.Width - $targetWidth) -le 2
      $heightMatches = [Math]::Abs($paperSize.Height - $targetHeight) -le 2
      if ($widthMatches -and $heightMatches) {
        $Doc.DefaultPageSettings.PaperSize = $paperSize
        break
      }
    }
  } catch {
  }
}

function Apply-RequestedPaperName {
  param(
    [Parameter(Mandatory=$true)]$Doc,
    [AllowEmptyString()][string]$PaperName
  )

  if ([string]::IsNullOrWhiteSpace($PaperName)) {
    return
  }

  foreach ($paperSize in $Doc.PrinterSettings.PaperSizes) {
    if ($paperSize.PaperName -eq $PaperName) {
      $Doc.DefaultPageSettings.PaperSize = $paperSize
      return
    }
  }

  throw "Printer '$($Doc.PrinterSettings.PrinterName)' does not support paper size '$PaperName'."
}

$text = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64Text))
$printed = 0
$selectedPaper = $null
$selectedLandscape = $false

for ($copy = 0; $copy -lt $Copies; $copy++) {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $font = $null
  $format = $null
  $handler = $null

  try {
    $doc.DocumentName = $DocumentName
    $doc.PrinterSettings.PrinterName = $PrinterName

    if (-not $doc.PrinterSettings.IsValid) {
      throw "Printer '$PrinterName' is not valid or is unavailable."
    }

    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $doc.OriginAtMargins = $true
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(2, 2, 2, 2)
    Apply-CurrentPrintConfiguration -Doc $doc -PrinterName $PrinterName
    Apply-RequestedPaperName -Doc $doc -PaperName $SelectedPaperName

    $paper = $doc.DefaultPageSettings.PaperSize
    $selectedPaper = $paper.PaperName
    $selectedLandscape = $doc.DefaultPageSettings.Landscape
    $fontSize = 10.0
    if ([Math]::Min($paper.Width, $paper.Height) -le 160) {
      $fontSize = 7.5
    }

    $font = New-Object System.Drawing.Font -ArgumentList 'Arial', ([single]$fontSize), ([System.Drawing.FontStyle]::Regular)
    $format = New-Object System.Drawing.StringFormat
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit

    $handler = [System.Drawing.Printing.PrintPageEventHandler]{
      param($sender, $event)

      $bounds = $event.MarginBounds
      if ($bounds.Width -lt 50 -or $bounds.Height -lt 50) {
        $bounds = $event.PageBounds
      }

      $layout = New-Object System.Drawing.RectangleF -ArgumentList ([single]$bounds.Left), ([single]$bounds.Top), ([single]$bounds.Width), ([single]$bounds.Height)

      if ($LayoutMode -eq 'label_rotate_90') {
        $event.Graphics.TranslateTransform([single]($bounds.Left + $bounds.Width), [single]$bounds.Top)
        $event.Graphics.RotateTransform(90.0)
        $rotatedLayout = New-Object System.Drawing.RectangleF -ArgumentList 0.0, 0.0, ([single]$bounds.Height), ([single]$bounds.Width)
        $event.Graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, $rotatedLayout, $format)
        $event.Graphics.ResetTransform()
      } elseif ($LayoutMode -eq 'label_rotate_180') {
        $event.Graphics.TranslateTransform([single]($bounds.Left + $bounds.Width), [single]($bounds.Top + $bounds.Height))
        $event.Graphics.RotateTransform(180.0)
        $rotatedLayout = New-Object System.Drawing.RectangleF -ArgumentList 0.0, 0.0, ([single]$bounds.Width), ([single]$bounds.Height)
        $event.Graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, $rotatedLayout, $format)
        $event.Graphics.ResetTransform()
      } else {
        $event.Graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, $layout, $format)
      }
      $event.HasMorePages = $false
    }

    $doc.add_PrintPage($handler)
    $doc.Print()
    $printed += 1
  } finally {
    if ($null -ne $handler) {
      $doc.remove_PrintPage($handler)
    }

    if ($null -ne $format) {
      $format.Dispose()
    }

    if ($null -ne $font) {
      $font.Dispose()
    }

    $doc.Dispose()
  }
}

@{ printed = $printed; paper = $selectedPaper; landscape = $selectedLandscape; layout = $LayoutMode } | ConvertTo-Json -Compress
`;

const DISCOVER_PRINTERS_SCRIPT = `
Add-Type -AssemblyName System.Drawing

function Get-ConfiguredPaper {
  param(
    [Parameter(Mandatory=$true)][string]$PrinterName,
    [Parameter(Mandatory=$true)]$Doc
  )

  $paperName = $null
  $landscape = $null

  try {
    $configuration = Get-PrintConfiguration -PrinterName $PrinterName -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($configuration.PrintTicketXML)) {
      return [pscustomobject]@{ PaperName = $paperName; Landscape = $landscape }
    }

    $ticket = [xml]$configuration.PrintTicketXML
    $namespaces = New-Object System.Xml.XmlNamespaceManager($ticket.NameTable)
    $namespaces.AddNamespace('psf', 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework')
    $namespaces.AddNamespace('psk', 'http://schemas.microsoft.com/windows/2003/08/printschemakeywords')

    $orientationNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageOrientation']/psf:Option", $namespaces)
    if ($null -ne $orientationNode) {
      $landscape = $orientationNode.GetAttribute('name') -eq 'psk:Landscape'
    }

    $mediaNode = $ticket.SelectSingleNode("//psf:Feature[@name='psk:PageMediaSize']/psf:Option", $namespaces)
    if ($null -eq $mediaNode) {
      return [pscustomobject]@{ PaperName = $paperName; Landscape = $landscape }
    }

    $widthNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeWidth']/psf:Value", $namespaces)
    $heightNode = $mediaNode.SelectSingleNode("psf:ScoredProperty[@name='psk:MediaSizeHeight']/psf:Value", $namespaces)
    if ($null -eq $widthNode -or $null -eq $heightNode) {
      return [pscustomobject]@{ PaperName = $paperName; Landscape = $landscape }
    }

    $targetWidth = [int][Math]::Round([double]$widthNode.InnerText / 254.0)
    $targetHeight = [int][Math]::Round([double]$heightNode.InnerText / 254.0)

    foreach ($paperSize in $Doc.PrinterSettings.PaperSizes) {
      $widthMatches = [Math]::Abs($paperSize.Width - $targetWidth) -le 2
      $heightMatches = [Math]::Abs($paperSize.Height - $targetHeight) -le 2
      if ($widthMatches -and $heightMatches) {
        $paperName = $paperSize.PaperName
        break
      }
    }
  } catch {
  }

  [pscustomobject]@{ PaperName = $paperName; Landscape = $landscape }
}

Get-Printer | ForEach-Object {
  $printer = $_
  $paperSizes = @()
  $defaultPaperName = $null
  $defaultLandscape = $null

  try {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    try {
      $doc.PrinterSettings.PrinterName = $printer.Name
      if ($doc.PrinterSettings.IsValid) {
        foreach ($paperSize in $doc.PrinterSettings.PaperSizes) {
          $paperSizes += [pscustomobject]@{
            Name = $paperSize.PaperName
            Width = $paperSize.Width
            Height = $paperSize.Height
          }
        }

        $defaultPaperName = $doc.DefaultPageSettings.PaperSize.PaperName
        $defaultLandscape = $doc.DefaultPageSettings.Landscape
        $configured = Get-ConfiguredPaper -PrinterName $printer.Name -Doc $doc

        if (-not [string]::IsNullOrWhiteSpace($configured.PaperName)) {
          $defaultPaperName = $configured.PaperName
        }

        if ($null -ne $configured.Landscape) {
          $defaultLandscape = $configured.Landscape
        }
      }
    } finally {
      $doc.Dispose()
    }
  } catch {
  }

  [pscustomobject]@{
    Name = $printer.Name
    PrinterStatus = $printer.PrinterStatus
    WorkOffline = $printer.WorkOffline
    Default = $printer.Default
    DriverName = $printer.DriverName
    DefaultPaperName = $defaultPaperName
    DefaultLandscape = $defaultLandscape
    PaperSizes = $paperSizes
  }
} | ConvertTo-Json -Depth 5 -Compress
`;

interface PowerShellPaperSize {
  Name?: string;
  Width?: number;
  Height?: number;
}

interface PowerShellPrinter {
  Name?: string;
  DriverName?: string;
  PrinterStatus?: string | number;
  WorkOffline?: boolean;
  Default?: boolean;
  DefaultPaperName?: string | null;
  DefaultLandscape?: boolean | null;
  PaperSizes?: PowerShellPaperSize | PowerShellPaperSize[];
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
      const { stdout } = await this.runPowerShellScript(DISCOVER_PRINTERS_SCRIPT, []);

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
    if (request.role === "receipt") {
      if ((request.receiptPrintMode ?? "pdf") === "pdf") {
        const pdfResult = await this.printReceiptPdfFallback(request);
        if (pdfResult.ok) {
          return pdfResult;
        }

        this.logger.warn("SumatraPDF receipt print failed, trying ESC/POS raw fallback", {
          printerName: request.printerName,
          message: pdfResult.message,
          errorCode: pdfResult.errorCode
        });
      }

      return this.printEscPosWithDriverFallback(request);
    }

    if (request.role === "kitchen" || this.isLabelPrinter(request.printerName)) {
      const imageResult = await this.printKitchenLabelImageFallback(request);
      if (imageResult.ok) {
        return imageResult;
      }

      this.logger.warn("Kitchen label image print failed, trying text fallback", {
        printerName: request.printerName,
        message: imageResult.message,
        errorCode: imageResult.errorCode
      });
    }

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

    if (this.shouldUseEscPosRaw(request)) {
      const rawResult = await this.printRawFallback(request);
      if (rawResult.ok) {
        return rawResult;
      }

      this.logger.warn("ESC/POS raw fallback failed, trying Windows driver fallback", {
        printerName: request.printerName,
        message: rawResult.message
      });
    }

    return this.printDriverFallback(request);
  }

  private async printKitchenLabelImageFallback(
    request: AdapterPrintRequest
  ): Promise<AdapterOperationResult> {
    if (process.platform !== "win32") {
      return {
        ok: false,
        errorCode: "unsupported_platform",
        message: "Kitchen label image printing is only available on Windows."
      };
    }

    const irfanViewPath = this.findIrfanViewPath();
    if (!irfanViewPath) {
      return {
        ok: false,
        errorCode: "irfanview_missing",
        message: "IrfanView was not found."
      };
    }

    let imagePath: string | null = null;

    try {
      imagePath = await generateKitchenLabelPng(request.payload, this.paths.dataDir);
      const copies = Math.max(1, Math.min(10, request.copies));

      for (let copy = 0; copy < copies; copy += 1) {
        await execFileAsync(irfanViewPath, [
          imagePath,
          `/print=${request.printerName}`,
          "/silent",
          "/hide"
        ], {
          timeout: 30000,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        });
      }

      this.logger.info("Printed kitchen label through IrfanView image path", {
        role: request.role,
        printerName: request.printerName,
        imagePath,
        copies,
        irfanViewPath
      });

      return {
        ok: true,
        message: `Printed kitchen label image through IrfanView on ${request.printerName}.`
      };
    } catch (error) {
      this.logger.warn("Kitchen label image print failed", {
        printerName: request.printerName,
        imagePath,
        message: error instanceof Error ? error.message : String(error)
      });
      return {
        ok: false,
        errorCode: "irfanview_print_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      if (imagePath) {
        setTimeout(() => {
          void fs.unlink(imagePath as string).catch(() => undefined);
        }, 5000);
      }
    }
  }

  private async printEscPosWithDriverFallback(
    request: AdapterPrintRequest
  ): Promise<AdapterOperationResult> {
    const rawResult = await this.printRawFallback(request);
    if (rawResult.ok) {
      return rawResult;
    }

    this.logger.warn("ESC/POS raw receipt print failed, trying Windows driver fallback", {
      printerName: request.printerName,
      message: rawResult.message,
      errorCode: rawResult.errorCode
    });

    return this.printDriverFallback(request);
  }

  async openDrawer(printerName: string): Promise<AdapterOperationResult> {
    const result = await this.runHelper({
      operation: "open_drawer",
      printerName
    });

    if (result.ok || result.errorCode !== "helper_missing") {
      return result;
    }

    return this.openDrawerRawFallback(printerName);
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
      isDefault: printer.Default === true,
      driverName: typeof printer.DriverName === "string" ? printer.DriverName : undefined,
      defaultPaperName: typeof printer.DefaultPaperName === "string" ? printer.DefaultPaperName : null,
      defaultLandscape: typeof printer.DefaultLandscape === "boolean" ? printer.DefaultLandscape : null,
      paperSizes: this.mapPaperSizes(printer.PaperSizes, printer.DefaultPaperName)
    };
  }

  private mapPaperSizes(
    paperSizes: PowerShellPrinter["PaperSizes"],
    defaultPaperName: PowerShellPrinter["DefaultPaperName"]
  ): PrinterPaperSize[] {
    const values = Array.isArray(paperSizes)
      ? paperSizes
      : paperSizes
        ? [paperSizes]
        : [];
    const seen = new Set<string>();
    const defaultName = typeof defaultPaperName === "string" ? defaultPaperName : null;

    return values
      .filter((paperSize) => typeof paperSize.Name === "string" && paperSize.Name.trim())
      .map((paperSize) => ({
        name: String(paperSize.Name),
        width: typeof paperSize.Width === "number" ? paperSize.Width : 0,
        height: typeof paperSize.Height === "number" ? paperSize.Height : 0,
        isDefault: defaultName === paperSize.Name
      }))
      .filter((paperSize) => {
        if (seen.has(paperSize.name)) {
          return false;
        }
        seen.add(paperSize.name);
        return true;
      });
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

  private async printDriverFallback(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    if (process.platform !== "win32") {
      return {
        ok: false,
        errorCode: "unsupported_platform",
        message: "Windows driver fallback is only available on Windows."
      };
    }

    try {
      const copies = Math.max(1, Math.min(10, request.copies));
      const document = this.renderDriverDocument(request);
      const { stdout } = await this.runPowerShellScript(DRIVER_PRINT_SCRIPT, [
        request.printerName,
        Buffer.from(document, "utf8").toString("base64"),
        this.getDocumentName(request),
        request.paperName ?? "",
        String(copies),
        this.getDriverLayoutMode(request)
      ]);
      const parsed = JSON.parse(stdout.trim() || "{}") as {
        printed?: number;
        paper?: string;
        landscape?: boolean;
        layout?: string;
      };

      this.logger.info("Printed through Windows driver fallback", {
        role: request.role,
        printerName: request.printerName,
        paperName: request.paperName ?? null,
        copies: parsed.printed ?? copies,
        paper: parsed.paper,
        landscape: parsed.landscape,
        layout: parsed.layout
      });

      return {
        ok: true,
        message: `Printed through Windows driver fallback on ${request.printerName}.`
      };
    } catch (error) {
      this.logger.warn("Windows driver fallback print failed", {
        message: error instanceof Error ? error.message : String(error),
        printerName: request.printerName
      });
      return {
        ok: false,
        errorCode: "windows_driver_print_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async printReceiptPdfFallback(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    if (process.platform !== "win32") {
      return {
        ok: false,
        errorCode: "unsupported_platform",
        message: "SumatraPDF receipt printing is only available on Windows."
      };
    }

    const sumatraPath = this.findSumatraPdfPath();
    if (!sumatraPath) {
      return {
        ok: false,
        errorCode: "sumatra_missing",
        message: "SumatraPDF.exe was not found."
      };
    }

    let pdfPath: string | null = null;
    try {
      pdfPath = await generateReceiptPdf(request.payload, this.paths.dataDir);
      const copies = Math.max(1, Math.min(10, request.copies));

      for (let copy = 0; copy < copies; copy += 1) {
        await execFileAsync(sumatraPath, [
          "-print-to",
          request.printerName,
          "-silent",
          pdfPath
        ], {
          timeout: 30000,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        });
      }

      this.logger.info("Printed receipt through SumatraPDF", {
        role: request.role,
        printerName: request.printerName,
        pdfPath,
        sumatraPath,
        copies
      });

      return {
        ok: true,
        message: `Printed receipt through SumatraPDF on ${request.printerName}.`
      };
    } catch (error) {
      this.logger.warn("SumatraPDF receipt print failed", {
        printerName: request.printerName,
        pdfPath,
        message: error instanceof Error ? error.message : String(error)
      });
      return {
        ok: false,
        errorCode: "sumatra_print_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      if (pdfPath) {
        setTimeout(() => {
          void fs.unlink(pdfPath as string).catch(() => undefined);
        }, 5000);
      }
    }
  }

  private renderDriverDocument(request: AdapterPrintRequest): string {
    if (request.role === "kitchen" || this.isLabelPrinter(request.printerName)) {
      return renderKitchenLabelText(request.payload);
    }

    return renderReceiptText(request.payload);
  }

  private async printRawFallback(request: AdapterPrintRequest): Promise<AdapterOperationResult> {
    const payload = this.buildEscPosPrintPayload(request);
    const result = await this.sendRawBytes(
      request.printerName,
      payload,
      this.getDocumentName(request)
    );

    if (!result.ok) {
      return result;
    }

    this.logger.info("Printed through ESC/POS raw fallback", {
      role: request.role,
      printerName: request.printerName,
      copies: request.copies
    });

    return {
      ok: true,
      message: `Printed through ESC/POS raw fallback on ${request.printerName}.`
    };
  }

  private async openDrawerRawFallback(printerName: string): Promise<AdapterOperationResult> {
    const result = await this.sendRawBytes(
      printerName,
      Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]),
      "Print Agent drawer pulse"
    );

    if (!result.ok) {
      return result;
    }

    this.logger.info("Opened drawer through ESC/POS raw fallback", {
      printerName
    });

    return {
      ok: true,
      message: `Sent ESC/POS drawer pulse to ${printerName}.`
    };
  }

  private async sendRawBytes(
    printerName: string,
    payload: Buffer,
    documentName: string
  ): Promise<AdapterOperationResult> {
    if (process.platform !== "win32") {
      return {
        ok: false,
        errorCode: "unsupported_platform",
        message: "Raw printer fallback is only available on Windows."
      };
    }

    try {
      const { stdout } = await this.runPowerShellScript(RAW_PRINTER_SCRIPT, [
        printerName,
        payload.toString("base64"),
        documentName
      ]);
      const parsed = JSON.parse(stdout.trim() || "{}") as { written?: number };

      return {
        ok: true,
        message: `Accepted ${parsed.written ?? payload.length} raw bytes.`
      };
    } catch (error) {
      this.logger.warn("Raw printer fallback failed", {
        printerName,
        message: error instanceof Error ? error.message : String(error)
      });

      return {
        ok: false,
        errorCode: "raw_print_failed",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async runPowerShellScript(
    script: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string }> {
    const scriptFile = path.join(
      this.paths.dataDir,
      `print-agent-script-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`
    );

    try {
      await fs.writeFile(scriptFile, script, "utf8");
      return await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptFile,
        ...args
      ], {
        timeout: 30000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });
    } finally {
      await fs.unlink(scriptFile).catch(() => undefined);
    }
  }

  private buildEscPosPrintPayload(request: AdapterPrintRequest): Buffer {
    const copies = Math.max(1, Math.min(10, request.copies));
    const chunks: Buffer[] = [];

    for (let copy = 0; copy < copies; copy += 1) {
      chunks.push(
        request.role === "kitchen"
          ? renderKitchenLabelEscPos(request.payload)
          : renderReceiptEscPos(request.payload)
      );
    }

    return Buffer.concat(chunks);
  }

  private getDocumentName(request: AdapterPrintRequest): string {
    const templateName = request.templateId || `${request.role}.default`;
    return `Print Agent ${request.role} ${templateName}`;
  }

  private getDriverLayoutMode(request: AdapterPrintRequest): string {
    return request.role === "kitchen" || this.isLabelPrinter(request.printerName)
      ? "label_rotate_90"
      : "normal";
  }

  private findSumatraPdfPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath ?? "", "vendor", "sumatra", "SumatraPDF.exe"),
      process.env.SUMATRA_PATH,
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "SumatraPDF", "SumatraPDF.exe")
        : null,
      path.join("C:", "Program Files", "SumatraPDF", "SumatraPDF.exe"),
      path.join("C:", "Program Files (x86)", "SumatraPDF", "SumatraPDF.exe")
    ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

    for (const candidate of candidates) {
      const normalized = candidate.replace(/^"|"$/g, "");
      if (existsSync(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  private findIrfanViewPath(): string | null {
    const candidates = [
      path.join(process.resourcesPath ?? "", "vendor", "irfanview", "i_view64.exe"),
      path.join(process.resourcesPath ?? "", "vendor", "irfanview", "i_view32.exe"),
      process.env.IRFANVIEW_PATH,
      path.join("C:", "Program Files", "IrfanView", "i_view64.exe"),
      path.join("C:", "Program Files", "IrfanView", "i_view32.exe"),
      process.env["ProgramFiles(x86)"]
        ? path.join(process.env["ProgramFiles(x86)"], "IrfanView", "i_view64.exe")
        : null,
      process.env["ProgramFiles(x86)"]
        ? path.join(process.env["ProgramFiles(x86)"], "IrfanView", "i_view32.exe")
        : null
    ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));

    for (const candidate of candidates) {
      const normalized = candidate.replace(/^"|"$/g, "");
      if (existsSync(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  private shouldUseEscPosRaw(request: AdapterPrintRequest): boolean {
    const printerName = request.printerName.toUpperCase();
    return request.role === "receipt"
      || printerName.includes("EPSON")
      || printerName.includes("TM-")
      || printerName.includes("ESC/POS");
  }

  private isLabelPrinter(printerName: string): boolean {
    const normalized = printerName.toUpperCase();
    return normalized.includes("BROTHER")
      || normalized.includes("QL-")
      || normalized.includes("LABEL");
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
