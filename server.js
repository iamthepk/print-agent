import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Automatická detekce výchozí tiskárny pokud není nastavena
const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt'
const STICKER_PRINTER = process.env.STICKER_PRINTER || 'Brother QL-700'

console.log('📄 RECEIPT_PRINTER:', RECEIPT_PRINTER)
console.log('🏷️ STICKER_PRINTER:', STICKER_PRINTER)

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
                <button onclick="testDrawer()" style="background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 5px 10px 0;">
                    🧪 Testovat pokladní zásuvku
                </button>
                <button onclick="checkPrinter()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 0;">
                    🔍 Zkontrolovat tiskárnu
                </button>
                <div id="drawer-result" style="margin-top: 10px; padding: 10px; border-radius: 5px; display: none;"></div>
                <script>
                    async function testDrawer() {
                        const button = event.target;
                        const resultDiv = document.getElementById('drawer-result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Testuji...';
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = '⏳ Otevírám pokladní zásuvku...';
                        
                        try {
                            const response = await fetch('/open-drawer', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.style.background = '#d4edda';
                                resultDiv.style.color = '#155724';
                                resultDiv.style.border = '1px solid #c3e6cb';
                                resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Použitá tiskárna: ' + data.details.printer + '</small>';
                            } else {
                                resultDiv.style.background = '#f8d7da';
                                resultDiv.style.color = '#721c24';
                                resultDiv.style.border = '1px solid #f5c6cb';
                                resultDiv.innerHTML = '❌ ' + data.message + '<br><small>Chyba: ' + (data.details?.error || 'Neznámá chyba') + '</small>';
                            }
                        } catch (error) {
                            resultDiv.style.background = '#f8d7da';
                            resultDiv.style.color = '#721c24';
                            resultDiv.style.border = '1px solid #f5c6cb';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🧪 Testovat pokladní zásuvku';
                    }
                    
                    async function checkPrinter() {
                        const button = event.target;
                        const resultDiv = document.getElementById('drawer-result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Kontroluji...';
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = '⏳ Kontroluji dostupnost tiskárny...';
                        
                        try {
                            const response = await fetch('/check-printer');
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                if (data.available) {
                                    resultDiv.style.background = '#d4edda';
                                    resultDiv.style.color = '#155724';
                                    resultDiv.style.border = '1px solid #c3e6cb';
                                    resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Tiskárna: ' + data.printer + '</small>';
                                } else {
                                    resultDiv.style.background = '#fff3cd';
                                    resultDiv.style.color = '#856404';
                                    resultDiv.style.border = '1px solid #ffeaa7';
                                    resultDiv.innerHTML = '⚠️ ' + data.message + '<br><small>Tiskárna: ' + data.printer + '</small>';
                                }
                            } else {
                                resultDiv.style.background = '#f8d7da';
                                resultDiv.style.color = '#721c24';
                                resultDiv.style.border = '1px solid #f5c6cb';
                                resultDiv.innerHTML = '❌ ' + data.message;
                            }
                        } catch (error) {
                            resultDiv.style.background = '#f8d7da';
                            resultDiv.style.color = '#721c24';
                            resultDiv.style.border = '1px solid #f5c6cb';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🔍 Zkontrolovat tiskárnu';
                    }
                </script>
            </div>

            <div class="endpoint">
                <h2>💓 Healthcheck</h2>
                <code>GET /healthcheck</code>
                <p>Vrací: <code>{"status": "ok"}</code></p>
            </div>

            <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
                <p>Tiskárny:</p>
                <ul>
                    <li>Účtenky: ${RECEIPT_PRINTER}</li>
                    <li>Štítky: ${STICKER_PRINTER}</li>
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

// Endpoint pro kontrolu dostupnosti tiskárny
app.get('/check-printer', async (req, res) => {
    try {
        const { exec } = await import('child_process');

        // Zkontrolujeme dostupnost tiskárny pomocí wmic
        const command = `wmic printer where "name='${RECEIPT_PRINTER}'" get name,workoffline,status`;

        exec(command, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Chyba při kontrole tiskárny:', error);
                res.status(500).json({
                    status: 'error',
                    message: 'Nepodařilo se zkontrolovat tiskárnu',
                    error: error.message
                });
                return;
            }

            const isAvailable = stdout.toLowerCase().includes(RECEIPT_PRINTER.toLowerCase()) &&
                !stdout.toLowerCase().includes('workoffline');

            res.json({
                status: 'ok',
                printer: RECEIPT_PRINTER,
                available: isAvailable,
                details: stdout.trim(),
                message: isAvailable ? 'Tiskárna je dostupná' : 'Tiskárna není dostupná nebo je offline'
            });
        });
    } catch (e) {
        console.error('❌ Chyba při kontrole tiskárny:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Endpoint pro otevření pokladní zásuvky
app.post('/open-drawer', async (req, res) => {
    try {
        console.log('💰 Pokus o otevření pokladní zásuvky...')
        console.log('🖨️ Používaná tiskárna:', RECEIPT_PRINTER)

        const { exec } = await import('child_process');
        const fs = await import('fs');

        // Použijeme jednoduchý přístup s echo a přesměrováním na tiskárnu
        // ESC/POS příkaz pro otevření zásuvky: ESC p 0 7 121 (0x1B 0x70 0x30 0x37 0x79)
        const drawerCommand = '\x1B\x70\x30\x37\x79';

        // Vytvoříme dočasný soubor s příkazem
        const timestamp = Date.now();
        const path = await import('path');
        const os = await import('os');

        // Použijeme temp složku systému místo relativní cesty
        const tempDir = path.join(os.tmpdir(), 'print-agent');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `drawer_${timestamp}.txt`);
        fs.writeFileSync(tempFile, drawerCommand);

        // Pošleme příkaz na tiskárnu
        const command = `type "${tempFile}" > "\\\\localhost\\${RECEIPT_PRINTER}"`;

        exec(command, { windowsHide: true }, (error, stdout, stderr) => {
            console.log('📋 Výstup příkazu:', stdout);
            if (stderr) console.log('⚠️ Chybové hlášky:', stderr);

            // Smažeme dočasný soubor
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupError) {
                console.warn('⚠️ Nepodařilo se smazat dočasný soubor:', cleanupError.message);
            }

            if (error) {
                console.error('❌ Chyba při otevírání zásuvky:', error);
                res.status(500).json({
                    status: 'error',
                    message: `Chyba při otevírání zásuvky: ${error.message}`,
                    details: {
                        printer: RECEIPT_PRINTER,
                        error: error.message,
                        stdout: stdout,
                        stderr: stderr
                    }
                });
                return;
            }

            // Pokud není chyba, považujeme to za úspěch
            if (!error) {
                console.log('✅ Pokladní zásuvka úspěšně otevřena');
                res.json({
                    status: 'ok',
                    message: 'Pokladní zásuvka otevřena',
                    details: {
                        printer: RECEIPT_PRINTER,
                        output: stdout
                    }
                });
            } else {
                console.error('❌ Chyba při otevírání zásuvky:', stdout);
                res.status(500).json({
                    status: 'error',
                    message: 'Nepodařilo se otevřít zásuvku',
                    details: {
                        printer: RECEIPT_PRINTER,
                        output: stdout,
                        stderr: stderr
                    }
                });
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
