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
                const year = dateParts[0];
                const month = dateParts[1].padStart(2, '0');
                const day = dateParts[2].padStart(2, '0');
                formattedDate = `${day}-${month}-${year}`;
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

async function generateReceiptPDF(order) {
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
        const doc = new PDFDocument({
            size: [226, 1000],
            margins: { top: 38, bottom: 38, left: 10, right: 10 }
        });
        try {
            const bebasFontPath = path.join(__dirname, '..', 'fonts', 'BebasNeue-Regular.ttf');
            if (fs.existsSync(bebasFontPath)) {
                doc.registerFont('Bebas Neue', bebasFontPath);
            }
        } catch (error) {
            console.log('Bebas Neue font not found, using default fonts');
        }

        doc.pipe(fs.createWriteStream(tmpPath));


        const centerText = (text, fontSize = 10, font = "Bebas Neue") => {
            doc.fontSize(fontSize).font(font).text(text, 10, doc.y, { width: 206, align: "center" });
        };

        const leftRightText = (leftText, rightText, fontSize = 10, font = "Bebas Neue") => {
            const startY = doc.y;
            doc.fontSize(fontSize).font(font);
            doc.text(leftText, 10, startY, { width: 130, align: "left" });
            doc.text(rightText, 140, startY, { width: 66, align: "right" });
            doc.y = startY + doc.heightOfString(leftText, { width: 130 });
        };

        const leftRightTextWithCurrency = (leftText, amount, currency = "CZK", fontSize = 10, font = "Bebas Neue") => {
            const startY = doc.y;
            doc.fontSize(fontSize).font(font);
            doc.text(leftText, 10, startY, { width: 130, align: "left" });

            const combinedText = `${amount} ${currency}`;
            doc.text(combinedText, 140, startY, { width: 76, align: "right" });

            doc.y = startY + doc.heightOfString(leftText, { width: 130 });
        };

        const orderNumber = getRawValue(order, 'orderNumber') || getRawValue(order, 'order_number');
        console.log('🔍 Order Number:', { orderNumber, isNotPlaceholder: orderNumber ? isNotPlaceholder(orderNumber) : false, rawOrderNumber: order.orderNumber, rawOrder_number: order.order_number });
        if (orderNumber && isNotPlaceholder(orderNumber)) {
            const orderText = `#${orderNumber}`;
            const maxWidth = 206;
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


            doc.text(orderText, 10, doc.y, { width: maxWidth, align: "right" });
            doc.moveDown(0.5);
        }

        // === LOGO ===
        const logoStartY = doc.y;
        let logoHeight = 0;
        const logoWidthPoints = 120;
        const centerXAdjusted = (226 - logoWidthPoints) / 2;
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
                doc.moveDown(1.5);
            } catch (error) {
                console.error('❌ Chyba při vykreslování loga z bufferu:', error.message);
                hasLogoImage = false;
            }
        }

        // === COMPANY NAME ===
        const companyName = getValue(order, 'company_name');
        if (!hasLogoImage) {
            centerText(companyName, 25, "Bebas Neue");
            doc.moveDown(0.2);
        }

        if (hasLogoImage) {
            centerText(companyName, 18, "Bebas Neue");
            doc.moveDown(0.3);
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

        doc.moveDown(0.8);

        const isRefund = order.isRefund || order.totalCZK < 0;

        doc.fontSize(12).font("Bebas Neue");

        if (isRefund) {
            centerText("REFUND RECEIPT", 20, "Bebas Neue");
            doc.moveDown(0.3);
        }

        const receiptNumber = getRawValue(order, 'receiptNumber') || getRawValue(order, 'receipt_number') || orderNumber;
        console.log('🔍 Receipt Number:', { receiptNumber, isNotPlaceholder: receiptNumber ? isNotPlaceholder(receiptNumber) : false, rawReceiptNumber: order.receiptNumber, rawReceipt_number: order.receipt_number });
        if (receiptNumber && isNotPlaceholder(receiptNumber)) {
            doc.fontSize(12).font("Bebas Neue");
            doc.text(`Receipt No.: ${receiptNumber}`);
        }

        const originalReceiptNumber = getRawValue(order, 'originalReceiptNumber') || getRawValue(order, 'original_receipt_number');
        if (originalReceiptNumber && isNotPlaceholder(originalReceiptNumber)) {
            doc.text(`Refunded Receipt No.: ${originalReceiptNumber}`);
        }

        const customerName = getRawValue(order, 'customerName') || getRawValue(order, 'customer_name');
        console.log('🔍 Customer Name:', { customerName, isNotPlaceholder: customerName ? isNotPlaceholder(customerName) : false, rawCustomerName: order.customerName, rawCustomer_name: order.customer_name });
        if (customerName && isNotPlaceholder(customerName) && customerName !== "Walk-in Customer") {
            doc.text(`Customer: ${customerName}`);
        }

        const createdAt = getRawValue(order, 'createdAt') || getRawValue(order, 'created_at');
        console.log('🔍 Created At:', { createdAt, isNotPlaceholder: createdAt ? isNotPlaceholder(createdAt) : false, rawCreatedAt: order.createdAt, rawCreated_at: order.created_at });
        if (createdAt && isNotPlaceholder(createdAt)) {
            const formattedDate = formatDate(createdAt);
            doc.text(`Date: ${formattedDate}`);
        }

        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);
        doc.moveDown(0.5);
        let itemCount = 0;
        const items = order.items || [];

        items.forEach((item) => {
            itemCount += item.qty || 1;

            doc.fontSize(11).font("Bebas Neue");
            doc.text(item.name || '');

            const unitPrice = item.unitPrice || item.price || 0;
            const itemTotal = (item.qty || 1) * unitPrice;

            const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
            const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;

            if ((item.qty || 1) > 1) {
                leftRightText(`${item.qty} × ${displayUnitPrice.toFixed(2)} CZK`, "");
            }

            doc.text(`${displayItemTotal.toFixed(2)} CZK`, { align: "right" });
            doc.moveDown(0.2);
        });

        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);
        leftRightText(`Items Count: ${itemCount}`, "");

        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);
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

            doc.fontSize(11).font("Bebas Neue");
            doc.fillColor('#666666');
            doc.text(`You saved ${order.discountAmount.toFixed(2)} CZK!`, { align: "center" });
            doc.fillColor('#000000');
            doc.fontSize(13);
        }

        doc.moveDown(0.3);

        const totalCZK = order.totalCZK || 0;
        const displayTotal = isRefund ? -Math.abs(totalCZK) : totalCZK;
        leftRightTextWithCurrency("TOTAL:", displayTotal.toFixed(2), "CZK", 15, "Bebas Neue");

        if (order.totalEUR) {
            doc.fontSize(12).font("Bebas Neue");
            const displayTotalEUR = isRefund ? -Math.abs(order.totalEUR) : order.totalEUR;
            doc.text(`= ${displayTotalEUR.toFixed(2)} EUR`, { align: "right" });
        }

        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);
        doc.moveDown(0.5);

        doc.fontSize(15).font("Bebas Neue");

        if (isRefund) {
            const paymentMethod = order.paymentMethod || "Card";
            leftRightText(paymentMethod + ":", `${displayTotal.toFixed(2)} CZK`);
            leftRightText("Refunded amount:", `${displayTotal.toFixed(2)} CZK`);
        } else {
            const paymentMethod = order.paymentMethod === "Card" || order.paymentMethod === "Card - Contactless"
                ? "Card - Contactless"
                : order.paymentMethod || "Card - Contactless";

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

        doc.moveDown(1);

        if (order.exchangeRate) {
            centerText(`Exchange rate: ${order.exchangeRate}`, 12);
            doc.moveDown(0.3);
        }

        doc.moveDown(1);

        if (qrCodeBuffer) {
            const qrTextAbove = getRawValue(order, 'qr_text_above') || getRawValue(order, 'qrTextAbove');

            if (qrTextAbove && isNotPlaceholder(qrTextAbove)) {
                doc.fontSize(11).font("Bebas Neue");
                centerText(qrTextAbove, 18);
                doc.moveDown(0.3);
            }

            try {
                const qrWidthPoints = 120;
                const qrCenterXAdjusted = (226 - qrWidthPoints) / 2;

                doc.image(qrCodeBuffer, qrCenterXAdjusted, doc.y, {
                    width: qrWidthPoints,
                    height: qrWidthPoints
                });

                doc.y = doc.y + qrWidthPoints + 8;
                console.log('✅ QR kód z company_google_reviews_qr_code vykreslen');

                const qrTextBelow = getRawValue(order, 'qr_text_below') || getRawValue(order, 'qrTextBelow');

                if (qrTextBelow && isNotPlaceholder(qrTextBelow)) {
                    doc.moveDown(0.5);
                    doc.fontSize(18).font("Bebas Neue");
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
            doc.moveDown(0.1);
        }

        if (footerSocialText && isNotPlaceholder(footerSocialText)) {
            doc.fontSize(11).font("Bebas Neue");
            centerText(footerSocialText, 11);
        }

        if (footerSocialHandle && isNotPlaceholder(footerSocialHandle)) {
            doc.fontSize(11).font("Bebas Neue");
            centerText(footerSocialHandle, 11);
        }

        doc.moveDown(1);
        doc.on('end', () => {
            console.log('✅ Dynamický template PDF dokončen:', tmpPath);
            resolve(tmpPath);
        });

        doc.on('error', (error) => {
            console.error('❌ Chyba při generování dynamického template PDF:', error);
            reject(error);
        });

        doc.end();
    });
}

export { generateReceiptPDF };

