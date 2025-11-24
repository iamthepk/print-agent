import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'
import fs from 'fs'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())
app.use('/assets', express.static(path.join(__dirname, 'assets')))

// Automatická detekce výchozí tiskárny pokud není nastavena
const RECEIPT_PRINTER = process.env.RECEIPT_PRINTER || 'EPSON TM-T20III Receipt'
const STICKER_PRINTER = process.env.STICKER_PRINTER || 'Brother QL-700'

console.log('📄 RECEIPT_PRINTER:', RECEIPT_PRINTER)
console.log('🏷️ STICKER_PRINTER:', STICKER_PRINTER)

// Přidání základní HTML stránky
app.get('/', (req, res) => {
    const logoPath = '/assets/logo.png'
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Agent</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    padding: 40px;
                    max-width: 600px;
                    width: 100%;
                    text-align: center;
                }
                .logo {
                    max-width: 400px;
                    width: 100%;
                    height: auto;
                    margin: 0 auto 20px;
                    display: block;
                }
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 40px;
                    letter-spacing: 2px;
                }
                .buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin-bottom: 30px;
                }
                button {
                    background: #2c3e50;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s;
                }
                button:hover:not(:disabled) {
                    background: #34495e;
                }
                button:disabled {
                    background: #95a5a6;
                    cursor: not-allowed;
                }
                .result {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 5px;
                    display: none;
                }
                .result.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                .result.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                .result.warning {
                    background: #fff3cd;
                    color: #856404;
                    border: 1px solid #ffeaa7;
                }
                .printers-info {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 5px;
                    text-align: left;
                }
                .printers-info h3 {
                    margin-bottom: 10px;
                    color: #2c3e50;
                }
                .printers-info p {
                    margin: 5px 0;
                    color: #666;
                }
                .network-info {
                    margin-top: 20px;
                    padding: 15px;
                    background: #e7f3ff;
                    border-radius: 5px;
                    border-left: 4px solid #2196F3;
                    text-align: left;
                }
                .network-info h4 {
                    margin-bottom: 10px;
                    color: #1976D2;
                    font-size: 14px;
                }
                .network-info code {
                    background: #fff;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    color: #d32f2f;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="${logoPath}" alt="LOOTEA Logo" class="logo" onerror="this.style.display='none';">
                <div class="title">PRINT AGENT</div>
                
                <div class="network-info" id="network-info">
                    <h4>🌐 Síťové informace:</h4>
                    <p style="margin: 5px 0; font-size: 13px;">Načítám...</p>
                </div>
                
                <div class="buttons">
                    <button onclick="testDrawer(event)">🧪 Testovat pokladní zásuvku</button>
                    <button onclick="checkPrinter(event)">🔍 Zkontrolovat tiskárnu</button>
                    <button onclick="showPrinters(event)">📋 Zobrazit nastavené tiskárny</button>
                    <button onclick="restartServer(event)">🔄 Restartovat server</button>
                </div>
                
                <div id="result" class="result"></div>
                
                <div class="printers-info" id="printers-info" style="display: none;">
                    <h3>Nastavené tiskárny:</h3>
                    <p><strong>Účtenky:</strong> ${RECEIPT_PRINTER}</p>
                    <p><strong>Štítky:</strong> ${STICKER_PRINTER}</p>
                </div>
                
                <script>
                    // Načtení síťových informací při načtení stránky
                    async function loadNetworkInfo() {
                        try {
                            const response = await fetch('/network-info');
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                const networkInfoDiv = document.getElementById('network-info');
                                networkInfoDiv.innerHTML = \`
                                    <h4>🌐 Síťové informace:</h4>
                                    <p style="margin: 5px 0; font-size: 13px;">
                                        <strong>📍 Lokálně:</strong> <code>\${data.localhost}</code><br>
                                        <strong>🌐 V síti:</strong> <code>\${data.network}</code><br>
                                        <strong>💡 Pro iPad:</strong> <code>\${data.network}</code>
                                    </p>
                                \`;
                            }
                        } catch (error) {
                            console.error('Chyba při načítání síťových informací:', error);
                        }
                    }
                    
                    // Načteme síťové informace při načtení stránky
                    loadNetworkInfo();
                    
                    async function testDrawer(event) {
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Testuji...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result';
                        resultDiv.innerHTML = '⏳ Otevírám pokladní zásuvku...';
                        
                        try {
                            const response = await fetch('/open-drawer', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.className = 'result success';
                                resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Použitá tiskárna: ' + (data.details?.printer || 'N/A') + '</small>';
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message + '<br><small>Chyba: ' + (data.details?.error || 'Neznámá chyba') + '</small>';
                            }
                        } catch (error) {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🧪 Testovat pokladní zásuvku';
                    }
                    
                    async function checkPrinter(event) {
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Kontroluji...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result';
                        resultDiv.innerHTML = '⏳ Kontroluji dostupnost tiskáren...';
                        
                        try {
                            const response = await fetch('/check-printer');
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                let html = '';
                                if (data.allAvailable) {
                                    resultDiv.className = 'result success';
                                    html = '✅ ' + data.message + '<br><br>';
                                } else {
                                    resultDiv.className = data.anyAvailable ? 'result warning' : 'result error';
                                    html = (data.anyAvailable ? '⚠️ ' : '❌ ') + data.message + '<br><br>';
                                }
                                
                                html += '<small>';
                                html += '<strong>Tiskárna účtenek:</strong> ' + data.receiptPrinter.name + '<br>';
                                html += '&nbsp;&nbsp;→ ' + data.receiptPrinter.message + '<br><br>';
                                html += '<strong>Tiskárna štítků:</strong> ' + data.stickerPrinter.name + '<br>';
                                html += '&nbsp;&nbsp;→ ' + data.stickerPrinter.message;
                                html += '</small>';
                                
                                resultDiv.innerHTML = html;
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message;
                            }
                        } catch (error) {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🔍 Zkontrolovat tiskárnu';
                    }
                    
                    function showPrinters(event) {
                        event.preventDefault();
                        const printersInfo = document.getElementById('printers-info');
                        printersInfo.style.display = printersInfo.style.display === 'none' ? 'block' : 'none';
                    }
                    
                    async function restartServer(event) {
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        
                        if (!confirm('Opravdu chcete restartovat server?\\n\\nServer se ukončí a automaticky restartuje během několika sekund.')) {
                            return;
                        }
                        
                        button.disabled = true;
                        button.textContent = '⏳ Restartuji...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result warning';
                        resultDiv.innerHTML = '⏳ Restartuji server...<br><small>Prosím počkejte 5-10 sekund. Stránka se automaticky obnoví.</small>';
                        
                        try {
                            const response = await fetch('/restart-server', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.className = 'result success';
                                resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Server se restartuje... Počkejte a stránka se automaticky obnoví.</small>';
                                
                                // Zkusíme se znovu připojit po 5 sekundách
                                let attempts = 0;
                                const maxAttempts = 10;
                                const checkInterval = setInterval(() => {
                                    attempts++;
                                    fetch('/healthcheck')
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.status === 'ok') {
                                                clearInterval(checkInterval);
                                                window.location.reload();
                                            }
                                        })
                                        .catch(() => {
                                            if (attempts >= maxAttempts) {
                                                clearInterval(checkInterval);
                                                resultDiv.className = 'result warning';
                                                resultDiv.innerHTML = '⚠️ Server se restartuje, ale připojení trvá déle. Zkuste obnovit stránku za chvíli manuálně.';
                                            }
                                        });
                                }, 1000);
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message;
                                button.disabled = false;
                                button.textContent = '🔄 Restartovat server';
                            }
                        } catch (error) {
                            // Pokud dostaneme chybu, je to pravděpodobně proto, že server se restartuje
                            resultDiv.className = 'result warning';
                            resultDiv.innerHTML = '⏳ Server se restartuje...<br><small>Prosím počkejte 5-10 sekund a obnovte stránku.</small>';
                            
                            // Zkusíme se znovu připojit po 5 sekundách
                            setTimeout(() => {
                                let attempts = 0;
                                const maxAttempts = 10;
                                const checkInterval = setInterval(() => {
                                    attempts++;
                                    fetch('/healthcheck')
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.status === 'ok') {
                                                clearInterval(checkInterval);
                                                window.location.reload();
                                            }
                                        })
                                        .catch(() => {
                                            if (attempts >= maxAttempts) {
                                                clearInterval(checkInterval);
                                                resultDiv.className = 'result warning';
                                                resultDiv.innerHTML = '⚠️ Server se restartuje, ale připojení trvá déle. Zkuste obnovit stránku za chvíli manuálně.';
                                            }
                                        });
                                }, 1000);
                            }, 5000);
                        }
                    }
                </script>
            </div>
        </body>
        </html>
    `
    res.send(html)
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

// Endpoint pro zjištění IP adresy serveru
app.get('/network-info', async (req, res) => {
    try {
        const localIP = await getLocalIPAddress();
        const port = PORT;
        res.json({
            status: 'ok',
            localhost: `http://localhost:${port}`,
            network: `http://${localIP}:${port}`,
            ipAddress: localIP,
            port: port,
            message: `Pro přístup z iPadu použijte: http://${localIP}:${port}`
        });
    } catch (e) {
        console.error('❌ Chyba při zjišťování síťových informací:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Endpoint pro kontrolu dostupnosti tiskáren
app.get('/check-printer', async (req, res) => {
    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Zkontrolujeme dostupnost obou tiskáren
        const checkPrinter = async (printerName) => {
            const command = `wmic printer where "name='${printerName}'" get name,workoffline,status`;
            try {
                const { stdout } = await execAsync(command, { windowsHide: true });
                const output = stdout.toLowerCase();
                const printerFound = output.includes(printerName.toLowerCase());
                const isOffline = output.includes('workoffline') && output.includes('true');
                const hasUnknownStatus = output.includes('unknown');
                const isAvailable = printerFound && !isOffline;

                return {
                    name: printerName,
                    found: printerFound,
                    available: isAvailable,
                    offline: isOffline,
                    unknownStatus: hasUnknownStatus,
                    message: isAvailable ? 'Tiskárna je dostupná' :
                        isOffline ? 'Tiskárna je offline' :
                            hasUnknownStatus ? 'Tiskárna je dostupná (status: Unknown)' :
                                'Tiskárna není nalezena'
                };
            } catch (error) {
                return {
                    name: printerName,
                    found: false,
                    available: false,
                    offline: false,
                    unknownStatus: false,
                    message: 'Chyba při kontrole tiskárny: ' + error.message
                };
            }
        };

        // Zkontrolujeme obě tiskárny paralelně
        const [receiptPrinter, stickerPrinter] = await Promise.all([
            checkPrinter(RECEIPT_PRINTER),
            checkPrinter(STICKER_PRINTER)
        ]);

        const allAvailable = receiptPrinter.available && stickerPrinter.available;
        const anyAvailable = receiptPrinter.available || stickerPrinter.available;

        let message = '';
        if (allAvailable) {
            message = 'Všechny tiskárny jsou dostupné';
        } else if (receiptPrinter.available && !stickerPrinter.available) {
            message = `Tiskárna účtenek je dostupná, tiskárna štítků: ${stickerPrinter.message}`;
        } else if (!receiptPrinter.available && stickerPrinter.available) {
            message = `Tiskárna účtenek: ${receiptPrinter.message}, tiskárna štítků je dostupná`;
        } else {
            message = `Tiskárna účtenek: ${receiptPrinter.message}, tiskárna štítků: ${stickerPrinter.message}`;
        }

        res.json({
            status: 'ok',
            allAvailable: allAvailable,
            anyAvailable: anyAvailable,
            receiptPrinter: receiptPrinter,
            stickerPrinter: stickerPrinter,
            message: message
        });
    } catch (e) {
        console.error('❌ Chyba při kontrole tiskárny:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Endpoint pro restart serveru
app.post('/restart-server', async (req, res) => {
    try {
        const { exec } = await import('child_process');
        const path = await import('path');

        res.json({
            status: 'ok',
            message: 'Server bude restartován...'
        });

        // Pošleme odpověď a pak spustíme restart script (SILENT)
        setTimeout(() => {
            console.log('🔄 Restartování serveru pomocí restart scriptu...');
            const restartScript = path.join(__dirname, 'scripts', 'restart-server.bat');
            const scriptPath = path.join(__dirname, '..');

            // Spustíme script SILENT (bez zobrazení okna)
            // /B = běh na pozadí, cmd /c = spustit a zavřít, > nul 2>&1 = potlačit výstup
            exec(`cmd /c "${restartScript}"`, {
                windowsHide: true,
                cwd: scriptPath
            }, (error) => {
                if (error) {
                    console.error('❌ Chyba při spouštění restart scriptu:', error);
                }
                // Ukončíme aktuální proces - restart script ho restartuje
                setTimeout(() => {
                    process.exit(0);
                }, 500);
            });
        }, 500);
    } catch (e) {
        console.error('❌ Chyba při restartu serveru:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

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
const HOST = process.env.HOST || '0.0.0.0' // Poslouchá na všech síťových rozhraních

// Funkce pro zjištění IP adresy PC v síti
async function getLocalIPAddress() {
    const os = await import('os');
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // Ignorujeme loopback a IPv6
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }

    return addresses.length > 0 ? addresses[0] : 'localhost';
}

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
    const localIP = await getLocalIPAddress();

    if (!isPortAvailable) {
        console.log(`⚠️ Port ${PORT} je už obsazený. Zkouším port ${PORT + 1}...`);
        const altPort = PORT + 1;
        const isAltPortAvailable = await checkPort(altPort);

        if (isAltPortAvailable) {
            app.listen(altPort, HOST, () => {
                console.log(`🚀 Print agent běží na:`)
                console.log(`   📍 Lokálně: http://localhost:${altPort}`)
                console.log(`   🌐 V síti:  http://${localIP}:${altPort}`)
                console.log(`   💡 Pro iPad použijte: http://${localIP}:${altPort}`)
            });
        } else {
            console.error(`❌ Ani port ${PORT} ani ${altPort} není dostupný. Ukončuji aplikaci.`);
            process.exit(1);
        }
    } else {
        app.listen(PORT, HOST, () => {
            console.log(`🚀 Print agent běží na:`)
            console.log(`   📍 Lokálně: http://localhost:${PORT}`)
            console.log(`   🌐 V síti:  http://${localIP}:${PORT}`)
            console.log(`   💡 Pro iPad použijte: http://${localIP}:${PORT}`)
        });
    }
}

startServer();
