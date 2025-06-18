import fs from "fs";
import os from "os";
import path from "path";
import PDFDocument from "pdfkit";

function generateReceiptPDF(order) {
    const tmpPath = path.join(os.tmpdir(), `receipt-${Date.now()}.pdf`);
    const doc = new PDFDocument({
        size: [226, 300], // 80mm x 106mm v bodech, menší výška
        margins: { top: 0, bottom: 10, left: 5, right: 5 }
    });

    doc.pipe(fs.createWriteStream(tmpPath));

    doc.fontSize(16).font("Helvetica-Bold").text("LOOTEA", 0, -10, { align: "center" });
    doc.fontSize(8).font("Helvetica").text("I LOOT YOUR BALLS", { align: "center" });

    doc.fontSize(10).font("Helvetica-Bold").text("We Are Lootea s.r.o.", { align: "center" });
    doc.fontSize(8).text("VAT: CZ11838787", { align: "center" });
    doc.text("Rybná 716/24, 110 00 Prague", { align: "center" });
    doc.moveDown();

    doc.fontSize(8).text(`Receipt No.: ${order.receiptNo}`);
    doc.text(`Date: ${order.createdAt}`);
    doc.moveDown();

    order.items.forEach((item) => {
        const line = `${item.qty}× ${item.name}`;
        const price = `${item.qty * item.price} Kč`;
        doc.text(line, { continued: true }).text(price, { align: "right" });
    });

    doc.moveDown().moveTo(doc.x, doc.y).lineTo(170, doc.y).stroke();
    doc.moveDown();

    doc.font("Helvetica-Bold").text("TOTAL:", { continued: true }).text(`${order.totalCZK} Kč`, { align: "right" });
    doc.font("Helvetica").text(`= ${order.totalEUR} €`, { align: "right" });
    doc.moveDown();

    doc.text(`${order.paymentMethod}:`, { continued: true }).text(`${order.totalCZK} Kč`, { align: "right" });
    doc.text("Paid:", { continued: true }).text(`${order.totalCZK} Kč`, { align: "right" });
    doc.moveDown();

    doc.text(`Exchange rate: ${order.exchangeRate}`, { align: "center" });
    doc.moveDown().moveDown();

    doc.fontSize(7).text("LOOT YOUR BALLS", { align: "center" });
    doc.text("Follow us: @looteacz", { align: "center" });

    doc.end();

    return tmpPath;
}

export { generateReceiptPDF };
