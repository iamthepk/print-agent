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
    // Debug log
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

async function generateReceiptPDF(order) {
    console.log('🎯 DYNAMICKÝ TEMPLATE - Začínám generovat PDF');
    console.log('🎯 Order keys:', Object.keys(order).filter(k => k.startsWith('company_')));
    console.log('🎯 useDynamicTemplate:', order.useDynamicTemplate);

    // Stáhneme obrázky před generováním PDF (pokud jsou URL nebo lokální soubory)
    let logoBuffer = null;
    let qrCodeBuffer = null;

    // Placeholdery - pouze z POS aplikace, žádné fallbacky
    const companyLogo = getValue(order, 'company_logo');
    const companyGoogleReviewsQrCode = getValue(order, 'company_google_reviews_qr_code') || getValue(order, 'company_qr');

    // Načti logo - primárně z POS URL, pokud selže, zkus lokální soubor, jinak placeholder
    if (companyLogo && !companyLogo.startsWith('<')) {
        // Pokud je to URL, zkus stáhnout z POS
        if (companyLogo.startsWith('http://') || companyLogo.startsWith('https://')) {
            try {
                console.log('📷 Stahuji logo z POS URL:', companyLogo);
                logoBuffer = await downloadImageFromUrl(companyLogo);
                console.log('✅ Logo staženo z POS URL');
            } catch (error) {
                console.warn('⚠️ Nepodařilo se stáhnout logo z POS URL, zkouším lokální soubor...', error.message);
                // Pokud selže stahování z URL, zkus lokální soubor jako zálohu
                try {
                    const localLogoPath = path.join(__dirname, '..', 'assets', 'company_logo.png');
                    if (fs.existsSync(localLogoPath)) {
                        console.log('📷 Načítám logo z lokálního souboru (záloha):', localLogoPath);
                        logoBuffer = fs.readFileSync(localLogoPath);
                        console.log('✅ Logo načteno z lokálního souboru (záloha)');
                    } else {
                        console.warn('⚠️ Lokální logo soubor také není k dispozici:', localLogoPath);
                        logoBuffer = null;
                    }
                } catch (localError) {
                    console.warn('⚠️ Nepodařilo se načíst ani lokální logo:', localError.message);
                    logoBuffer = null;
                }
            }
        } else {
            // Pokud není URL, zkus lokální soubor
            try {
                const localLogoPath = path.join(__dirname, '..', 'assets', companyLogo);
                if (fs.existsSync(localLogoPath)) {
                    console.log('📷 Načítám logo z lokálního souboru:', localLogoPath);
                    logoBuffer = fs.readFileSync(localLogoPath);
                    console.log('✅ Logo načteno z lokálního souboru');
                } else {
                    console.warn('⚠️ Logo soubor nenalezen:', localLogoPath);
                    logoBuffer = null;
                }
            } catch (error) {
                console.warn('⚠️ Nepodařilo se načíst logo:', error.message);
                logoBuffer = null;
            }
        }
    }

    // Načti QR kód - primárně z POS URL, pokud selže, zkus lokální soubor, jinak placeholder
    if (companyGoogleReviewsQrCode && !companyGoogleReviewsQrCode.startsWith('<')) {
        // Pokud je to URL, zkus stáhnout z POS
        if (companyGoogleReviewsQrCode.startsWith('http://') || companyGoogleReviewsQrCode.startsWith('https://')) {
            try {
                console.log('📷 Stahuji QR kód z POS URL:', companyGoogleReviewsQrCode);
                qrCodeBuffer = await downloadImageFromUrl(companyGoogleReviewsQrCode);
                console.log('✅ QR kód stažen z POS URL');
            } catch (error) {
                console.warn('⚠️ Nepodařilo se stáhnout QR kód z POS URL, zkouším lokální soubor...', error.message);
                // Pokud selže stahování z URL, zkus lokální soubor jako zálohu
                try {
                    const localQrPath = path.join(__dirname, '..', 'assets', 'company_qr.png');
                    if (fs.existsSync(localQrPath)) {
                        console.log('📷 Načítám QR kód z lokálního souboru (záloha):', localQrPath);
                        qrCodeBuffer = fs.readFileSync(localQrPath);
                        console.log('✅ QR kód načten z lokálního souboru (záloha)');
                    } else {
                        console.warn('⚠️ Lokální QR kód soubor také není k dispozici:', localQrPath);
                        qrCodeBuffer = null;
                    }
                } catch (localError) {
                    console.warn('⚠️ Nepodařilo se načíst ani lokální QR kód:', localError.message);
                    qrCodeBuffer = null;
                }
            }
        } else {
            // Pokud není URL, zkus lokální soubor
            try {
                const localQrPath = path.join(__dirname, '..', 'assets', companyGoogleReviewsQrCode);
                if (fs.existsSync(localQrPath)) {
                    console.log('📷 Načítám QR kód z lokálního souboru:', localQrPath);
                    qrCodeBuffer = fs.readFileSync(localQrPath);
                    console.log('✅ QR kód načten z lokálního souboru');
                } else {
                    console.warn('⚠️ QR kód soubor nenalezen:', localQrPath);
                    qrCodeBuffer = null;
                }
            } catch (error) {
                console.warn('⚠️ Nepodařilo se načíst QR kód:', error.message);
                qrCodeBuffer = null;
            }
        }
    }

    // Nyní vytvoříme PDF - musíme použít Promise, protože PDFKit používá stream
    return new Promise((resolve, reject) => {
        const tmpPath = path.join(os.tmpdir(), `receipt-dynamic-${Date.now()}.pdf`);
        const doc = new PDFDocument({
            size: [226, 1000], // 80mm width, unlimited height
            margins: { top: 38, bottom: 38, left: 10, right: 10 }
        });

        // Register Bebas Neue font (if available)
        try {
            const bebasFontPath = path.join(__dirname, '..', 'fonts', 'BebasNeue-Regular.ttf');
            if (fs.existsSync(bebasFontPath)) {
                doc.registerFont('Bebas Neue', bebasFontPath);
            }
        } catch (error) {
            console.log('Bebas Neue font not found, using default fonts');
        }

        doc.pipe(fs.createWriteStream(tmpPath));

        // Helper functions
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

        // === ORDER NUMBER (top right) ===
        const orderNumber = getValue(order, 'order_number') || getValue(order, 'orderNumber');
        if (orderNumber) {
            doc.fontSize(30).font("Bebas Neue");
            doc.text(`#${orderNumber}`, { align: "right" });
            doc.moveDown(0.5);
        }

        // === LOGO ===
        // Placeholder: company_logo (URL z POS aplikace)
        const logoStartY = doc.y;
        let logoHeight = 0;
        const logoWidthPoints = 80;
        const centerXAdjusted = (226 - logoWidthPoints) / 2;
        let hasLogoImage = false;

        if (logoBuffer) {
            // Logo z company_logo URL nebo lokálního souboru
            try {
                doc.image(logoBuffer, centerXAdjusted, logoStartY, {
                    width: logoWidthPoints,
                    fit: [logoWidthPoints, logoWidthPoints * 2]
                });
                logoHeight = logoWidthPoints * 0.8;
                doc.y = logoStartY + logoHeight + 8;
                hasLogoImage = true;
                console.log('✅ Logo z company_logo vykresleno');
            } catch (error) {
                console.error('❌ Chyba při vykreslování loga z bufferu:', error.message);
                hasLogoImage = false;
                // Pokud selže vykreslení, zobrazíme placeholder
                doc.fontSize(11).font("Bebas Neue");
                centerText('<company_logo>', 11);
                doc.moveDown(0.2);
            }
        } else {
            // Pokud není logo buffer, zobrazíme placeholder
            doc.fontSize(11).font("Bebas Neue");
            // Pokud je hodnota placeholder, použij ji, jinak použij standardní placeholder
            const logoPlaceholder = companyLogo && companyLogo.startsWith('<') ? companyLogo : '<company_logo>';
            centerText(logoPlaceholder, 11);
            doc.moveDown(0.2);
        }

        // === COMPANY NAME ===
        // Placeholder: company_name (z POS aplikace)
        const companyName = getValue(order, 'company_name');
        if (!hasLogoImage) {
            // Textové logo pokud není company_logo - zobrazí company_name nebo <company_name>
            centerText(companyName, 25, "Bebas Neue");
            doc.moveDown(0.2);
        }

        // Zobraz company_name (nebo <company_name>) - buď pod logem nebo samostatně
        if (hasLogoImage) {
            // Logo bylo zobrazeno, zobrazíme název firmy pod ním
            centerText(companyName, 18, "Bebas Neue");
            doc.moveDown(0.3);
        } else {
            // Logo nebylo zobrazeno, ale můžeme zobrazit company_name menším písmem (pokud už není jako textové logo)
            // Pokud už bylo zobrazeno jako textové logo výše, nezobrazujeme znovu
            // centerText(companyName, 18, "Bebas Neue");
            // doc.moveDown(0.3);
        }

        // === COMPANY DETAILS ===
        // Všechna pole z POS aplikace - pokud chybí, zobrazí se <placeholder>
        doc.fontSize(11).font("Bebas Neue");

        // Placeholder: company_VAT (z POS aplikace)
        const companyVAT = getValue(order, 'company_VAT');
        centerText(`${companyVAT}`, 11);

        // Placeholder: company_address (z POS aplikace)
        const companyAddress = getValue(order, 'company_address');
        centerText(companyAddress, 11);

        // Placeholder: company_city a company_poscode (z POS aplikace)
        const companyCity = getValue(order, 'company_city');
        const companyPostalCode = getValue(order, 'company_poscode');
        centerText(`${companyCity} ${companyPostalCode}`, 11);

        // Placeholder: company_country (z POS aplikace)
        const companyCountry = getValue(order, 'company_country');
        centerText(companyCountry, 11);

        // Placeholder: company_phone (z POS aplikace)
        const companyPhone = getValue(order, 'company_phone');
        centerText(companyPhone, 11);

        // Placeholder: company_email (z POS aplikace)
        const companyEmail = getValue(order, 'company_email');
        centerText(companyEmail, 11);

        // Placeholder: company_website (z POS aplikace)
        const companyWebsite = getValue(order, 'company_website');
        centerText(companyWebsite, 11);

        doc.moveDown(0.8);

        // === RECEIPT TYPE (REFUND OR NORMAL) ===
        const isRefund = order.isRefund || order.totalCZK < 0;

        // === RECEIPT INFO ===
        doc.fontSize(12).font("Bebas Neue");

        // Show RECEIPT TYPE header
        if (isRefund) {
            centerText("REFUND RECEIPT", 20, "Bebas Neue");
            doc.moveDown(0.3);
        }

        // Receipt number
        const receiptNumber = getValue(order, 'receipt_number') || getValue(order, 'receiptNumber') || orderNumber;
        doc.fontSize(12).font("Bebas Neue");
        doc.text(`Receipt No.: ${receiptNumber}`);

        // For refunds, show which receipt is being refunded
        const originalReceiptNumber = getValue(order, 'original_receipt_number') || getValue(order, 'originalReceiptNumber');
        if (originalReceiptNumber) {
            doc.text(`Refunded Receipt No.: ${originalReceiptNumber}`);
        }

        // Customer name
        const customerName = getValue(order, 'customer_name') || getValue(order, 'customerName');
        if (customerName && customerName !== "Walk-in Customer") {
            doc.text(`Customer: ${customerName}`);
        }

        const createdAt = getValue(order, 'created_at') || getValue(order, 'createdAt');
        if (createdAt) {
            doc.text(createdAt);
        }

        // Solid line separator
        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);

        doc.moveDown(0.5);

        // === ITEMS ===
        let itemCount = 0;
        const items = order.items || [];

        items.forEach((item) => {
            itemCount += item.qty || 1;

            // Item name
            doc.fontSize(11).font("Bebas Neue");
            doc.text(item.name || '');

            // Quantity and price
            const unitPrice = item.unitPrice || item.price || 0;
            const itemTotal = (item.qty || 1) * unitPrice;

            // For refunds, show negative values
            const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
            const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;

            if ((item.qty || 1) > 1) {
                leftRightText(`${item.qty} × ${displayUnitPrice.toFixed(2)} CZK`, "");
            }

            // Total price right aligned
            doc.text(`${displayItemTotal.toFixed(2)} CZK`, { align: "right" });
            doc.moveDown(0.2);
        });

        // Solid line separator
        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);

        // === SUMMARY ===
        leftRightText(`Items Count: ${itemCount}`, "");

        // Solid line separator
        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);

        // Subtotal
        const subtotal = order.subtotal;
        if (subtotal && subtotal !== order.totalCZK) {
            const displaySubtotal = isRefund ? -Math.abs(subtotal) : subtotal;
            leftRightText("Subtotal:", `${displaySubtotal.toFixed(2)} CZK`);
        }

        // Taxes
        if (order.vat && order.vat.length > 0) {
            order.vat.forEach((vatItem) => {
                const displayVatAmount = isRefund ? -Math.abs(vatItem.amount) : vatItem.amount;
                leftRightText(`Tax ${vatItem.rate}%:`, `${displayVatAmount.toFixed(2)} CZK`);
            });
        }

        // Discount
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

        // === TOTAL ===
        const totalCZK = order.totalCZK || 0;
        const displayTotal = isRefund ? -Math.abs(totalCZK) : totalCZK;
        leftRightTextWithCurrency("TOTAL:", displayTotal.toFixed(2), "CZK", 15, "Bebas Neue");

        // EUR equivalent
        if (order.totalEUR) {
            doc.fontSize(12).font("Bebas Neue");
            const displayTotalEUR = isRefund ? -Math.abs(order.totalEUR) : order.totalEUR;
            doc.text(`= ${displayTotalEUR.toFixed(2)} EUR`, { align: "right" });
        }

        // Solid line separator
        doc.moveDown(0.3);
        doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
        doc.moveDown(0.3);

        doc.moveDown(0.5);

        // === PAYMENT ===
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

        // === FOOTER ===
        if (order.exchangeRate) {
            centerText(`Exchange rate: ${order.exchangeRate}`, 12);
            doc.moveDown(0.3);
        }

        doc.moveDown(1);

        // === QR CODE ===
        // Placeholder: company_google_reviews_qr_code (URL z POS aplikace)
        const qrPlaceholderValue = companyGoogleReviewsQrCode && companyGoogleReviewsQrCode.startsWith('<')
            ? companyGoogleReviewsQrCode
            : '<company_google_reviews_qr_code>';

        console.log('🔍 QR Code:', { hasBuffer: !!qrCodeBuffer, qrPlaceholder: qrPlaceholderValue, companyGoogleReviewsQrCode });


        doc.fontSize(11).font("Bebas Neue");
        centerText("We appreciate your feedback", 18);
        doc.moveDown(0.3);

        if (qrCodeBuffer) {
            try {
                const qrWidthPoints = 80;
                const qrCenterXAdjusted = (226 - qrWidthPoints) / 2;

                doc.image(qrCodeBuffer, qrCenterXAdjusted, doc.y, {
                    width: qrWidthPoints,
                    height: qrWidthPoints
                });

                doc.y = doc.y + qrWidthPoints + 8;
                console.log('✅ QR kód z company_google_reviews_qr_code vykreslen');
            } catch (error) {
                console.error('❌ Chyba při vykreslování QR kódu:', error.message);
                // Pokud selže obrázek, zobrazíme placeholder
                centerText(qrPlaceholderValue, 11);
            }
        } else {
            // Pokud není QR kód buffer, zobrazíme placeholder
            centerText(qrPlaceholderValue, 11);
        }

        doc.moveDown(1);

        // === FOOTER TEXT ===
        // Placeholdery pro footer text z POS aplikace
        const footerCustomText = getValue(order, 'footer_custom_text');
        const footerSocialText = getValue(order, 'footer_social_text');
        const footerSocialHandle = getValue(order, 'footer_social_handle');

        console.log('🔍 Footer values:', { footerCustomText, footerSocialText, footerSocialHandle });

        // Vždy zobrazíme footer text (pokud není placeholder, použijeme hodnotu z POS, jinak výchozí)
        doc.fontSize(18).font("Bebas Neue");
        if (!footerCustomText.startsWith('<')) {
            centerText(footerCustomText, 18);
        } else {
            centerText("LOOT YOUR BALLS", 18);
        }
        doc.moveDown(0.1);

        doc.fontSize(11).font("Bebas Neue");
        if (!footerSocialText.startsWith('<')) {
            centerText(footerSocialText, 11);
        } else {
            centerText("Enjoy & follow us on our social media", 11);
        }

        if (!footerSocialHandle.startsWith('<')) {
            centerText(footerSocialHandle, 11);
        } else {
            centerText("@looteacz", 11);
        }

        doc.moveDown(1);


        // Čekáme na dokončení zápisu PDF
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

