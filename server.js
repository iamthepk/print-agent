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
                <h2>🧪 Test - Vytisknout oba templaty</h2>
                <code>POST /test-print-both-templates</code>
                <p>Vytiskne oba templaty (starý a nový) za sebou pro porovnání.</p>
                <p>Nejprve se vytiskne <strong>starý template</strong>, pak počká 3 sekundy a vytiskne se <strong>nový template</strong>.</p>
                <button onclick="testBothTemplates()" style="background: #9b59b6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px 0;">
                    🧪 Vytisknout oba templaty pro porovnání
                </button>
                <div id="test-templates-result" style="margin-top: 10px; padding: 10px; border-radius: 5px; display: none;"></div>
                <script>
                    async function testBothTemplates() {
                        const button = event.target;
                        const resultDiv = document.getElementById('test-templates-result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Tisknu...';
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = '⏳ Tisknu oba templaty (starý pak nový)...';
                        
                        try {
                            const response = await fetch('/test-print-both-templates', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({})
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.style.background = '#d4edda';
                                resultDiv.style.color = '#155724';
                                resultDiv.style.border = '1px solid #c3e6cb';
                                resultDiv.innerHTML = '✅ ' + data.message;
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
                            resultDiv.innerHTML = '❌ Chyba: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🧪 Vytisknout oba templaty pro porovnání';
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

// Testovací endpoint pro vytisknutí obou templatů pro porovnání
app.post('/test-print-both-templates', async (req, res) => {
    try {
        // Testovací data účtenky
        const testReceipt = {
            orderNumber: "999",
            receiptNumber: "TEST-001",
            createdAt: new Date().toLocaleString('cs-CZ'),
            customerName: "Test Customer",
            items: [
                { qty: 2, name: "Cappuccino", price: 75 },
                { qty: 1, name: "Brownie", price: 45 }
            ],
            subtotal: 195.0,
            vat: [{ rate: 21, amount: 33.77 }],
            totalCZK: 175.50,
            paymentMethod: "Hotovost",
            givenAmount: 200.0,
            change: 24.50,
            // Přidáme company_info pole pro nový template
            headerText: "LOOTEA s.r.o.",
            companyPhone: "+420 123 456 789",
            footerText: "Wenceslas Square 1\nPraha 1 11000\nIČO: 12345678\nDIČ: CZ12345678\ninfo@lootea.cz\nhttps://www.lootea.cz",
            logoUrl: req.body.logoUrl, // Volitelně z requestu
            qrCodeUrl: req.body.qrCodeUrl // Volitelně z requestu
        };

        console.log('🖨️ Tisknu STARÝ template...');
        
        // 1. Starý template (bez useNewTemplate)
        const receiptOld = { ...testReceipt };
        delete receiptOld.useNewTemplate; // Ujistíme se, že není nastaveno
        try {
            await printReceipt(receiptOld);
            console.log('✅ Starý template vytištěn úspěšně');
        } catch (error) {
            console.error('❌ Chyba při tisku starého templatu:', error);
            throw error;
        }
        
        // Počkáme 3 sekundy mezi oběma účtenkami
        console.log('⏳ Čekám 3 sekundy před tiskem nového templatu...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🖨️ Tisknu NOVÝ template...');
        
        // 2. Nový template (s useNewTemplate: true)
        const receiptNew = { ...testReceipt, useNewTemplate: true };
        try {
            await printReceipt(receiptNew);
            console.log('✅ Nový template vytištěn úspěšně');
        } catch (error) {
            console.error('❌ Chyba při tisku nového templatu:', error);
            throw error;
        }

        res.json({ 
            status: 'ok', 
            message: 'Oba templaty byly vytisknuty. Starý template vytištěn první, nový template za 3 sekundy.',
            printed: {
                oldTemplate: 'vytištěno',
                newTemplate: 'vytištěno'
            }
        });
    } catch (e) {
        console.error('❌ Chyba při testovacím tisku:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
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

            // Vylepšená logika pro kontrolu dostupnosti
            const output = stdout.toLowerCase();
            const printerFound = output.includes(RECEIPT_PRINTER.toLowerCase());
            const isOffline = output.includes('workoffline') && output.includes('true');
            const hasUnknownStatus = output.includes('unknown');

            // Tiskárna je dostupná pokud:
            // 1. Je nalezena v seznamu
            // 2. Není explicitně offline
            // 3. Status "Unknown" není problém (tiskárna může fungovat i s Unknown statusem)
            const isAvailable = printerFound && !isOffline;

            res.json({
                status: 'ok',
                printer: RECEIPT_PRINTER,
                available: isAvailable,
                details: stdout.trim(),
                message: isAvailable ? 'Tiskárna je dostupná' :
                    isOffline ? 'Tiskárna je offline' :
                        hasUnknownStatus ? 'Tiskárna je dostupná (status: Unknown)' :
                            'Tiskárna není nalezena'
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

// Funkce pro kontrolu, zda je port už obsazený
async function checkPort(port) {
    const net = await import('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

// Spuštění serveru s kontrolou portu
async function startServer() {
    const isPortAvailable = await checkPort(PORT);

    if (!isPortAvailable) {
        console.log(`⚠️ Port ${PORT} je už obsazený. Zkouším port ${PORT + 1}...`);
        const altPort = PORT + 1;
        const isAltPortAvailable = await checkPort(altPort);

        if (isAltPortAvailable) {
            app.listen(altPort, () => {
                console.log(`🚀 Print agent běží na http://localhost:${altPort}`)
            });
        } else {
            console.error(`❌ Ani port ${PORT} ani ${altPort} není dostupný. Ukončuji aplikaci.`);
            process.exit(1);
        }
    } else {
        app.listen(PORT, () => {
            console.log(`🚀 Print agent běží na http://localhost:${PORT}`)
        });
    }
}

startServer();
