import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function generateReceiptPDF(order) {
    const tmpPath = path.join(os.tmpdir(), `receipt-${Date.now()}.pdf`);
    const doc = new PDFDocument({
        size: [226, 1000], // 80mm width, unlimited height
        margins: { top: 38, bottom: 38, left: 10, right: 10 } // ~1cm = 28.35pt, použiju 38pt pro jistotu
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

        // Create combined text "amount CZK" and align it to the right
        const combinedText = `${amount} ${currency}`;
        doc.text(combinedText, 140, startY, { width: 76, align: "right" });

        doc.y = startY + doc.heightOfString(leftText, { width: 130 });
    };

    const drawDottedLine = () => {
        const y = doc.y + 2;
        for (let x = 10; x < 216; x += 3) {
            doc.circle(x, y, 0.3).fill();
        }
        doc.moveDown(0.4);
    };

    // === ORDER NUMBER (top right) ===
    if (order.orderNumber) {
        doc.fontSize(30).font("Bebas Neue");
        doc.text(`#${order.orderNumber}`, { align: "right" });
        doc.moveDown(0.5);
    }

    // === LOGO ===
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');

        if (fs.existsSync(logoPath)) {
            console.log('📷 Načítám PNG logo ze souboru:', logoPath);

            // Jednoduché a čisté řešení pro logo
            const logoStartY = doc.y;
            const logoWidthPoints = 80; // rozumná velikost pro účtenku
            const centerXAdjusted = (226 - logoWidthPoints) / 2; // správné centrování

            doc.image(logoPath, centerXAdjusted, logoStartY, {
                width: logoWidthPoints
            });

            // Proporcionální výška a mezera
            const logoHeight = (logoWidthPoints * 1395 / 1410);
            doc.y = logoStartY + logoHeight + 8;

            console.log('✅ PNG Logo načteno - šířka:', logoWidthPoints, 'výška:', logoHeight, 'pozice Y:', doc.y);
        } else {
            console.log('❌ PNG logo soubor neexistuje:', logoPath);
            // Textové logo jako fallback
            centerText("LOOTEA", 25, "Bebas Neue");
            doc.moveDown(0.2);
        }
    } catch (error) {
        console.log('❌ Chyba při načítání PNG loga:', error.message);
        // Textové logo jako fallback
        centerText("LOOTEA", 25, "Bebas Neue");
        doc.moveDown(0.2);
    }

    // === COMPANY NAME ===
    centerText("We Are Lootea s.r.o.", 18, "Bebas Neue");
    doc.moveDown(0.3);

    // === COMPANY DETAILS ===
    doc.fontSize(11).font("Bebas Neue");
    centerText("VAT: CZ11838787", 11);
    centerText("Rybná 716/24", 11);
    centerText("110 00, Prague", 11);
    centerText("Czech Republic", 11);

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

    // Receipt number (main receipt number)
    doc.fontSize(12).font("Bebas Neue");
    doc.text(`Receipt No.: ${order.receiptNumber || order.orderNumber}`);

    // For refunds, show which receipt is being refunded
    if (order.originalReceiptNumber) {
        doc.text(`Refunded Receipt No.: ${order.originalReceiptNumber}`);
    }

    // Customer name
    if (order.customerName && order.customerName !== "Walk-in Customer") {
        doc.text(`Customer: ${order.customerName}`);
    }

    doc.text(`${order.createdAt}`);

    // Solid line separator
    doc.moveDown(0.3);
    doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
    doc.moveDown(0.3);

    doc.moveDown(0.5);

    // === ITEMS ===
    let itemCount = 0;

    order.items.forEach((item) => {
        itemCount += item.qty;

        // Item name
        doc.fontSize(11).font("Bebas Neue");
        doc.text(item.name);

        // Quantity and price (if qty > 1, show breakdown)
        const unitPrice = item.unitPrice || item.price;
        const itemTotal = item.qty * unitPrice;

        // For refunds, show negative values
        const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
        const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;

        if (item.qty > 1) {
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
    if (order.subtotal && order.subtotal !== order.totalCZK) {
        const displaySubtotal = isRefund ? -Math.abs(order.subtotal) : order.subtotal;
        leftRightText("Subtotal:", `${displaySubtotal.toFixed(2)} CZK`);
    }

    // Taxes
    if (order.vat && order.vat.length > 0) {
        order.vat.forEach((vatItem) => {
            const displayVatAmount = isRefund ? -Math.abs(vatItem.amount) : vatItem.amount;
            leftRightText(`Tax ${vatItem.rate}%:`, `${displayVatAmount.toFixed(2)} CZK`);
        });
    }

    // Discount - show how much customer saved
    if (order.discountAmount && order.discountAmount > 0) {
        // Build discount label with type
        let discountLabel = "Discount";

        // Priority: discountPercent > discountName > discountType
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

        // Show savings message
        doc.fontSize(11).font("Bebas Neue");
        doc.fillColor('#666666');
        doc.text(`You saved ${order.discountAmount.toFixed(2)} CZK!`, { align: "center" });
        doc.fillColor('#000000');
        doc.fontSize(13);
    }

    doc.moveDown(0.3);

    // === TOTAL ===
    // For refunds, show as negative or positive refund amount
    const displayTotal = isRefund ? -Math.abs(order.totalCZK) : order.totalCZK;
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
        // For refunds, show "Refunded amount" instead of payment
        const paymentMethod = order.paymentMethod || "Card";
        leftRightText(paymentMethod + ":", `${displayTotal.toFixed(2)} CZK`);
        leftRightText("Refunded amount:", `${displayTotal.toFixed(2)} CZK`);
    } else {
        // Normal payment
        const paymentMethod = order.paymentMethod === "Card" || order.paymentMethod === "Card - Contactless"
            ? "Card - Contactless"
            : order.paymentMethod || "Card - Contactless";

        leftRightText(paymentMethod + ":", `${order.totalCZK.toFixed(2)} CZK`);

        // For cash payments, show given amount and change
        if (order.givenAmount && order.givenAmount > 0) {
            leftRightText("Given amount:", `${order.givenAmount.toFixed(2)} CZK`);

            if (order.change && order.change > 0) {
                leftRightText("Change:", `${order.change.toFixed(2)} CZK`);
            }
        } else {
            // Standard paid amount (for card payments)
            leftRightText("Paid amount:", `${order.totalCZK.toFixed(2)} CZK`);
        }
    }

    doc.moveDown(1);

    // === FOOTER ===
    if (order.exchangeRate) {
        centerText(`Exchange rate: ${order.exchangeRate}`, 12);
        doc.moveDown(0.3);
    }

    doc.moveDown(1);

    centerText("LOOT YOUR BALLS", 18, "Bebas Neue");
    doc.moveDown(0.1);
    centerText("Enjoy & follow us on our social media", 11, "Bebas Neue");
    centerText("@looteacz", 11, "Bebas Neue");

    // Extra space at bottom
    doc.moveDown(1);

    doc.end();
    return tmpPath;
}

export { generateReceiptPDF };
