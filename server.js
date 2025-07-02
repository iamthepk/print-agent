import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

console.log('📄 RECEIPT_PRINTER:', process.env.RECEIPT_PRINTER || 'NENASTAVENO')
console.log('🏷️ STICKER_PRINTER:', process.env.STICKER_PRINTER || 'NENASTAVENO')

// Přidání základní HTML stránky
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Agent API</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 20px auto;
                    padding: 0 20px;
                    line-height: 1.6;
                }
                pre {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
                .endpoint {
                    margin-bottom: 30px;
                }
                h1 { color: #2c3e50; }
                h2 { color: #34495e; }
                code { background: #f8f9fa; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🖨️ Print Agent API</h1>
            <p>Lokální tiskový agent pro tisk účtenek a štítků.</p>
            
            <div class="endpoint">
                <h2>📝 Tisk účtenky</h2>
                <code>POST /print-receipt</code>
                <pre>
{
  "receiptNo": "123",
  "createdAt": "2024-03-18 12:34",
  "items": [
    {
      "qty": 1,
      "name": "Brown Sugar Milk Tea",
      "price": 89
    }
  ],
  "totalCZK": 89,
  "totalEUR": 3.50,
  "exchangeRate": "25.4 CZK/EUR",
  "paymentMethod": "Hotovost"
}</pre>
            </div>

            <div class="endpoint">
                <h2>🏷️ Tisk štítku</h2>
                <code>POST /print-sticker</code>
                <pre>
{
  "pcs": "1",
  "name": "Brown Sugar 700ml",
  "order": "123",
  "round": "1",
  "sweetness": "less sweet",
  "ice": "less ice",
  "message": "Smile, You are beautiful!",
  "toppings": ["Blueberry", "Peach"]
}</pre>
            </div>

            <div class="endpoint">
                <h2>💰 Otevření pokladní zásuvky</h2>
                <code>POST /open-drawer</code>
                <p>Otevře pokladní zásuvku pomocí ESC/POS příkazu.</p>
                <p>Odpověď: <code>{"status": "ok", "message": "Pokladní zásuvka otevřena"}</code></p>
            </div>

            <div class="endpoint">
                <h2>💓 Healthcheck</h2>
                <code>GET /healthcheck</code>
                <p>Vrací: <code>{"status": "ok"}</code></p>
            </div>

            <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
                <p>Tiskárny:</p>
                <ul>
                    <li>Účtenky: ${process.env.RECEIPT_PRINTER || 'NENASTAVENO'}</li>
                    <li>Štítky: ${process.env.STICKER_PRINTER || 'NENASTAVENO'}</li>
                </ul>
            </footer>
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
    console.log('📦 Přijatá data pro štítek:', req.body)
    try {
        await printSticker(req.body)
        res.json({ status: 'ok', message: 'Štítek odeslán k tisku' })
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
