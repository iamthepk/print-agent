import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { generateReceiptPDF } from '../templates/receiptTemplate.js';

dotenv.config();

const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt';
const SUMATRA_PATH = `"C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

/**
 * 🖨️ Vytiskne účtenku jako PDF přes SumatraPDF
 */
async function printReceipt(order) {
    try {
        const pdfPath = await generateReceiptPDF(order);

        if (!fs.existsSync(SUMATRA_PATH.replace(/"/g, ''))) {
            throw new Error('❌ SumatraPDF.exe nebyl nalezen na zadané cestě.');
        }

        const command = `${SUMATRA_PATH} -print-to "${RECEIPT_PRINTER}" "${pdfPath}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ SumatraPDF tisk selhal:', error);
                console.error(stderr);
                return;
            }

            console.log(`✅ PDF receipt sent to "${RECEIPT_PRINTER}" via SumatraPDF`);
        });
    } catch (err) {
        console.error('❌ Chyba při tisku účtenky:', err);
    }
}

export { printReceipt };
