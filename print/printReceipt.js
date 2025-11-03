import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateReceiptPDF } from '../templates/receiptTemplateDynamic.js';

dotenv.config();

const execAsync = promisify(exec);
const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt';
const SUMATRA_PATH = process.env.SUMATRA_PATH || `"C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

/**
 * 🖨️ Vytiskne účtenku jako PDF přes SumatraPDF
 * @param {Object} order - Data účtenky
 */
async function printReceipt(order) {
    try {
        console.log(`📄 ============================================`);
        console.log(`📄 Používám dynamický template pro účtenku`);
        console.log(`📄 Receipt Number: ${order.receiptNumber || 'N/A'}`);
        console.log(`📄 company_name: ${order.company_name || 'NENÍ'}`);
        console.log(`📄 company_phone: ${order.company_phone || 'NENÍ'}`);
        console.log(`📄 company_address: ${order.company_address || 'NENÍ'}`);
        console.log(`📄 ============================================`);

        // Počkáme na vygenerování PDF
        const pdfPath = await generateReceiptPDF(order);
        console.log(`📄 PDF vygenerováno: ${pdfPath}`);

        // Počkáme 500ms pro jistotu, že je PDF plně zapsáno
        await new Promise(resolve => setTimeout(resolve, 500));

        // Kontrola existence SumatraPDF
        const sumatraPathClean = SUMATRA_PATH.replace(/"/g, '');
        if (!fs.existsSync(sumatraPathClean)) {
            throw new Error(`❌ SumatraPDF.exe nebyl nalezen na cestě: ${sumatraPathClean}`);
        }

        // Kontrola existence PDF souboru
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`❌ PDF soubor nebyl vytvořen na cestě: ${pdfPath}`);
        }

        const command = `${SUMATRA_PATH} -print-to "${RECEIPT_PRINTER}" -silent "${pdfPath}"`;
        console.log('🖨️ Spouštím tisk (silent mode):', command);

        // Použijeme promisifikovanou verzi exec s možnostmi pro tichý běh
        const { stdout, stderr } = await execAsync(command, {
            windowsHide: true,
            timeout: 30000
        });

        if (stderr) {
            console.error('⚠️ SumatraPDF varování:', stderr);
        }

        console.log(`✅ PDF účtenka odeslána na "${RECEIPT_PRINTER}" přes SumatraPDF`);

        // Počkáme chvíli a pak smažeme dočasný PDF soubor
        setTimeout(() => {
            try {
                fs.unlinkSync(pdfPath);
                console.log('🗑️ Dočasný PDF soubor smazán');
            } catch (e) {
                console.warn('⚠️ Nepodařilo se smazat dočasný PDF soubor:', e.message);
            }
        }, 5000);

        return { status: 'ok', message: 'Účtenka odeslána k tisku' };
    } catch (err) {
        console.error('❌ Chyba při tisku účtenky:', err);
        throw err; // Propagujeme chybu dál pro správné HTTP odpovědi
    }
}

export { printReceipt };
