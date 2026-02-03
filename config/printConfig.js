import dotenv from 'dotenv';

dotenv.config();

/**
 * helpers
 */
const readString = (key, fallback) => {
  const v = process.env[key];
  return (v === undefined || v === null || v === '') ? fallback : v;
};

const readInt = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback; // nebo throw, viz níž
  return n;
};

const readBool = (key, fallback = false) => {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;
  return fallback; // nebo throw
};

const oneOf = (key, allowed, fallback) => {
  const v = readString(key, fallback);
  return allowed.includes(v) ? v : fallback;
};

// ============================================
// PRINTER NAMES
// ============================================

export const RECEIPT_PRINTER = readString('RECEIPT_PRINTER', 'EPSON TM-T20III Receipt');
export const STICKER_PRINTER = readString('STICKER_PRINTER', 'Brother QL-700');

// ============================================
// RECEIPT PRINTING METHOD
// ============================================

export const RECEIPT_METHOD = oneOf('RECEIPT_METHOD', ['pdf', 'escpos'], 'pdf');
export const RECEIPT_FALLBACK_METHOD = oneOf('RECEIPT_FALLBACK_METHOD', ['escpos', 'pdf', 'none'], 'escpos');
export const RECEIPT_STRICT_MODE = readBool('RECEIPT_STRICT_MODE', false);

// ============================================
// ESC/POS ENCODING & FORMATTING
// ============================================

export const RECEIPT_ENCODING_MODE = oneOf('RECEIPT_ENCODING_MODE', ['utf8', 'codepage'], 'utf8');
export const RECEIPT_CODEPAGE = oneOf('RECEIPT_CODEPAGE', ['cp852', 'cp850', 'cp866'], 'cp852');

export const RECEIPT_CHARS_PER_LINE = readInt('RECEIPT_CHARS_PER_LINE', 48);
export const RECEIPT_FONT = readInt('RECEIPT_FONT', 0);

// ============================================
// RAW SEND METHOD (WINDOWS SPOOLER)
// ============================================

export const RAW_SEND_METHOD = oneOf('RAW_SEND_METHOD', ['winspooler', 'unc_copy'], 'winspooler');
export const RAW_SEND_FALLBACK = oneOf('RAW_SEND_FALLBACK', ['unc_copy', 'none'], 'unc_copy');
export const WINSPOOLER_HELPER_PATH = readString('WINSPOOLER_HELPER_PATH', './WinSpoolerHelper.exe');

// ============================================
// PDF RECEIPT MARGINS (80mm thermal)
// ============================================

export const RECEIPT_PDF_TOP_MARGIN = readInt('RECEIPT_PDF_TOP_MARGIN', 10);
export const RECEIPT_PDF_LEFT_MARGIN = readInt('RECEIPT_PDF_LEFT_MARGIN', 0);
export const RECEIPT_PDF_RIGHT_MARGIN = readInt('RECEIPT_PDF_RIGHT_MARGIN', 0);

// ============================================
// PDF/SUMATRA SETTINGS (LEGACY)
// ============================================

export const SUMATRA_PATH = readString(
  'SUMATRA_PATH',
  'C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe'
);

// ============================================
// EXPORT CONFIG OBJECT
// ============================================

export const printConfig = Object.freeze({
  RECEIPT_PRINTER,
  STICKER_PRINTER,

  RECEIPT_METHOD,
  RECEIPT_FALLBACK_METHOD,
  RECEIPT_STRICT_MODE,

  RECEIPT_ENCODING_MODE,
  RECEIPT_CODEPAGE,
  RECEIPT_CHARS_PER_LINE,
  RECEIPT_FONT,

  RAW_SEND_METHOD,
  RAW_SEND_FALLBACK,
  WINSPOOLER_HELPER_PATH,

  RECEIPT_PDF_TOP_MARGIN,
  RECEIPT_PDF_LEFT_MARGIN,
  RECEIPT_PDF_RIGHT_MARGIN,

  SUMATRA_PATH,
});

export default printConfig;
