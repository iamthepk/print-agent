import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized print agent configuration
 * Single source of truth for all printer settings
 */

// ============================================
// PRINTER NAMES
// ============================================

export const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt';
export const STICKER_PRINTER = process.env.STICKER_PRINTER || 'Brother QL-700';

// ============================================
// RECEIPT PRINTING METHOD
// ============================================

/**
 * RECEIPT_METHOD: Primary method for receipt printing
 * - "pdf" = PDF via SumatraPDF (default, has length limit ~280mm)
 * - "escpos" = ESC/POS raw printing (unlimited length, fast)
 */
export const RECEIPT_METHOD = process.env.RECEIPT_METHOD || 'pdf';

/**
 * RECEIPT_FALLBACK_METHOD: Fallback if primary method fails
 * - "escpos" = fallback to ESC/POS raw printing
 * - "pdf" = fallback to PDF method
 * - "none" = no fallback, return error
 */
export const RECEIPT_FALLBACK_METHOD = process.env.RECEIPT_FALLBACK_METHOD || 'escpos';

/**
 * RECEIPT_STRICT_MODE: Control fallback behavior
 * - true = if ESC/POS fails, DO NOT fallback (return error)
 * - false = allow fallback to RECEIPT_FALLBACK_METHOD
 */
export const RECEIPT_STRICT_MODE = process.env.RECEIPT_STRICT_MODE === 'true' || false;

// ============================================
// ESC/POS ENCODING & FORMATTING
// ============================================

/**
 * RECEIPT_ENCODING_MODE: Character encoding for ESC/POS
 * - "utf8" = prefer UTF-8 (modern printers)
 * - "codepage" = use codepage (e.g. CP852 for Czech)
 */
export const RECEIPT_ENCODING_MODE = process.env.RECEIPT_ENCODING_MODE || 'utf8';

/**
 * RECEIPT_CODEPAGE: Codepage for ESC/POS when UTF-8 not supported
 * - "cp852" = Central European (Czech, Polish, Hungarian)
 * - "cp850" = Western European
 * - "cp866" = Cyrillic
 */
export const RECEIPT_CODEPAGE = process.env.RECEIPT_CODEPAGE || 'cp852';

/**
 * RECEIPT_CHARS_PER_LINE: Characters per line for 80mm receipts
 * Default: 48 for standard ESC/POS font
 */
export const RECEIPT_CHARS_PER_LINE = parseInt(process.env.RECEIPT_CHARS_PER_LINE || '48', 10);

/**
 * RECEIPT_FONT: Font selection for ESC/POS
 * - 0 = Font A (12x24 dots) - default, largest
 * - 1 = Font B (9x17 dots) - medium
 * - 48 = Font C (8x16 dots) - smallest
 */
export const RECEIPT_FONT = parseInt(process.env.RECEIPT_FONT || '0', 10);

// ============================================
// RAW SEND METHOD (WINDOWS SPOOLER)
// ============================================

/**
 * RAW_SEND_METHOD: Method for sending raw bytes to printer
 * - "winspooler" = Use WinSpoolerHelper.exe (Windows API, recommended)
 * - "unc_copy" = Use UNC path + copy command (legacy, fallback)
 */
export const RAW_SEND_METHOD = process.env.RAW_SEND_METHOD || 'winspooler';

/**
 * RAW_SEND_FALLBACK: Fallback method if primary fails
 * - "unc_copy" = fallback to copy command
 * - "none" = no fallback
 */
export const RAW_SEND_FALLBACK = process.env.RAW_SEND_FALLBACK || 'unc_copy';

/**
 * WINSPOOLER_HELPER_PATH: Path to WinSpoolerHelper.exe
 * Default: ./WinSpoolerHelper.exe (in print agent root)
 */
export const WINSPOOLER_HELPER_PATH = process.env.WINSPOOLER_HELPER_PATH || './WinSpoolerHelper.exe';

// ============================================
// PDF RECEIPT MARGINS (80mm thermal)
// ============================================

/**
 * RECEIPT_PDF_TOP_MARGIN: PDF top margin in points (1 pt ≈ 0.35 mm).
 * Default 10 = small gap. Set 0 for no gap; was 38 (≈13 mm) before, often caused ~2 cm empty space with driver.
 */
export const RECEIPT_PDF_TOP_MARGIN = parseInt(process.env.RECEIPT_PDF_TOP_MARGIN ?? '10', 10);

/**
 * RECEIPT_PDF_LEFT_MARGIN, RECEIPT_PDF_RIGHT_MARGIN: PDF layout (points)
 * Default 0/0 = full width (226pt for 80mm), content spread across entire receipt.
 * Increase only if your printer/driver crops edges.
 */
export const RECEIPT_PDF_LEFT_MARGIN = parseInt(process.env.RECEIPT_PDF_LEFT_MARGIN ?? '0', 10);
export const RECEIPT_PDF_RIGHT_MARGIN = parseInt(process.env.RECEIPT_PDF_RIGHT_MARGIN ?? '0', 10);

// ============================================
// PDF/SUMATRA SETTINGS (LEGACY)
// ============================================

export const SUMATRA_PATH = process.env.SUMATRA_PATH || `"C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

// ============================================
// EXPORT CONFIG OBJECT
// ============================================

export const printConfig = {
  // Printer names
  RECEIPT_PRINTER,
  STICKER_PRINTER,
  
  // Receipt method
  RECEIPT_METHOD,
  RECEIPT_FALLBACK_METHOD,
  RECEIPT_STRICT_MODE,
  
  // ESC/POS settings
  RECEIPT_ENCODING_MODE,
  RECEIPT_CODEPAGE,
  RECEIPT_CHARS_PER_LINE,
  RECEIPT_FONT,
  
  // RAW send method
  RAW_SEND_METHOD,
  RAW_SEND_FALLBACK,
  WINSPOOLER_HELPER_PATH,
  
  // PDF receipt margins (fix horizontal shift / top empty space)
  RECEIPT_PDF_TOP_MARGIN,
  RECEIPT_PDF_LEFT_MARGIN,
  RECEIPT_PDF_RIGHT_MARGIN,

  // Legacy PDF settings
  SUMATRA_PATH
};

export default printConfig;
