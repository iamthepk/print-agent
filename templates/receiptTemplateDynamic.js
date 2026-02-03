import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Získá hodnotu z order objektu podle cesty
 * Pokud hodnota chybí, vrátí název placeholderu v <placeholder> formátu
 */
function getValue(order, key) {
    const value = order[key];
    if (key.startsWith('company_')) {
        console.log(`🔍 getValue(${key}):`, value === undefined ? 'undefined' : value === null ? 'null' : value === '' ? 'empty string' : value);
    }
    if (value === null || value === undefined || value === '') {
        const placeholder = `<${key}>`;
        if (key.startsWith('company_')) {
            console.log(`✅ Vracím placeholder: ${placeholder}`);
        }
        return placeholder;
    }
    return value;
}

/**
 * Získá skutečnou hodnotu z order objektu (bez placeholderů)
 * Pokud hodnota chybí, vrátí null
 */
function getRawValue(order, key) {
    const value = order[key];
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
 * Resolve display name for payment method. If POS sends ID instead of name,
 * and order contains paymentMethods map (id -> name), look up the name.
 * @param {Object} order - Order object
 * @returns {string} Payment method name for display
 */
function resolvePaymentMethodName(order) {
  const raw = getRawValue(order, 'paymentMethod') ?? getRawValue(order, 'payment_method');
  if (raw == null || raw === '') return 'Card';
  const map = order.paymentMethods || order.payment_methods;
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
 * Formátuje datum a čas do formátu dd-mm-yyyy hh:mm:ss
 * Podporuje různé vstupní formáty: "2025-11-03 15:38", "2025-11-03 15:38:45", "2025-11-03", atd.
 */
function formatDate(dateString) {
    if (!dateString) return dateString;

    try {
        const parts = dateString.split(' ').filter(p => p.length > 0);
        let datePart = parts[0].split('T')[0];
        let timePart = null;

        if (parts.length > 1) {
            timePart = parts[1];
        } else if (parts[0].includes('T')) {
            const isoParts = parts[0].split('T');
            datePart = isoParts[0];
            timePart = isoParts[1];
        }

        let formattedDate = '';
        if (datePart.includes('-')) {
            const dateParts = datePart.split('-');
            if (dateParts.length === 3) {
                // Detekce formátu:
                // - Pokud první část má 4 znaky, je to YYYY-MM-DD (ISO)
                // - Pokud třetí část má 4 znaky a první část je <= 31, je to dd-mm-yyyy
                // - Pokud první část > 12, je to pravděpodobně YYYY-MM-DD
                const firstPart = parseInt(dateParts[0], 10);
                const secondPart = parseInt(dateParts[1], 10);
                const thirdPart = dateParts[2];

                if (dateParts[0].length === 4) {
                    // Formát YYYY-MM-DD (ISO) - převedeme na dd-mm-yyyy
                    const year = dateParts[0];
                    const month = dateParts[1].padStart(2, '0');
                    const day = dateParts[2].padStart(2, '0');
                    formattedDate = `${day}-${month}-${year}`;
                } else if (thirdPart.length === 4 && firstPart <= 31 && secondPart <= 12) {
                    // Formát dd-mm-yyyy - už je ve správném formátu, jen zajistíme padding
                    const day = dateParts[0].padStart(2, '0');
                    const month = dateParts[1].padStart(2, '0');
                    const year = dateParts[2];
                    formattedDate = `${day}-${month}-${year}`;
                } else if (firstPart > 12) {
                    // První část je větší než 12, pravděpodobně YYYY-MM-DD
                    const year = dateParts[0];
                    const month = dateParts[1].padStart(2, '0');
                    const day = dateParts[2].padStart(2, '0');
                    formattedDate = `${day}-${month}-${year}`;
                } else {
                    // Fallback - zkusíme jako dd-mm-yyyy
                    const day = dateParts[0].padStart(2, '0');
                    const month = dateParts[1].padStart(2, '0');
                    const year = dateParts[2];
                    formattedDate = `${day}-${month}-${year}`;
                }
            }
        } else if (datePart.includes('/')) {
            const dateParts = datePart.split('/');
            if (dateParts.length === 3) {
                if (dateParts[0].length === 4) {
                    const year = dateParts[0];
                    const month = dateParts[1].padStart(2, '0');
                    const day = dateParts[2].padStart(2, '0');
                    formattedDate = `${day}-${month}-${year}`;
                } else {
                    const month = dateParts[0].padStart(2, '0');
                    const day = dateParts[1].padStart(2, '0');
                    const year = dateParts[2];
                    formattedDate = `${day}-${month}-${year}`;
                }
            }
        }

        if (!formattedDate) {
            const date = new Date(datePart);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                formattedDate = `${day}-${month}-${year}`;
            } else {
                return dateString;
            }
        }

        let formattedTime = '';
        if (timePart) {
            timePart = timePart.split('.')[0];
            const timeParts = timePart.split(':');

            if (timeParts.length >= 2) {
                const hours = timeParts[0].padStart(2, '0');
                const minutes = timeParts[1].padStart(2, '0');
                const seconds = timeParts[2] ? timeParts[2].padStart(2, '0') : '00';
                formattedTime = `${hours}:${minutes}:${seconds}`;
            }
        }
        if (formattedTime) {
            return `${formattedDate} ${formattedTime}`;
        } else {
            return formattedDate;
        }
    } catch (error) {
        console.warn('⚠️ Chyba při formátování data:', error.message);
    }

    return dateString;
}

async function generateReceiptPDF(order, options = {}) {
    console.log('🎯 DYNAMICKÝ TEMPLATE - Začínám generovat PDF');
    console.log('🎯 Order keys:', Object.keys(order).filter(k => k.startsWith('company_')));
    console.log('🎯 useDynamicTemplate:', order.useDynamicTemplate);

    let logoBuffer = null;
    let qrCodeBuffer = null;

    const companyLogo = getRawValue(order, 'company_logo');
    const companyGoogleReviewsQrCode = getRawValue(order, 'company_google_reviews_qr_code') || getRawValue(order, 'company_qr');
    if (companyLogo && isNotPlaceholder(companyLogo) && (companyLogo.startsWith('http://') || companyLogo.startsWith('https://'))) {
        try {
            console.log('📷 Stahuji logo z POS URL:', companyLogo);
            logoBuffer = await downloadImageFromUrl(companyLogo);
            console.log('✅ Logo staženo z POS URL');
        } catch (error) {
            console.warn('⚠️ Nepodařilo se stáhnout logo z POS URL:', error.message);
            logoBuffer = null;
        }
    } else if (companyLogo && !companyLogo.startsWith('http')) {
        console.warn('⚠️ Logo není validní URL:', companyLogo);
        logoBuffer = null;
    }

    if (companyGoogleReviewsQrCode && isNotPlaceholder(companyGoogleReviewsQrCode) && (companyGoogleReviewsQrCode.startsWith('http://') || companyGoogleReviewsQrCode.startsWith('https://'))) {
        try {
            console.log('📷 Stahuji QR kód z POS URL:', companyGoogleReviewsQrCode);
            qrCodeBuffer = await downloadImageFromUrl(companyGoogleReviewsQrCode);
            console.log('✅ QR kód stažen z POS URL');
        } catch (error) {
            console.warn('⚠️ Nepodařilo se stáhnout QR kód z POS URL:', error.message);
            qrCodeBuffer = null;
        }
    } else if (companyGoogleReviewsQrCode && !companyGoogleReviewsQrCode.startsWith('http')) {
        console.warn('⚠️ QR kód není validní URL:', companyGoogleReviewsQrCode);
        qrCodeBuffer = null;
    }

    return new Promise((resolve, reject) => {
        const tmpPath = path.join(os.tmpdir(), `receipt-dynamic-${Date.now()}.pdf`);
        const topMargin = options.pdfTopMargin ?? 0;
        const leftMargin = options.pdfLeftMargin ?? 0;
        const rightMargin = options.pdfRightMargin ?? 0;
        const baseX = leftMargin;
        const contentWidth = 226 - leftMargin - rightMargin;
        const rightColStart = baseX + 130;

        const doc = new PDFDocument({
            size: [226, 1000],
            margins: { top: topMargin, bottom: 38, left: leftMargin, right: rightMargin }
        });
        try {
            const bebasFontPath = path.join(__dirname, '..', 'fonts', 'BebasNeue-Regular.ttf');
            if (fs.existsSync(bebasFontPath)) {
                doc.registerFont('Bebas Neue', bebasFontPath);
            }
        } catch (error) {
            console.log('Bebas Neue font not found, using default fonts');
        }

        const stream = fs.createWriteStream(tmpPath);
        doc.pipe(stream);

        // Spacing v bodech (pt): moveDown() závisí na fontSize/lineHeight a po velkých fontech
        // dělá obrovské mezery; gap/hr zajišťují deterministické vertikální mezery.
        const gap = (pt) => { doc.y += pt; };
        const hr = (above = 2, below = 2) => {
             gap(above);
            doc.moveTo(baseX, doc.y).lineTo(baseX + contentWidth, doc.y).stroke();
             gap(below);
         };

         const dashedSeparator = (y) => {
            doc
                .dash(1, { space: 2 })      // tečka / mezera
                .moveTo(baseX, y)
                .lineTo(baseX + contentWidth, y)
                .stroke()
                .undash();
        };

        const centerText = (text, fontSize = 10, font = "Bebas Neue") => {
            doc.fontSize(fontSize).font(font).text(text, baseX, doc.y, { width: contentWidth, align: "center" });
        };

        const leftRightText = (leftText, rightText, fontSize = 10, font = "Bebas Neue") => {
            const startY = doc.y;
            doc.fontSize(fontSize).font(font);
            doc.text(leftText, baseX, startY, { width: 130, align: "left" });
            doc.text(rightText, rightColStart, startY, { width: contentWidth - 130, align: "right" });
            doc.y = startY + doc.heightOfString(leftText, { width: 130 });
        };

        const leftRightTextWithCurrency = (leftText, amount, currency = "CZK", fontSize = 10, font = "Bebas Neue") => {
            const startY = doc.y;
            doc.fontSize(fontSize).font(font);
            doc.text(leftText, baseX, startY, { width: 130, align: "left" });

            const combinedText = `${amount} ${currency}`;
            doc.text(combinedText, rightColStart, startY, { width: contentWidth - 130, align: "right" });

            doc.y = startY + doc.heightOfString(leftText, { width: 130 });
        };

        const orderNumber = getRawValue(order, 'orderNumber') || getRawValue(order, 'order_number');
        console.log('🔍 Order Number:', { orderNumber, isNotPlaceholder: orderNumber ? isNotPlaceholder(orderNumber) : false, rawOrderNumber: order.orderNumber, rawOrder_number: order.order_number });
        if (orderNumber && isNotPlaceholder(orderNumber)) {
            const orderText = `#${orderNumber}`;
            const maxWidth = contentWidth;
            let fontSize = 30;
            const minFontSize = 18;


            doc.fontSize(fontSize).font("Bebas Neue");
            let textWidth = doc.widthOfString(orderText);


            if (textWidth > maxWidth) {
                fontSize = Math.max(minFontSize, Math.floor((maxWidth / textWidth) * fontSize));
                doc.fontSize(fontSize);
                textWidth = doc.widthOfString(orderText);
                console.log(`⚠️ Order number příliš dlouhý, zmenšuji písmo na ${fontSize}pt`);
            }


            doc.text(orderText, baseX, doc.y, { width: maxWidth, align: "right" });
        }

        // === LOGO ===
        const logoStartY = doc.y;
        let logoHeight = 0;
        const logoWidthPoints = 120;
        const centerXAdjusted = baseX + (contentWidth - logoWidthPoints) / 2;
        let hasLogoImage = false;

        if (logoBuffer) {
            try {
                doc.image(logoBuffer, centerXAdjusted, logoStartY, {
                    width: logoWidthPoints,
                    fit: [logoWidthPoints, logoWidthPoints * 2]
                });
                logoHeight = logoWidthPoints * 0.8;
                doc.y = logoStartY + logoHeight + 8;
                hasLogoImage = true;
                console.log('✅ Logo z company_logo vykresleno');
                gap(2);
            } catch (error) {
                console.error('❌ Chyba při vykreslování loga z bufferu:', error.message);
                hasLogoImage = false;
            }
        }

        // === COMPANY NAME ===
        const companyName = getValue(order, 'company_name');
        if (!hasLogoImage) {
            centerText(companyName, 25, "Bebas Neue");
            gap(2);
        }

        if (hasLogoImage) {
            centerText(companyName, 18, "Bebas Neue");
            gap(4);
        }

        // === COMPANY DETAILS ===
        doc.fontSize(11).font("Bebas Neue");

        const companyVAT = getValue(order, 'company_VAT');
        centerText(`${companyVAT}`, 11);

        const companyAddress = getValue(order, 'company_address');
        centerText(companyAddress, 11);

        const companyCity = getValue(order, 'company_city');
        const companyPostalCode = getValue(order, 'company_poscode');
        centerText(`${companyCity} ${companyPostalCode}`, 11);

        const companyCountry = getValue(order, 'company_country');
        centerText(companyCountry, 11);

        const companyPhone = getRawValue(order, 'company_phone');
        if (companyPhone && isNotPlaceholder(companyPhone)) {
            centerText(companyPhone, 11);
        }

        const companyEmail = getRawValue(order, 'company_email');
        if (companyEmail && isNotPlaceholder(companyEmail)) {
            centerText(companyEmail, 11);
        }

        const companyWebsite = getRawValue(order, 'company_website');
        if (companyWebsite && isNotPlaceholder(companyWebsite)) {
            centerText(companyWebsite, 11);
        }

        gap(4);

        const isRefund = order.isRefund || order.totalCZK < 0;

        doc.fontSize(12).font("Bebas Neue");

        if (isRefund) {
            centerText("REFUND RECEIPT", 20, "Bebas Neue");
            gap(2);
        }

        const receiptNumber =
        getRawValue(order, "receiptNumber") ||
        getRawValue(order, "receipt_number") ||
        orderNumber;
      
      console.log("🔍 Receipt Number:", {
        receiptNumber,
        isNotPlaceholder: receiptNumber ? isNotPlaceholder(receiptNumber) : false,
        rawReceiptNumber: order.receiptNumber,
        rawReceipt_number: order.receipt_number,
      });
      
      const originalReceiptNumber =
        getRawValue(order, "originalReceiptNumber") ||
        getRawValue(order, "original_receipt_number");
      
      const customerName =
        getRawValue(order, "customerName") || getRawValue(order, "customer_name");
      
      console.log("🔍 Customer Name:", {
        customerName,
        isNotPlaceholder: customerName ? isNotPlaceholder(customerName) : false,
        rawCustomerName: order.customerName,
        rawCustomer_name: order.customer_name,
      });
      
      const createdAt =
        getRawValue(order, "createdAt") || getRawValue(order, "created_at");
      
      console.log("🔍 Created At:", {
        createdAt,
        isNotPlaceholder: createdAt ? isNotPlaceholder(createdAt) : false,
        rawCreatedAt: order.createdAt,
        rawCreated_at: order.created_at,
      });
      
      // === RECEIPT / CUSTOMER / DATE – TIGHT (bez heightOfString) ===
      doc.font("Bebas Neue").fontSize(12);
      
      // dočasně stáhni line-gap jen pro tenhle blok (dělá to hodně)
      const prevLineGap = doc._lineGap ?? 0;
      doc.lineGap(-3);
      
      const row = (text) => {
        const y = doc.y;
        doc.text(text, baseX, y, { width: contentWidth, align: "left" });
        // posun jen o jednu řádku (stabilní), ne o heightOfString
        doc.y = y + doc.currentLineHeight(true);
      };
      
      if (receiptNumber && isNotPlaceholder(receiptNumber)) {
        row(`Receipt No.: ${receiptNumber}`);
      }
      
      if (originalReceiptNumber && isNotPlaceholder(originalReceiptNumber)) {
        row(`Refunded Receipt No.: ${originalReceiptNumber}`);
      }
      
      if (
        customerName &&
        isNotPlaceholder(customerName) &&
        customerName !== "Walk-in Customer"
      ) {
        row(`Customer: ${customerName}`);
      }
      
      if (createdAt && isNotPlaceholder(createdAt)) {
        row(`Date: ${formatDate(createdAt)}`);
      }
      
      // vrať line-gap zpět
      doc.lineGap(prevLineGap);
      

        hr(0, 2);
        let itemCount = 0;
        const items = order.items || [];
        
        items.forEach((item, index) => {
            itemCount += item.qty || 1;
        
            const itemName = item.name || '';
            const unitPrice = item.unitPrice || item.price || 0;
            const itemTotal = (item.qty || 1) * unitPrice;
            const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
            const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;
        
            doc.fontSize(11).font("Bebas Neue");
        
            // 1) Název drinku
            const itemStartY = doc.y;
            doc.text(itemName, baseX, itemStartY, { width: contentWidth, align: "left" });
            doc.y = itemStartY + doc.heightOfString(itemName, { width: contentWidth });
        
            // poslední řádek itemu (pro cenu)
            let lastLineY = doc.y - doc.currentLineHeight(true);
        
            // 2) qty × unit price
            if ((item.qty || 1) > 1) {
                leftRightText(`${item.qty} × ${displayUnitPrice.toFixed(2)} CZK`, "");
                lastLineY = doc.y - doc.currentLineHeight(true);
            }
        
            // 3) cena na poslední řádek
            const priceStr = `${displayItemTotal.toFixed(2)} CZK`;
            doc.text(priceStr, baseX, lastLineY, { width: contentWidth, align: "right" });
        
            // 4) posun pod item
            doc.y = lastLineY + doc.currentLineHeight(true);
        
// 5) jemná oddělovací čára mezi itemy (ne po posledním)
if (index < items.length - 1) {
    dashedSeparator(doc.y + 1); // lehce pod textem
    doc.y += 2;                // minimální posun
}

        });
        
        hr(0, 2);
        leftRightText(`Items Count: ${itemCount}`, "");

        hr();
        const subtotal = order.subtotal;
        if (subtotal && subtotal !== order.totalCZK) {
            const displaySubtotal = isRefund ? -Math.abs(subtotal) : subtotal;
            leftRightText("Subtotal:", `${displaySubtotal.toFixed(2)} CZK`);
        }

        if (order.vat && order.vat.length > 0) {
            order.vat.forEach((vatItem) => {
                const displayVatAmount = isRefund ? -Math.abs(vatItem.amount) : vatItem.amount;
                leftRightText(`Tax ${vatItem.rate}%:`, `${displayVatAmount.toFixed(2)} CZK`);
            });
        }
        if (order.discountAmount && order.discountAmount > 0) {
            let discountLabel = "Discount";
        
            if (order.discountPercent) {
                const percent = Number(order.discountPercent);
                if (percent > 0) {
                    discountLabel = `Discount ${percent}%`;
                }
            } else if (order.discountName) {
                const name = String(order.discountName).trim();
                if (name !== "") {
                    discountLabel = `Discount (${name})`;
                }
            } else if (order.discountType === "fixed") {
                discountLabel = `Discount ${Math.round(order.discountAmount)} CZK`;
            }
        
            leftRightText(discountLabel + ":", `-${order.discountAmount.toFixed(2)} CZK`);
        
            // "You saved" – přesně 1 řádek, žádný heightOfString (ten dělal velké mezery)
            doc.font("Bebas Neue").fontSize(11).fillColor("#666666");
        
            const savedStr = `You saved ${order.discountAmount.toFixed(2)} CZK!`;
            const y = doc.y;
        
            doc.text(savedStr, baseX, y, { width: contentWidth, align: "center" });
        
            // posun o jednu řádku (stabilní), ne podle heightOfString
            doc.y = y + doc.currentLineHeight(true);
        
            // reset styling pro další část (TOTAL atd.)
            doc.fillColor("#000000").fontSize(13);
        }

// === TOTAL (utažená sekce) ===
const totalCZK = order.totalCZK || 0;
const displayTotal = isRefund ? -Math.abs(totalCZK) : totalCZK;

leftRightTextWithCurrency(
    "TOTAL:",
    displayTotal.toFixed(2),
    "CZK",
    15,
    "Bebas Neue"
);

// EUR hned pod TOTAL – 1 řádek, žádné heightOfString
if (order.totalEUR) {
    const displayTotalEUR = isRefund ? -Math.abs(order.totalEUR) : order.totalEUR;

    doc.font("Bebas Neue").fontSize(12);
    const y = doc.y;

    doc.text(
        `= ${displayTotalEUR.toFixed(2)} EUR`,
        baseX,
        y,
        { width: contentWidth, align: "right" }
    );

    // přesně jeden řádek dolů
    doc.y = y + doc.currentLineHeight(true);
}

// ❗ čára bez mezery NAD (to dělalo díru)
hr(0, 2);

        doc.fontSize(15).font("Bebas Neue");

        if (isRefund) {
            const paymentMethod = resolvePaymentMethodName(order);
            leftRightText(paymentMethod + ":", `${displayTotal.toFixed(2)} CZK`);
            leftRightText("Refunded amount:", `${displayTotal.toFixed(2)} CZK`);
        } else {
            // Check for split payment (use raw string – split format uses method names)
            const rawPayment = getRawValue(order, 'paymentMethod') ?? getRawValue(order, 'payment_method');
            const splitPayment = parseSplitPayment(rawPayment != null ? String(rawPayment) : null);
            
            if (splitPayment) {
                // Split payment: resolve each methodName if it looks like ID (optional paymentMethods map)
                for (const payment of splitPayment) {
                    const displayName = resolvePaymentMethodName({ ...order, paymentMethod: payment.methodName });
                    leftRightText(displayName + ":", `${payment.amount.toFixed(2)} CZK`);
                }
                // Display total paid amount
                leftRightText("PAID AMOUNT:", `${totalCZK.toFixed(2)} CZK`);
            } else {
                // Normal payment (single method)
                const paymentMethodResolved = resolvePaymentMethodName(order);
                const paymentMethod = paymentMethodResolved === "Card" || paymentMethodResolved === "Card - Contactless"
                    ? "Card - Contactless"
                    : paymentMethodResolved || "Card - Contactless";

                leftRightText(paymentMethod + ":", `${totalCZK.toFixed(2)} CZK`);

                if (order.givenAmount && order.givenAmount > 0) {
                    leftRightText("Given amount:", `${order.givenAmount.toFixed(2)} CZK`);

                    if (order.change && order.change > 0) {
                        leftRightText("Change:", `${order.change.toFixed(2)} CZK`);
                    }
                } else {
                    leftRightText("Paid amount:", `${totalCZK.toFixed(2)} CZK`);
                }
            }
        }

        if (order.exchangeRate) {
            centerText(`Exchange rate: ${order.exchangeRate}`, 12);
            gap(2);
        }

        gap(2);

        if (qrCodeBuffer) {
            const qrTextAbove = getRawValue(order, 'qr_text_above') || getRawValue(order, 'qrTextAbove');

            if (qrTextAbove && isNotPlaceholder(qrTextAbove)) {
                doc.fontSize(11).font("Bebas Neue");
                centerText(qrTextAbove, 18);
                gap(2);
            }

            try {
                const qrWidthPoints = 120;
                const qrCenterXAdjusted = baseX + (contentWidth - qrWidthPoints) / 2;

                doc.image(qrCodeBuffer, qrCenterXAdjusted, doc.y, {
                    width: qrWidthPoints,
                    height: qrWidthPoints
                });

                doc.y = doc.y + qrWidthPoints + 2;
                console.log('✅ QR kód z company_google_reviews_qr_code vykreslen');

                const qrTextBelow = getRawValue(order, 'qr_text_below') || getRawValue(order, 'qrTextBelow');

                if (qrTextBelow && isNotPlaceholder(qrTextBelow)) {
                    gap(2);
                    doc.fontSize(11).font("Bebas Neue");
                    centerText(qrTextBelow, 18);
                }
            } catch (error) {
                console.error('❌ Chyba při vykreslování QR kódu:', error.message);
            }
        }

        const footerCustomText = getRawValue(order, 'footer_custom_text') || getRawValue(order, 'footerCustomText');
        const footerSocialText = getRawValue(order, 'footer_social_text') || getRawValue(order, 'footerSocialText');
        const footerSocialHandle = getRawValue(order, 'footer_social_handle') || getRawValue(order, 'footerSocialHandle');

        console.log('🔍 Footer values:', { footerCustomText, footerSocialText, footerSocialHandle });

        if (footerCustomText && isNotPlaceholder(footerCustomText)) {
            doc.fontSize(18).font("Bebas Neue");
            centerText(footerCustomText, 18);
            gap(2);
        }

        if (footerSocialText && isNotPlaceholder(footerSocialText)) {
            doc.fontSize(11).font("Bebas Neue");
            centerText(footerSocialText, 11);
        }

        if (footerSocialHandle && isNotPlaceholder(footerSocialHandle)) {
            doc.fontSize(11).font("Bebas Neue");
            centerText(footerSocialHandle, 11);
        }

        gap(2);
        stream.on('finish', () => {
            console.log('✅ Dynamický template PDF dokončen:', tmpPath);
            resolve(tmpPath);
        });
        stream.on('error', reject);
        doc.on('error', reject);

        doc.end();
    });
}

export { generateReceiptPDF };

