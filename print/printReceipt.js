import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateReceiptPDF } from '../templates/receiptTemplateDynamic.js';
import { renderReceiptEscpos } from './printReceiptEscpos.js';
import { sendRawToPrinter, sendRawToPrinterUncCopy } from './rawPrinter.js';
import { printConfig } from '../config/printConfig.js';

dotenv.config();

const execAsync = promisify(exec);

/**
 * Print receipt using ESC/POS raw printing
 * @param {Object} order - Receipt data
 * @returns {Promise<Object>} Result with status and details
 */
async function printReceiptEscpos(order) {
  const startTime = Date.now();

  try {
    console.log(`📄 ============================================`);
    console.log(`📄 Using ESC/POS raw printing`);
    console.log(`📄 Receipt Number: ${order.receipt_number || order.receiptNumber || 'N/A'}`);
    console.log(`📄 Printer: ${printConfig.RECEIPT_PRINTER}`);
    console.log(`📄 Encoding: ${printConfig.RECEIPT_ENCODING_MODE}`);
    console.log(`📄 Chars per line: ${printConfig.RECEIPT_CHARS_PER_LINE}`);
    console.log(`📄 ============================================`);

    // Render receipt to ESC/POS buffer
    const escposBuffer = await renderReceiptEscpos(order, {
      charsPerLine: printConfig.RECEIPT_CHARS_PER_LINE,
      encoding: printConfig.RECEIPT_ENCODING_MODE,
      codepage: printConfig.RECEIPT_CODEPAGE,
      font: printConfig.RECEIPT_FONT
    });

    console.log(`📄 ESC/POS buffer generated: ${escposBuffer.length} bytes`);

    // Try primary method first
    let result;
    try {
      result = await sendRawToPrinter(escposBuffer, printConfig.RECEIPT_PRINTER);
    } catch (primaryError) {
      console.warn('⚠️ Primary raw print method failed, trying UNC copy fallback...');
      // Fallback to UNC copy command
      result = await sendRawToPrinterUncCopy(escposBuffer, printConfig.RECEIPT_PRINTER);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ ESC/POS receipt printed successfully (${duration}ms)`);

    return {
      status: 'ok',
      message: 'Receipt printed via ESC/POS',
      method: 'escpos',
      fallbackUsed: false,
      durationMs: duration,
      bytesWritten: escposBuffer.length,
      printer: printConfig.RECEIPT_PRINTER,
      // Include RAW send method info from result
      rawSendMethodUsed: result.method || 'unknown',
      rawSendFallbackUsed: result.rawSendFallbackUsed || false
    };

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('❌ ESC/POS printing failed:', err.message);

    throw {
      status: 'error',
      message: err.message || 'ESC/POS printing failed',
      method: 'escpos',
      durationMs: duration,
      printer: printConfig.RECEIPT_PRINTER
    };
  }
}

/**
 * Print receipt using PDF + SumatraPDF (legacy method)
 * @param {Object} order - Receipt data
 * @returns {Promise<Object>} Result with status and details
 */
async function printReceiptPDF(order) {
  const startTime = Date.now();

  try {
    console.log(`📄 ============================================`);
    console.log(`📄 Using PDF printing (legacy)`);
    console.log(`📄 Receipt Number: ${order.receipt_number || order.receiptNumber || 'N/A'}`);
    console.log(`📄 Printer: ${printConfig.RECEIPT_PRINTER}`);
    console.log(`📄 ============================================`);

    // Generate PDF (with configurable margins to fix horizontal shift and top empty space)
    const pdfPath = await generateReceiptPDF(order, {
      pdfTopMargin: printConfig.RECEIPT_PDF_TOP_MARGIN,
      pdfLeftMargin: printConfig.RECEIPT_PDF_LEFT_MARGIN,
      pdfRightMargin: printConfig.RECEIPT_PDF_RIGHT_MARGIN
    });
    console.log(`📄 PDF generated: ${pdfPath}`);

    // Wait for file to be fully written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check SumatraPDF exists
    const sumatraPathClean = printConfig.SUMATRA_PATH.replace(/"/g, '');
    if (!fs.existsSync(sumatraPathClean)) {
      throw new Error(`SumatraPDF.exe not found at: ${sumatraPathClean}`);
    }

    // Check PDF exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not created at: ${pdfPath}`);
    }

    // Print via SumatraPDF
    const command = `${printConfig.SUMATRA_PATH} -print-to "${printConfig.RECEIPT_PRINTER}" -silent "${pdfPath}"`;
    console.log('🖨️ Printing via SumatraPDF (silent mode)');

    const { stdout, stderr } = await execAsync(command, {
      windowsHide: true,
      timeout: 30000
    });

    if (stderr) {
      console.error('⚠️ SumatraPDF warning:', stderr);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ PDF receipt printed successfully (${duration}ms)`);

    // Clean up PDF after delay
    setTimeout(() => {
      try {
        fs.unlinkSync(pdfPath);
        console.log('🗑️ Temporary PDF file deleted');
      } catch (e) {
        console.warn('⚠️ Could not delete temporary PDF file:', e.message);
      }
    }, 5000);

    return {
      status: 'ok',
      message: 'Receipt printed via PDF',
      method: 'pdf',
      fallbackUsed: false,
      durationMs: duration,
      pdfPath: pdfPath,
      printer: printConfig.RECEIPT_PRINTER
    };

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('❌ PDF printing failed:', err.message);

    throw {
      status: 'error',
      message: err.message || 'PDF printing failed',
      method: 'pdf',
      durationMs: duration,
      printer: printConfig.RECEIPT_PRINTER
    };
  }
}

/**
 * Main receipt printing function with method selection and fallback
 * @param {Object} order - Receipt data
 * @param {Object} options - Printing options (can override config)
 * @returns {Promise<Object>} Result with status and details
 */
async function printReceipt(order, options = {}) {
  const startTime = Date.now();

  // Determine method (options can override config)
  const method = options.method || printConfig.RECEIPT_METHOD;
  const fallbackMethod = options.fallbackMethod || printConfig.RECEIPT_FALLBACK_METHOD;
  const strictMode = options.strictMode !== undefined ? options.strictMode : printConfig.RECEIPT_STRICT_MODE;

  console.log(`🖨️ ============================================`);
  console.log(`🖨️ RECEIPT PRINTING`);
  console.log(`🖨️ Primary method: ${method}`);
  console.log(`🖨️ Fallback method: ${fallbackMethod}`);
  console.log(`🖨️ Strict mode: ${strictMode}`);
  console.log(`🖨️ ============================================`);

  let result;
  let usedFallback = false;

  try {
    // Try primary method
    if (method === 'escpos') {
      result = await printReceiptEscpos(order);
    } else if (method === 'pdf') {
      result = await printReceiptPDF(order);
    } else {
      throw new Error(`Unknown print method: ${method}`);
    }

    return result;

  } catch (primaryError) {
    console.error(`❌ Primary method (${method}) failed:`, primaryError.message);

    // Check if fallback is allowed
    if (strictMode) {
      console.error('⛔ Strict mode enabled - no fallback, returning error');
      const duration = Date.now() - startTime;
      throw {
        status: 'error',
        message: `Print failed (strict mode): ${primaryError.message}`,
        method: method,
        fallbackUsed: false,
        durationMs: duration,
        error: primaryError.message
      };
    }

    // Check if fallback method is available
    if (!fallbackMethod || fallbackMethod === 'none') {
      console.error('⛔ No fallback method configured - returning error');
      const duration = Date.now() - startTime;
      throw {
        status: 'error',
        message: `Print failed (no fallback): ${primaryError.message}`,
        method: method,
        fallbackUsed: false,
        durationMs: duration,
        error: primaryError.message
      };
    }

    // Try fallback method
    console.log(`🔄 Attempting fallback method: ${fallbackMethod}`);
    usedFallback = true;

    try {
      if (fallbackMethod === 'escpos') {
        result = await printReceiptEscpos(order);
      } else if (fallbackMethod === 'pdf') {
        result = await printReceiptPDF(order);
      } else {
        throw new Error(`Unknown fallback method: ${fallbackMethod}`);
      }

      // Mark that fallback was used
      result.fallbackUsed = true;
      result.primaryMethodFailed = method;
      result.primaryMethodError = primaryError.message;

      const duration = Date.now() - startTime;
      result.durationMs = duration;

      console.log(`✅ Fallback successful after ${duration}ms`);

      return result;

    } catch (fallbackError) {
      console.error(`❌ Fallback method (${fallbackMethod}) also failed:`, fallbackError.message);

      const duration = Date.now() - startTime;

      throw {
        status: 'error',
        message: `Both print methods failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`,
        method: method,
        fallbackMethod: fallbackMethod,
        fallbackUsed: true,
        durationMs: duration,
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      };
    }
  }
}

export { printReceipt, printReceiptEscpos, printReceiptPDF };
