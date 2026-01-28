import iconv from 'iconv-lite';
import { printConfig } from '../config/printConfig.js';
import sharp from 'sharp';

/**
 * ESC/POS Receipt Renderer for 80mm thermal printers
 * Converts receipt payload to ESC/POS byte buffer
 * Supports Czech diacritics via codepage encoding (CP852)
 * 
 * Note: ESC/POS tiskárny nepodporují UTF-8 přímo, proto vždy používáme
 * codepage konverzi (CP852 pro českou diakritiku) a nastavujeme codepage
 * na tiskárně pomocí ESC t n příkazu.
 */

// ============================================
// ESC/POS COMMANDS
// ============================================

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),                    // Initialize printer
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),       // Align left
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),     // Align center
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),      // Align right
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),          // Bold on
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),         // Bold off
  DOUBLE_HEIGHT_ON: Buffer.from([ESC, 0x21, 0x10]), // Double height on
  DOUBLE_HEIGHT_OFF: Buffer.from([ESC, 0x21, 0x00]), // Normal size
  DOUBLE_WIDTH_ON: Buffer.from([ESC, 0x21, 0x20]),  // Double width on
  DOUBLE_WIDTH_OFF: Buffer.from([ESC, 0x21, 0x00]), // Double width off (same as normal)
  DOUBLE_BOTH_ON: Buffer.from([ESC, 0x21, 0x30]),   // Double height + width
  FEED_LINE: Buffer.from([LF]),                      // Line feed
  CUT_PAPER: Buffer.from([GS, 0x56, 0x00]),         // Cut paper (full cut)
  CUT_PAPER_PARTIAL: Buffer.from([GS, 0x56, 0x01]), // Partial cut
};

/**
 * Create ESC/POS command to select font
 * ESC M n - Select character font
 * @param {number|string} font - Font number or name (0-4, 48-52, 97-98, or 'A'-'E', 'SPECIAL_A', 'SPECIAL_B')
 * @returns {Buffer} ESC/POS command buffer
 */
function setFont(font = 0) {
  // If font is a string, convert to number
  if (typeof font === 'string') {
    const fontUpper = font.toUpperCase();
    if (FONT_NAME_TO_NUMBER[fontUpper] !== undefined) {
      font = FONT_NAME_TO_NUMBER[fontUpper];
    } else {
      // Try to parse as number
      const parsed = parseInt(font, 10);
      if (!isNaN(parsed)) {
        font = parsed;
      } else {
        font = FONT.A; // Default fallback
      }
    }
  }
  return Buffer.from([ESC, 0x4D, font]);
}

/**
 * ESC/POS Font definitions
 * Standard fonts: A, B, C, D, E
 * Special fonts: SPECIAL_A, SPECIAL_B (model-specific, may require registration)
 */
const FONT = {
  A: 0,         // Font A (12x24 dots) - default, largest, standard
  B: 1,         // Font B (9x17 dots) - medium, standard
  C: 48,        // Font C (8x16 dots) - smallest, standard
  D: 2,         // Font D (model-specific, varies by printer)
  E: 3,         // Font E (model-specific, varies by printer)
  SPECIAL_A: 97, // Special Font A (requires registration on some printers)
  SPECIAL_B: 98  // Special Font B (requires registration on some printers)
};

/**
 * Map font names to numbers for easy configuration
 */
const FONT_NAME_TO_NUMBER = {
  'A': FONT.A,
  'B': FONT.B,
  'C': FONT.C,
  'D': FONT.D,
  'E': FONT.E,
  'SPECIAL_A': FONT.SPECIAL_A,
  'SPECIAL_B': FONT.SPECIAL_B,
  // Also support numeric strings
  '0': FONT.A,
  '1': FONT.B,
  '2': FONT.D,
  '3': FONT.E,
  '48': FONT.C,
  '49': FONT.B, // Alternative code for Font B
  '50': FONT.C, // Alternative code for Font C
  '51': FONT.D, // Alternative code for Font D
  '52': FONT.E, // Alternative code for Font E
  '97': FONT.SPECIAL_A,
  '98': FONT.SPECIAL_B
};

/**
 * Get ESC/POS codepage number from codepage name
 * ESC t n - Select character code table (n = codepage number)
 * @param {string} codepage - Codepage name (cp852, cp850, cp866, etc.)
 * @returns {number} ESC/POS codepage number
 */
function getCodepageNumber(codepage) {
  const codepageMap = {
    'cp437': 0,   // PC437 (USA)
    'cp850': 2,   // PC850 (Multilingual)
    'cp852': 18,  // PC852 (Latin II - Central European) - Czech, Polish, Hungarian
    'cp858': 19,  // PC858 (Euro)
    'cp860': 3,   // PC860 (Portuguese)
    'cp863': 4,   // PC863 (Canadian French)
    'cp865': 5,   // PC865 (Nordic)
    'cp866': 17,  // PC866 (Cyrillic #2)
    'cp1250': 35, // WPC1250 (Central Europe)
    'cp1252': 16, // WPC1252 (Latin I)
  };
  
  return codepageMap[codepage.toLowerCase()] || 18; // Default to CP852
}

/**
 * Create ESC/POS command to set codepage
 * ESC t n - Select character code table
 * @param {string} codepage - Codepage name
 * @returns {Buffer} ESC/POS command buffer
 */
function setCodepage(codepage) {
  const codepageNum = getCodepageNumber(codepage);
  return Buffer.from([ESC, 0x74, codepageNum]);
}

// ============================================
// HELPER FUNCTIONS (matching PDF template)
// ============================================

/**
 * Získá hodnotu z payload objektu podle klíče
 * Pokud hodnota chybí, vrátí placeholder v <key> formátu
 */
function getValue(payload, key) {
  const value = payload[key];
  if (value === null || value === undefined || value === '') {
    return `<${key}>`;
  }
  return value;
}

/**
 * Získá skutečnou hodnotu z payload objektu (bez placeholderů)
 * Pokud hodnota chybí, vrátí null
 */
function getRawValue(payload, key) {
  const value = payload[key];
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string' && value.startsWith('<') && value.endsWith('>')) {
    return null;
  }
  return value;
}

/**
 * Zkontroluje, zda hodnota není placeholder
 */
function isNotPlaceholder(value) {
  if (!value) return false;
  if (typeof value === 'string' && value.startsWith('<') && value.endsWith('>')) {
    return false;
  }
  return true;
}

/**
 * Stáhne obrázek z URL a vrátí buffer
 */
async function downloadImageFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`❌ Chyba při stahování obrázku z ${url}:`, error.message);
    throw error;
  }
}

/**
 * Převede obrázek na kvalitní monochromatický bitmap pro ESC/POS
 * Používá vylepšený algoritmus pro lepší čitelnost
 * @param {Buffer} imageBuffer - Obrázek jako buffer
 * @param {number} maxWidth - Maximální šířka v pixelech (default 384 pro 80mm)
 * @returns {Promise<Object>} { width, height, data } - Bitmap data
 */
async function convertImageToBitmap(imageBuffer, maxWidth = 384) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Vypočítat nové rozměry (zachovat poměr stran)
    // Použijeme vyšší rozlišení pro lepší kvalitu
    let width = metadata.width;
    let height = metadata.height;
    
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    
    // Pro lepší kvalitu: zvětšíme rozlišení 2x a pak zmenšíme (anti-aliasing effect)
    const scaleFactor = 2;
    const scaledWidth = width * scaleFactor;
    const scaledHeight = height * scaleFactor;
    
    // Převest na grayscale s lepším kontrastem a normalizací
    const processed = await image
      .resize(scaledWidth, scaledHeight, { 
        fit: 'inside',
        kernel: 'lanczos3' // Vyšší kvalita resize
      })
      .greyscale()
      .normalize({ 
        lower: 0, 
        upper: 100 // Zvýšený kontrast
      })
      .sharpen({ sigma: 1 }) // Zostření pro lepší čitelnost
      .resize(width, height, {
        fit: 'inside',
        kernel: 'lanczos3' // Zpět na původní velikost s vysokou kvalitou
      })
      .toBuffer();
    
    // Převest na raw pixel data
    const { data, info } = await sharp(processed)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Převest na bitmap s vylepšeným thresholdingem
    // Použijeme adaptivní threshold místo fixního
    const widthBytes = Math.ceil(width / 8);
    const bitmapData = Buffer.alloc(widthBytes * height);
    
    // Vypočítat průměrnou hodnotu pro adaptivní threshold
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avgBrightness = sum / data.length;
    // Adaptivní threshold - mírně pod průměrem pro lepší čitelnost
    const threshold = Math.max(100, avgBrightness - 20);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = y * width + x;
        const pixel = data[pixelIndex];
        
        // Adaptivní threshold: pokud pixel < threshold, je černý (1)
        // Použijeme mírně vyšší threshold pro lepší kontrast
        const bit = pixel < threshold ? 1 : 0;
        
        if (bit) {
          const byteIndex = y * widthBytes + Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          bitmapData[byteIndex] |= (1 << bitIndex);
        }
      }
    }
    
    return {
      width,
      height,
      data: bitmapData
    };
  } catch (error) {
    console.error('❌ Chyba při konverzi obrázku:', error.message);
    throw error;
  }
}

/**
 * Vytvoří ESC/POS příkaz pro tisk raster bit image (GS v 0)
 * @param {Object} bitmap - { width, height, data }
 * @returns {Buffer} ESC/POS příkaz
 */
function createRasterImageCommand(bitmap) {
  const { width, height, data } = bitmap;
  
  // Šířka v bytech (každý byte = 8 pixelů)
  const widthBytes = Math.ceil(width / 8);
  
  // Parametry pro GS v 0
  const mode = 0; // Normal mode (0 = normal, 1 = double width, 2 = double height, 3 = both)
  const xL = widthBytes & 0xFF;
  const xH = (widthBytes >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;
  
  // GS v 0 m xL xH yL yH d1...dk
  const command = Buffer.from([
    GS, 0x76, 0x30, // GS v 0
    mode,
    xL, xH,
    yL, yH
  ]);
  
  return Buffer.concat([command, data]);
}

// ============================================
// HELPER FUNCTIONS (original)
// ============================================

/**
 * Encode text to bytes using codepage
 * ESC/POS tiskárny nepodporují UTF-8 přímo, musíme použít codepage konverzi
 * @param {string} text - Text to encode
 * @param {string} encoding - Encoding mode (utf8/codepage) - pro ESC/POS vždy používáme codepage
 * @param {string} codepage - Codepage name (cp852, cp850, etc.)
 * @returns {Buffer} Encoded text buffer
 */
function encodeText(text, encoding = 'utf8', codepage = 'cp852') {
  if (!text) return Buffer.from([]);
  
  // ESC/POS tiskárny nepodporují UTF-8 přímo
  // Vždy používáme codepage konverzi pomocí iconv-lite
  // Pokud encoding je 'utf8', stále používáme codepage (CP852 pro českou diakritiku)
  return iconv.encode(text, codepage);
}

/**
 * Create a line separator (dashes)
 */
function createSeparator(charsPerLine = 48) {
  return '-'.repeat(charsPerLine);
}

/**
 * Pad text to fit line width
 */
function padLine(left, right, charsPerLine = 48) {
  const totalLen = left.length + right.length;
  if (totalLen >= charsPerLine) {
    return left + ' ' + right;
  }
  const spaces = charsPerLine - totalLen;
  return left + ' '.repeat(spaces) + right;
}

/**
 * Resolve display name for payment method. If POS sends ID instead of name,
 * and payload contains paymentMethods map (id -> name), look up the name.
 * @param {Object} payload - Receipt payload (order)
 * @param {string|number} [overrideRaw] - Optional raw value to resolve (e.g. for split items)
 * @returns {string} Payment method name for display
 */
function resolvePaymentMethodName(payload, overrideRaw) {
  const raw = overrideRaw !== undefined ? overrideRaw : (payload.paymentMethod ?? payload.payment_method);
  if (raw == null || raw === '') return 'Card';
  const map = payload.paymentMethods || payload.payment_methods;
  if (map && (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(String(raw).trim())))) {
    const id = typeof raw === 'number' ? raw : String(raw).trim();
    const name = typeof map === 'object' && !Array.isArray(map) ? map[id] : null;
    if (typeof name === 'string' && name.length > 0) return name;
    if (Array.isArray(map)) {
      const entry = map.find((m) => String(m?.id) === id || String(m?.id) === String(raw));
      if (entry && typeof entry.name === 'string') return entry.name;
    }
  }
  return typeof raw === 'string' ? raw : String(raw);
}

/**
 * Parse split payment from paymentMethod string
 * Returns array of { methodName, amount } or null if not split payment
 * @param {string} paymentMethod - Payment method string (may contain \n for split payment)
 * @returns {Array<{methodName: string, amount: number}>|null} Parsed payment methods or null
 */
function parseSplitPayment(paymentMethod) {
  if (!paymentMethod || typeof paymentMethod !== 'string') {
    return null;
  }
  
  // Check if it's split payment (contains newline)
  if (!paymentMethod.includes('\n')) {
    return null;
  }
  
  // Split by newline and parse each line
  const lines = paymentMethod.split('\n').filter(line => line.trim().length > 0);
  const parsedMethods = [];
  
  for (const line of lines) {
    // Match format: "METHOD: ...AMOUNT CZK"
    // Example: "CASH:                30.00 CZK"
    // Regex explanation:
    // ^(.+?): - method name before colon (non-greedy)
    // \s+ - one or more spaces
    // (\d+\.\d{2}) - amount with 2 decimal places
    // \s+CZK$ - spaces and CZK at the end
    const match = line.match(/^(.+?):\s+(\d+\.\d{2})\s+CZK$/);
    if (match) {
      const methodName = match[1].trim();
      const amount = parseFloat(match[2]);
      if (!isNaN(amount) && amount > 0) {
        parsedMethods.push({ methodName, amount });
      }
    }
  }
  
  // Return null if no valid methods found (fallback to normal payment)
  return parsedMethods.length > 0 ? parsedMethods : null;
}

/**
 * Wrap long text to multiple lines
 */
function wrapText(text, maxWidth) {
  if (!text) return [];
  if (text.length <= maxWidth) return [text];
  
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

/**
 * Format currency amount
 */
function formatCurrency(amount, currency = 'CZK') {
  if (amount === null || amount === undefined) return '0.00 ' + currency;
  return `${Number(amount).toFixed(2)} ${currency}`;
}

/**
 * Format date (expects various formats, outputs dd-mm-yyyy hh:mm:ss or dd-mm-yyyy)
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  try {
    // If it's already in a nice format, keep it
    if (dateString.match(/^\d{2}-\d{2}-\d{4}/)) {
      return dateString;
    }
    
    // Parse ISO or other formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateString;
  }
}

// ============================================
// MAIN RENDERER
// ============================================

/**
 * Render receipt payload to ESC/POS buffer (matching PDF template format)
 * @param {Object} payload - Receipt data
 * @param {Object} options - Rendering options
 * @param {number|string} options.font - Font selection (number: 0-4, 48, 97-98 or string: 'A'-'E', 'SPECIAL_A', 'SPECIAL_B')
 * @param {number} options.charsPerLine - Characters per line (default: 48)
 * @param {string} options.encoding - Encoding mode (default: 'utf8')
 * @param {string} options.codepage - Codepage for encoding (default: 'cp852')
 * @returns {Buffer} ESC/POS byte buffer
 */
export async function renderReceiptEscpos(payload, options = {}) {
  const {
    charsPerLine = printConfig.RECEIPT_CHARS_PER_LINE,
    encoding = printConfig.RECEIPT_ENCODING_MODE,
    codepage = printConfig.RECEIPT_CODEPAGE,
    font = printConfig.RECEIPT_FONT || FONT.A // Default font A
  } = options;
  
  const buffers = [];
  
  // Encoding function wrapper
  const enc = (text) => encodeText(text, encoding, codepage);
  
  // Initialize printer
  buffers.push(CMD.INIT);
  
  // Set codepage for Czech diacritics (CP852 = codepage 18)
  // ESC t n - Select character code table
  buffers.push(setCodepage(codepage));
  
  // Set font
  buffers.push(setFont(font));
  
  buffers.push(CMD.ALIGN_LEFT);
  
  // ============================================
  // ORDER NUMBER (top right, like PDF)
  // ============================================
  
  const orderNumber = getRawValue(payload, 'orderNumber') || getRawValue(payload, 'order_number');
  if (orderNumber && isNotPlaceholder(orderNumber)) {
    buffers.push(CMD.ALIGN_RIGHT);
    buffers.push(CMD.BOLD_ON);
    buffers.push(enc(`#${orderNumber}`));
    buffers.push(CMD.BOLD_OFF);
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  // ============================================
  // COMPANY NAME
  // ============================================
  
  const companyName = getValue(payload, 'company_name');
  buffers.push(CMD.ALIGN_CENTER);
  buffers.push(CMD.BOLD_ON);
  buffers.push(CMD.DOUBLE_HEIGHT_ON);
  buffers.push(CMD.DOUBLE_WIDTH_ON);
  buffers.push(enc(companyName));
  buffers.push(CMD.DOUBLE_HEIGHT_OFF);
  buffers.push(CMD.DOUBLE_WIDTH_OFF);
  buffers.push(CMD.BOLD_OFF);
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // COMPANY DETAILS
  // ============================================
  
  buffers.push(CMD.ALIGN_CENTER);
  
  const companyVAT = getValue(payload, 'company_VAT');
  buffers.push(enc(companyVAT));
  buffers.push(CMD.FEED_LINE);
  
  const companyAddress = getValue(payload, 'company_address');
  buffers.push(enc(companyAddress));
  buffers.push(CMD.FEED_LINE);
  
  const companyCity = getValue(payload, 'company_city');
  const companyPostalCode = getValue(payload, 'company_poscode');
  buffers.push(enc(`${companyCity} ${companyPostalCode}`));
  buffers.push(CMD.FEED_LINE);
  
  const companyCountry = getValue(payload, 'company_country');
  buffers.push(enc(companyCountry));
  buffers.push(CMD.FEED_LINE);
  
  const companyPhone = getRawValue(payload, 'company_phone');
  if (companyPhone && isNotPlaceholder(companyPhone)) {
    buffers.push(enc(companyPhone));
    buffers.push(CMD.FEED_LINE);
  }
  
  const companyEmail = getRawValue(payload, 'company_email');
  if (companyEmail && isNotPlaceholder(companyEmail)) {
    buffers.push(enc(companyEmail));
    buffers.push(CMD.FEED_LINE);
  }
  
  const companyWebsite = getRawValue(payload, 'company_website');
  if (companyWebsite && isNotPlaceholder(companyWebsite)) {
    buffers.push(enc(companyWebsite));
    buffers.push(CMD.FEED_LINE);
  }
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.ALIGN_LEFT);
  
  // ============================================
  // REFUND RECEIPT (if applicable)
  // ============================================
  
  const isRefund = payload.isRefund || (payload.totalCZK && payload.totalCZK < 0) || (payload.total_czk && payload.total_czk < 0);
  if (isRefund) {
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(CMD.BOLD_ON);
    buffers.push(CMD.DOUBLE_HEIGHT_ON);
    buffers.push(enc('REFUND RECEIPT'));
    buffers.push(CMD.DOUBLE_HEIGHT_OFF);
    buffers.push(CMD.BOLD_OFF);
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  // ============================================
  // RECEIPT NUMBER & ORIGINAL RECEIPT
  // ============================================
  
  const receiptNumber = getRawValue(payload, 'receiptNumber') || getRawValue(payload, 'receipt_number') || orderNumber;
  if (receiptNumber && isNotPlaceholder(receiptNumber)) {
    buffers.push(enc(`Receipt No.: ${receiptNumber}`));
    buffers.push(CMD.FEED_LINE);
  }

  const originalReceiptNumber = getRawValue(payload, 'originalReceiptNumber') || getRawValue(payload, 'original_receipt_number');
  if (originalReceiptNumber && isNotPlaceholder(originalReceiptNumber)) {
    buffers.push(enc(`Refunded Receipt No.: ${originalReceiptNumber}`));
    buffers.push(CMD.FEED_LINE);
  }

  // ============================================
  // CUSTOMER NAME
  // ============================================

  const customerName = getRawValue(payload, 'customerName') || getRawValue(payload, 'customer_name');
  if (customerName && isNotPlaceholder(customerName) && customerName !== 'Walk-in Customer') {
    buffers.push(enc(`Customer: ${customerName}`));
    buffers.push(CMD.FEED_LINE);
  }

  // ============================================
  // DATE
  // ============================================

  const createdAt = getRawValue(payload, 'createdAt') || getRawValue(payload, 'created_at');
  if (createdAt && isNotPlaceholder(createdAt)) {
    const formattedDate = formatDate(createdAt);
    buffers.push(enc(`Date: ${formattedDate}`));
    buffers.push(CMD.FEED_LINE);
  }
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(enc(createSeparator(charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // ITEMS
  // ============================================
  
  const items = payload.items || [];
  let itemCount = 0;
  
  items.forEach((item) => {
    itemCount += item.qty || item.quantity || 1;
    
    const quantity = item.quantity || item.qty || 1;
    const unitPrice = item.unitPrice || item.price || 0;
    const itemTotal = quantity * unitPrice;
    const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;

    // Build full item text: name + options/modifiers (each line wrapped to charsPerLine)
    const namePart = item.name || '';
    const opts = item.options || item.modifiers || item.choices || [];
    const optsText = Array.isArray(opts) ? opts.map(o => (typeof o === 'string' ? o : (o && o.name) || '')).filter(Boolean).join('\n') : '';
    const fullText = optsText ? `${namePart}\n${optsText}` : namePart;

    // Item name + options: each line wrapped, fixed width, no printer-induced indent
    buffers.push(CMD.BOLD_ON);
    const lines = fullText.split(/\r?\n/).flatMap(line => wrapText(line.trim(), charsPerLine));
    for (const line of lines) {
      if (line) buffers.push(enc(line));
      buffers.push(CMD.FEED_LINE);
    }
    buffers.push(CMD.BOLD_OFF);
    
    // Quantity × price (if quantity > 1) – fixed-width line
    const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
    if (quantity > 1) {
      buffers.push(enc(padLine(`${quantity} × ${displayUnitPrice.toFixed(2)} CZK`, '', charsPerLine)));
      buffers.push(CMD.FEED_LINE);
    }
    
    // Item total: same width as rest of receipt (padLine keeps price on right)
    buffers.push(enc(padLine('', `${displayItemTotal.toFixed(2)} CZK`, charsPerLine)));
    buffers.push(CMD.FEED_LINE);
  });
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(enc(createSeparator(charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  
  // Items count
  buffers.push(enc(padLine(`Items Count: ${itemCount}`, '', charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(enc(createSeparator(charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // SUBTOTAL
  // ============================================
  
  const subtotal = payload.subtotal;
  if (subtotal && subtotal !== payload.totalCZK && subtotal !== payload.total_czk) {
    const displaySubtotal = isRefund ? -Math.abs(subtotal) : subtotal;
    buffers.push(enc(padLine('Subtotal:', `${displaySubtotal.toFixed(2)} CZK`, charsPerLine)));
    buffers.push(CMD.FEED_LINE);
  }
  
  // ============================================
  // VAT/TAX
  // ============================================
  
  if (payload.vat && Array.isArray(payload.vat) && payload.vat.length > 0) {
    payload.vat.forEach((vatItem) => {
      const displayVatAmount = isRefund ? -Math.abs(vatItem.amount) : vatItem.amount;
      buffers.push(enc(padLine(`Tax ${vatItem.rate}%:`, `${displayVatAmount.toFixed(2)} CZK`, charsPerLine)));
      buffers.push(CMD.FEED_LINE);
    });
  }
  
  // ============================================
  // DISCOUNT
  // ============================================
  
  if (payload.discountAmount && payload.discountAmount > 0) {
    let discountLabel = 'Discount';
    
    if (payload.discountPercent) {
      const percent = Number(payload.discountPercent);
      if (percent > 0) {
        discountLabel = `Discount ${percent}%`;
      }
    } else if (payload.discountName) {
      const name = String(payload.discountName).trim();
      if (name !== '') {
        discountLabel = `Discount (${name})`;
      }
    } else if (payload.discountType === 'fixed') {
      discountLabel = `Discount ${Math.round(payload.discountAmount)} CZK`;
    }
    
    buffers.push(enc(padLine(discountLabel + ':', `-${payload.discountAmount.toFixed(2)} CZK`, charsPerLine)));
    buffers.push(CMD.FEED_LINE);
    
    // "You saved" message
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(enc(`You saved ${payload.discountAmount.toFixed(2)} CZK!`));
    buffers.push(CMD.ALIGN_LEFT);
    buffers.push(CMD.FEED_LINE);
  }
  
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // TOTAL
  // ============================================
  
  const totalCZK = payload.totalCZK || payload.total_czk || 0;
  const displayTotal = isRefund ? -Math.abs(totalCZK) : totalCZK;
  
  buffers.push(CMD.BOLD_ON);
  buffers.push(CMD.DOUBLE_HEIGHT_ON);
  buffers.push(enc(padLine('TOTAL:', `${displayTotal.toFixed(2)} CZK`, charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.DOUBLE_HEIGHT_OFF);
  buffers.push(CMD.BOLD_OFF);
  
  // EUR total (if present)
  const totalEUR = payload.totalEUR || payload.total_eur;
  if (totalEUR) {
    const displayTotalEUR = isRefund ? -Math.abs(totalEUR) : totalEUR;
    buffers.push(CMD.ALIGN_RIGHT);
    buffers.push(enc(`= ${displayTotalEUR.toFixed(2)} EUR`));
    buffers.push(CMD.ALIGN_LEFT);
    buffers.push(CMD.FEED_LINE);
  }
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(enc(createSeparator(charsPerLine)));
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // PAYMENT METHODS
  // ============================================
  
  buffers.push(CMD.BOLD_ON);
  buffers.push(CMD.DOUBLE_HEIGHT_ON);
  
  if (isRefund) {
    const paymentMethod = resolvePaymentMethodName(payload);
    buffers.push(enc(padLine(`${paymentMethod}:`, `${displayTotal.toFixed(2)} CZK`, charsPerLine)));
    buffers.push(CMD.FEED_LINE);
    buffers.push(enc(padLine('Refunded amount:', `${displayTotal.toFixed(2)} CZK`, charsPerLine)));
    buffers.push(CMD.FEED_LINE);
  } else {
    const rawPayment = payload.paymentMethod ?? payload.payment_method;
    const splitPayment = parseSplitPayment(rawPayment != null ? String(rawPayment) : null);
    
    if (splitPayment) {
      for (const payment of splitPayment) {
        const displayName = resolvePaymentMethodName(payload, payment.methodName);
        buffers.push(enc(padLine(`${displayName}:`, `${payment.amount.toFixed(2)} CZK`, charsPerLine)));
        buffers.push(CMD.FEED_LINE);
      }
      buffers.push(enc(padLine('PAID AMOUNT:', `${totalCZK.toFixed(2)} CZK`, charsPerLine)));
      buffers.push(CMD.FEED_LINE);
    } else {
      const paymentMethodResolved = resolvePaymentMethodName(payload);
      const paymentMethod = (paymentMethodResolved === 'Card' || paymentMethodResolved === 'Card - Contactless')
        ? 'Card - Contactless'
        : paymentMethodResolved || 'Card - Contactless';
      
      buffers.push(enc(padLine(`${paymentMethod}:`, `${totalCZK.toFixed(2)} CZK`, charsPerLine)));
      buffers.push(CMD.FEED_LINE);
      
      if (payload.givenAmount && payload.givenAmount > 0) {
        buffers.push(enc(padLine('Given amount:', `${payload.givenAmount.toFixed(2)} CZK`, charsPerLine)));
        buffers.push(CMD.FEED_LINE);
        
        if (payload.change && payload.change > 0) {
          buffers.push(enc(padLine('Change:', `${payload.change.toFixed(2)} CZK`, charsPerLine)));
          buffers.push(CMD.FEED_LINE);
        }
      } else {
        buffers.push(enc(padLine('Paid amount:', `${totalCZK.toFixed(2)} CZK`, charsPerLine)));
        buffers.push(CMD.FEED_LINE);
      }
    }
  }
  
  buffers.push(CMD.DOUBLE_HEIGHT_OFF);
  buffers.push(CMD.BOLD_OFF);
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // EXCHANGE RATE
  // ============================================
  
  if (payload.exchangeRate) {
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(enc(`Exchange rate: ${payload.exchangeRate}`));
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  buffers.push(CMD.FEED_LINE);
  
  // ============================================
  // QR CODE (placeholder - will be implemented later)
  // ============================================
  
  // TODO: Add QR code support
  
  // ============================================
  // FOOTER TEXT
  // ============================================
  
  const footerCustomText = getRawValue(payload, 'footer_custom_text') || getRawValue(payload, 'footerCustomText');
  const footerSocialText = getRawValue(payload, 'footer_social_text') || getRawValue(payload, 'footerSocialText');
  const footerSocialHandle = getRawValue(payload, 'footer_social_handle') || getRawValue(payload, 'footerSocialHandle');
  
  if (footerCustomText && isNotPlaceholder(footerCustomText)) {
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(CMD.BOLD_ON);
    buffers.push(CMD.DOUBLE_HEIGHT_ON);
    buffers.push(enc(footerCustomText));
    buffers.push(CMD.DOUBLE_HEIGHT_OFF);
    buffers.push(CMD.BOLD_OFF);
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  if (footerSocialText && isNotPlaceholder(footerSocialText)) {
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(enc(footerSocialText));
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  if (footerSocialHandle && isNotPlaceholder(footerSocialHandle)) {
    buffers.push(CMD.ALIGN_CENTER);
    buffers.push(enc(footerSocialHandle));
    buffers.push(CMD.FEED_LINE);
    buffers.push(CMD.ALIGN_LEFT);
  }
  
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.FEED_LINE);
  buffers.push(CMD.FEED_LINE);
  
  // Cut paper
  buffers.push(CMD.CUT_PAPER_PARTIAL);
  
  // Combine all buffers
  return Buffer.concat(buffers);
}

// Export FONT constants for external use
export { FONT, FONT_NAME_TO_NUMBER };

export default renderReceiptEscpos;
