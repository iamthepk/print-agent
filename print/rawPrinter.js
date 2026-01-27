import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { printConfig } from '../config/printConfig.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Windows RAW Printer Module (Enhanced)
 * Primary: WinSpoolerHelper.exe (Windows Spooler API)
 * Fallback: UNC path + copy command (legacy)
 */

/**
 * Check if WinSpoolerHelper.exe is available
 * @returns {Promise<boolean>}
 */
export async function isWinSpoolerHelperAvailable() {
  try {
    const helperPath = getWinSpoolerHelperPath();
    return fs.existsSync(helperPath);
  } catch {
    return false;
  }
}

/**
 * Get absolute path to WinSpoolerHelper.exe
 * @returns {string}
 */
function getWinSpoolerHelperPath() {
  const configPath = printConfig.WINSPOOLER_HELPER_PATH;

  // If absolute path, use as-is
  if (path.isAbsolute(configPath)) {
    return configPath;
  }

  // If relative, resolve from project root (one level up from print/)
  const projectRoot = path.join(__dirname, '..');
  return path.resolve(projectRoot, configPath);
}

/**
 * Send raw bytes to Windows printer using WinSpoolerHelper.exe (Windows Spooler API)
 * Most reliable method - uses OpenPrinter, WritePrinter, etc.
 * 
 * @param {Buffer} data - Raw bytes to send to printer
 * @param {string} printerName - Windows printer name
 * @param {string} jobName - Optional job name
 * @returns {Promise<Object>} Result with status and details
 */
export async function sendRawToPrinterWinSpooler(data, printerName, jobName = 'ESC/POS Receipt') {
  const startTime = Date.now();

  try {
    if (!data || data.length === 0) {
      throw new Error('No data to print');
    }

    if (!printerName) {
      throw new Error('Printer name is required');
    }

    // Check if helper exists
    const helperPath = getWinSpoolerHelperPath();
    if (!fs.existsSync(helperPath)) {
      throw new Error(`WinSpoolerHelper.exe not found at: ${helperPath}`);
    }

    // Create temp file for raw data
    const tempDir = path.join(os.tmpdir(), 'print-agent');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const tempFile = path.join(tempDir, `receipt_escpos_${timestamp}.bin`);

    // Write raw bytes to temp file
    fs.writeFileSync(tempFile, data);

    console.log(`📄 Sending ${data.length} bytes to printer via WinSpooler: ${printerName}`);
    console.log(`📄 Helper: ${helperPath}`);

    // Call WinSpoolerHelper.exe
    // Args: <printerName> <filePath> [jobName]
    const { stdout, stderr } = await execFileAsync(helperPath, [printerName, tempFile, jobName], {
      timeout: 30000,
      windowsHide: true
    });

    // Clean up temp file
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (e) {
        console.warn('⚠️ Could not delete temp file:', e.message);
      }
    }, 5000);

    const duration = Date.now() - startTime;

    // Check output
    if (stdout.includes('OK:')) {
      console.log(`✅ WinSpooler print successful (${duration}ms)`);

      return {
        status: 'ok',
        message: 'Raw data sent to printer via WinSpooler',
        durationMs: duration,
        bytesWritten: data.length,
        printer: printerName,
        method: 'winspooler'
      };
    } else {
      throw new Error(stderr || 'WinSpoolerHelper returned non-OK status');
    }

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ WinSpooler print failed (${duration}ms):`, error.message);

    throw {
      status: 'error',
      message: error.message,
      durationMs: duration,
      printer: printerName,
      method: 'winspooler'
    };
  }
}

/**
 * Send raw bytes using UNC path + copy command (legacy fallback)
 * 
 * @param {Buffer} data - Raw bytes to send to printer
 * @param {string} printerName - Windows printer name
 * @returns {Promise<Object>} Result with status and details
 */
export async function sendRawToPrinterUncCopy(data, printerName) {
  const startTime = Date.now();

  try {
    if (!data || data.length === 0) {
      throw new Error('No data to print');
    }

    if (!printerName) {
      throw new Error('Printer name is required');
    }

    // Create temp file
    const tempDir = path.join(os.tmpdir(), 'print-agent');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, `receipt_${Date.now()}.bin`);
    fs.writeFileSync(tempFile, data);

    // Use Windows copy command with /B (binary) flag
    const command = `copy /B "${tempFile}" "\\\\localhost\\${printerName}"`;

    console.log(`📄 Sending ${data.length} bytes to printer via UNC copy: ${printerName}`);

    const { stdout, stderr } = await execAsync(command, {
      windowsHide: true,
      timeout: 30000
    });

    // Clean up
    setTimeout(() => {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (e) {
        console.warn('⚠️ Could not delete temp file:', e.message);
      }
    }, 5000);

    const duration = Date.now() - startTime;

    console.log(`✅ UNC copy print successful (${duration}ms)`);

    return {
      status: 'ok',
      message: 'Raw data sent to printer via UNC copy',
      durationMs: duration,
      bytesWritten: data.length,
      printer: printerName,
      method: 'unc_copy'
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ UNC copy print failed (${duration}ms):`, error.message);

    throw {
      status: 'error',
      message: error.message,
      durationMs: duration,
      printer: printerName,
      method: 'unc_copy'
    };
  }
}

/**
 * Main function: Send raw bytes to printer with method selection and fallback
 * 
 * @param {Buffer} data - Raw bytes to send to printer
 * @param {string} printerName - Windows printer name
 * @param {Object} options - Options (jobName, method, fallback)
 * @returns {Promise<Object>} Result with status and details
 */
export async function sendRawToPrinter(data, printerName, options = {}) {
  const {
    jobName = 'ESC/POS Receipt',
    method = printConfig.RAW_SEND_METHOD,
    fallback = printConfig.RAW_SEND_FALLBACK
  } = options;

  console.log(`🖨️ RAW Send - Method: ${method}, Fallback: ${fallback}`);

  let result;
  let usedFallback = false;

  try {
    // Try primary method
    if (method === 'winspooler') {
      result = await sendRawToPrinterWinSpooler(data, printerName, jobName);
    } else if (method === 'unc_copy') {
      result = await sendRawToPrinterUncCopy(data, printerName);
    } else {
      throw new Error(`Unknown RAW send method: ${method}`);
    }

    return result;

  } catch (primaryError) {
    console.error(`❌ Primary RAW send method (${method}) failed:`, primaryError.message);

    // Check if fallback is allowed
    if (!fallback || fallback === 'none') {
      console.error('⛔ No fallback method configured');
      throw primaryError;
    }

    // Try fallback method
    console.log(`🔄 Attempting RAW send fallback: ${fallback}`);
    usedFallback = true;

    try {
      if (fallback === 'winspooler') {
        result = await sendRawToPrinterWinSpooler(data, printerName, jobName);
      } else if (fallback === 'unc_copy') {
        result = await sendRawToPrinterUncCopy(data, printerName);
      } else {
        throw new Error(`Unknown RAW send fallback method: ${fallback}`);
      }

      // Mark that fallback was used
      result.rawSendFallbackUsed = true;
      result.rawSendPrimaryMethod = method;
      result.rawSendPrimaryError = primaryError.message;

      console.log(`✅ RAW send fallback successful`);

      return result;

    } catch (fallbackError) {
      console.error(`❌ RAW send fallback (${fallback}) also failed:`, fallbackError.message);

      throw {
        status: 'error',
        message: `Both RAW send methods failed. Primary (${method}): ${primaryError.message}, Fallback (${fallback}): ${fallbackError.message}`,
        rawSendPrimaryMethod: method,
        rawSendFallbackMethod: fallback,
        rawSendFallbackUsed: true,
        rawSendPrimaryError: primaryError.message,
        rawSendFallbackError: fallbackError.message
      };
    }
  }
}

/**
 * Check if printer is available via WinSpoolerHelper.exe
 * 
 * @param {string} printerName - Windows printer name
 * @returns {Promise<Object>} Result with availability info
 */
export async function checkPrinterAvailability(printerName) {
  try {
    // Try WinSpooler check first
    const helperPath = getWinSpoolerHelperPath();

    if (fs.existsSync(helperPath)) {
      try {
        const { stdout, stderr } = await execFileAsync(helperPath, ['--check', printerName], {
          timeout: 5000,
          windowsHide: true
        });

        const available = stdout.includes('OK');

        return {
          available: available,
          found: available,
          offline: false,
          name: printerName,
          method: 'winspooler'
        };
      } catch (helperError) {
        // WinSpooler check failed, fall back to PowerShell (WMIC removed on Win11)
        console.warn('⚠️ WinSpooler check failed, trying PowerShell:', helperError.message);
      }
    }

    // Fallback: PowerShell Get-CimInstance (replaces wmic on Windows 11)
    const safeName = String(printerName).replace(/'/g, "''");
    const command = `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Printer -Filter \\\"Name='${safeName}'\\\" | Select-Object Name, WorkOffline, PrinterStatus | ConvertTo-Json -Compress"`;
    const { stdout } = await execAsync(command, { windowsHide: true, timeout: 10000 });

    const raw = (stdout || '').trim();
    let printerFound = false;
    let isOffline = false;
    if (raw) {
      try {
        let data = JSON.parse(raw);
        if (Array.isArray(data) && data.length) data = data[0];
        printerFound = !!data && (data.Name === printerName || (data.Name && data.Name.toUpperCase() === printerName.toUpperCase()));
        isOffline = !!data && data.WorkOffline === true;
      } catch (_) {
        printerFound = false;
      }
    }
    const isAvailable = printerFound && !isOffline;

    return {
      available: isAvailable,
      found: printerFound,
      offline: isOffline,
      name: printerName,
      method: 'powershell'
    };
  } catch (error) {
    return {
      available: false,
      found: false,
      offline: false,
      name: printerName,
      error: error.message,
      method: 'error'
    };
  }
}

/**
 * Open cash drawer via ESC/POS drawer kick.
 * ESC p m t1 t2: m=0 pin 2, m=1 pin 5; t1,t2 in 2ms units. Sends both pins in one job.
 * Uses WinSpooler first; if that fails (e.g. missing WinSpoolerHelper.dll), falls back to UNC copy.
 *
 * @param {string} printerName - Windows printer name (receipt printer with drawer)
 * @returns {Promise<Object>} Result with status
 */
export async function openDrawer(printerName) {
  const drawerPin2 = Buffer.from([0x1B, 0x70, 0x00, 0x32, 0x32]); // pin 2, 100 ms
  const drawerPin5 = Buffer.from([0x1B, 0x70, 0x01, 0x32, 0x32]); // pin 5, 100 ms
  const drawerCommand = Buffer.concat([drawerPin2, drawerPin5]);

  try {
    return await sendRawToPrinterWinSpooler(drawerCommand, printerName, 'Drawer kick');
  } catch (winErr) {
    const dllOrExeMissing = /\.dll|does not exist|nelze nalézt/i.test(winErr?.message ?? '');
    if (dllOrExeMissing) {
      console.warn('⚠️ WinSpooler failed for drawer (e.g. missing DLL), trying UNC copy…', winErr?.message);
    }
    return await sendRawToPrinterUncCopy(drawerCommand, printerName);
  }
}

/**
 * Check if printer can be opened via WinSpooler API
 * More reliable than wmic for checking actual access
 * 
 * @param {string} printerName - Windows printer name
 * @returns {Promise<boolean>}
 */
export async function canOpenPrinter(printerName) {
  try {
    const helperPath = getWinSpoolerHelperPath();

    if (!fs.existsSync(helperPath)) {
      console.warn('⚠️ WinSpoolerHelper.exe not found, cannot check OpenPrinter');
      return false;
    }

    const { stdout } = await execFileAsync(helperPath, ['--check', printerName], {
      timeout: 5000,
      windowsHide: true
    });

    return stdout.includes('OK');
  } catch {
    return false;
  }
}

export default {
  sendRawToPrinter,
  sendRawToPrinterWinSpooler,
  sendRawToPrinterUncCopy,
  openDrawer,
  checkPrinterAvailability,
  canOpenPrinter,
  isWinSpoolerHelperAvailable
};
