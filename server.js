import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'
import fs from 'fs'
import path from 'path'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Vyčisti temp složku při startu serveru
const tempDir = path.join(process.cwd(), 'temp')
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir)
}
fs.readdirSync(tempDir).forEach(file => {
    try {
        fs.unlinkSync(path.join(tempDir, file))
        console.log('🗑️ Smazán soubor z temp:', file)
    } catch (e) {
        console.warn('⚠️ Nepodařilo se smazat soubor z temp:', file, e.message)
    }
})

console.log('📄 RECEIPT_PRINTER:', process.env.RECEIPT_PRINTER || 'NENASTAVENO')
console.log('🏷️ STICKER_PRINTER:', process.env.STICKER_PRINTER || 'NENASTAVENO')

// Přidání základní HTML stránky
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="cs">
        <head>
            <meta charset="utf-8">
            <title>LOOTEA PRINT AGENT</title>
            <style>
                body {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #fafbfc;
                    margin: 0;
                }
                h1 {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    font-size: 3rem;
                    color: #2c3e50;
                    letter-spacing: 2px;
                }
            </style>
        </head>
        <body>
            <h1>LOOTEA PRINT AGENT</h1>
        </body>
        </html>
    `)
})

app.post('/print-receipt', async (req, res) => {
    try {
        await printReceipt(req.body)
        res.json({ status: 'ok' })
    } catch (e) {
        console.error('❌ Chyba při tisku účtenky:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})

app.post('/print-sticker', async (req, res) => {
    console.log('📦 Přijatá data pro štítek:', req.body) // ← DEBUG
    try {
        await printSticker(req.body)
        res.json({ status: 'ok' })
    } catch (e) {
        console.error('❌ Chyba při tisku štítku:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})

app.get('/healthcheck', (req, res) => {
    res.json({ status: 'ok' })
})

// Endpoint pro otevření pokladní zásuvky
app.post('/open-drawer', async (req, res) => {
    try {
        const { exec } = await import('child_process');
        const fs = await import('fs');

        // C# program pro otevření zásuvky pomocí Windows API
        const csharpCode = `
using System;
using System.Runtime.InteropServices;

class Program {
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFO di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFO {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    static void Main() {
        string printerName = "${process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt'}";
        byte[] bytes = new byte[] { 0x1B, 0x70, 0x30, 0x37, 0x79 };
        IntPtr printer = IntPtr.Zero;

        try {
            if (OpenPrinter(printerName, out printer, IntPtr.Zero)) {
                DOCINFO di = new DOCINFO();
                di.pDocName = "Open Drawer Command";
                di.pDataType = "RAW";

                if (StartDocPrinter(printer, 1, ref di)) {
                    if (StartPagePrinter(printer)) {
                        int bytesWritten;
                        if (WritePrinter(printer, bytes, bytes.Length, out bytesWritten)) {
                            Console.WriteLine("SUCCESS");
                        } else {
                            Console.WriteLine("ERROR: " + Marshal.GetLastWin32Error());
                        }
                        EndPagePrinter(printer);
                    }
                    EndDocPrinter(printer);
                }
            } else {
                Console.WriteLine("ERROR: Cannot open printer " + Marshal.GetLastWin32Error());
            }
        } finally {
            if (printer != IntPtr.Zero) {
                ClosePrinter(printer);
            }
        }
    }
}`;

        // Vytvoříme dočasný C# soubor
        const timestamp = Date.now();
        const csFile = `OpenDrawer_${timestamp}.cs`;
        const exeFile = `OpenDrawer_${timestamp}.exe`;

        fs.writeFileSync(csFile, csharpCode);

        // Zkompilujeme a spustíme C# program
        const command = `cmd /c "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe /nologo ${csFile} && ${exeFile}"`;

        exec(command, (error, stdout, stderr) => {
            // Smažeme dočasné soubory
            try {
                fs.unlinkSync(csFile);
                fs.unlinkSync(exeFile);
            } catch (cleanupError) {
                console.warn('⚠️ Nepodařilo se smazat dočasné soubory:', cleanupError.message);
            }

            if (error) {
                console.error('❌ Chyba při otevírání zásuvky:', error);
                res.status(500).json({ status: 'error', message: error.message });
                return;
            }

            if (stdout.includes('SUCCESS')) {
                console.log('💰 Pokladní zásuvka otevřena');
                res.json({ status: 'ok', message: 'Pokladní zásuvka otevřena' });
            } else {
                console.error('❌ Chyba při otevírání zásuvky:', stdout);
                res.status(500).json({ status: 'error', message: 'Nepodařilo se otevřít zásuvku: ' + stdout });
            }
        });
    } catch (e) {
        console.error('❌ Chyba při otevírání zásuvky:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`🚀 Print agent běží na http://localhost:${PORT}`)
})
