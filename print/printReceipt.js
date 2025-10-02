import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateReceiptPDF } from '../templates/receiptTemplate.js';

dotenv.config();

const execAsync = promisify(exec);
const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt';
const SUMATRA_PATH = process.env.SUMATRA_PATH || `"C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

/**
 * 🖨️ Vytiskne účtenku jako PDF přes SumatraPDF
 */
async function printReceipt(order) {
    try {
        // Počkáme na vygenerování PDF
        const pdfPath = await generateReceiptPDF(order);

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
