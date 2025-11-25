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

console.log('RECEIPT_PRINTER:', RECEIPT_PRINTER)
console.log('STICKER_PRINTER:', STICKER_PRINTER)

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
            </style>
        </head>
        <body>
            <div class="container">
                <img src="${logoPath}" alt="LOOTEA Logo" class="logo" onerror="this.style.display='none';">
                <div class="title">PRINT AGENT</div>
                
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
        console.error('Chyba pri tisku uctenky:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})

app.post('/print-sticker', async (req, res) => {
    console.log('📦 Přijatá data pro štítek:', req.body)
    try {
        await printSticker(req.body)
        res.json({ status: 'ok', message: 'Štítek odeslán k tisku' })
    } catch (e) {
        console.error('Chyba pri tisku stitku:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})

app.get('/healthcheck', (req, res) => {
    res.json({ status: 'ok' })
})

// Endpoint pro získání URL print agentu (pro POS aplikace)
// Tento endpoint vrací doporučenou URL podle typu klienta
app.get('/print-agent-url', async (req, res) => {
    try {
        const localIP = await getLocalIPAddress();
        const hostname = await getHostname();
        const port = PORT;
        const clientType = req.query.type || 'web'; // 'web', 'ios', 'android', 'desktop'

        let recommendedUrl;
        // Pro webové aplikace NEPOUŽÍVÁME .local, protože to často nefunguje
        switch (clientType) {
            case 'ios':
                recommendedUrl = `http://${hostname}.local:${port}`;
                break;
            case 'web':
            case 'android':
            default:
                // Pro webové aplikace použijeme hostname BEZ .local (funguje lépe)
                // Pokud hostname nefunguje, použijeme IP adresu
                recommendedUrl = `http://${hostname}:${port}`;
                break;
        }

        res.json({
            status: 'ok',
            url: recommendedUrl,
            alternatives: {
                hostname: `http://${hostname}:${port}`,
                hostnameLocal: `http://${hostname}.local:${port}`,
                ipAddress: `http://${localIP}:${port}`,
                localhost: `http://localhost:${port}`
            },
            clientType: clientType,
            message: `Doporučená URL pro ${clientType}: ${recommendedUrl}`,
            note: clientType === 'web'
                ? '⚠️ Pro webové aplikace použijte hostname BEZ .local (funguje spolehlivěji)'
                : undefined
        });
    } catch (e) {
        console.error('Chyba pri zjistovani URL:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Nový endpoint pro automatickou detekci - vrátí všechny varianty v správném pořadí priority
// Tento endpoint je určen pro POS aplikace, které chtějí automaticky najít print agenta
// DŮLEŽITÉ: Pro webové aplikace je .local na konci, protože často nefunguje!
app.get('/auto-detect', async (req, res) => {
    try {
        const localIP = await getLocalIPAddress();
        const hostname = await getHostname();
        const port = PORT;
        const clientType = req.query.type || 'web'; // 'web', 'ios', 'android'

        let urlVariants;

        if (clientType === 'ios') {
            // Pro iOS: .local funguje, takže je na začátku
            urlVariants = [
                `http://${hostname}.local:${port}`,     // 1. Hostname s .local (funguje na iOS)
                `http://${hostname}:${port}`,            // 2. Hostname bez .local
                `http://${localIP}:${port}`,             // 3. IP adresa
                `http://localhost:${port}`               // 4. Localhost
            ];
        } else {
            // Pro webové aplikace: .local často NEFUNGUJE, takže je na konci!
            urlVariants = [
                `http://${hostname}:${port}`,            // 1. Hostname bez .local (nejlepší pro web)
                `http://${localIP}:${port}`,             // 2. IP adresa (vždy funguje)
                `http://${hostname}.local:${port}`,      // 3. Hostname s .local (zkusit jako poslední - často nefunguje v webových aplikacích!)
                `http://localhost:${port}`               // 4. Localhost (jen lokálně)
            ];
        }

        res.json({
            status: 'ok',
            variants: urlVariants,
            recommended: urlVariants[0],
            clientType: clientType,
            message: clientType === 'ios'
                ? 'Pro iOS zkuste varianty v pořadí priority. .local funguje na iOS zařízeních.'
                : 'Pro webové aplikace zkuste varianty v pořadí priority. .local často NEFUNGUJE v webových aplikacích - použijte hostname bez .local nebo IP adresu.',
            usage: {
                web: `Použijte: ${urlVariants[0]} nebo ${urlVariants[1]} (NEPOUŽÍVEJTE .local jako první!)`,
                ios: `Použijte: ${urlVariants[0]} nebo ${urlVariants[1]}`,
                note: '⚠️ Webové aplikace často NEMOHOU resolvovat .local domény kvůli bezpečnostním omezením prohlížeče. Použijte hostname BEZ .local nebo IP adresu.'
            },
            testingOrder: 'Zkuste varianty v tomto pořadí a použijte první, která funguje.'
        });
    } catch (e) {
        console.error('Chyba pri automaticke detekci:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Endpoint pro získání správného pořadí testování URL variant podle hostname a portu
// Užitečné, když POS aplikace zná hostname, ale neví, v jakém pořadí zkoušet varianty
app.get('/detect-variants', async (req, res) => {
    try {
        const hostname = req.query.hostname || await getHostname();
        const port = req.query.port || PORT;
        const clientType = req.query.type || 'web'; // 'web', 'ios', 'android'

        // Získáme IP adresu (pokud je to náš hostname)
        let localIP = null;
        try {
            const currentHostname = await getHostname();
            if (hostname === currentHostname) {
                localIP = await getLocalIPAddress();
            }
        } catch (e) {
            // Ignorujeme chybu
        }

        let urlVariants;

        if (clientType === 'ios') {
            // Pro iOS: .local funguje
            urlVariants = [
                `http://${hostname}.local:${port}`,
                `http://${hostname}:${port}`,
            ];
            if (localIP) {
                urlVariants.push(`http://${localIP}:${port}`);
            }
        } else {
            // Pro webové aplikace: .local často NEFUNGUJE - je na konci!
            urlVariants = [
                `http://${hostname}:${port}`,            // 1. BEZ .local (nejlepší pro web)
            ];
            if (localIP) {
                urlVariants.push(`http://${localIP}:${port}`); // 2. IP adresa
            }
            urlVariants.push(`http://${hostname}.local:${port}`); // 3. S .local (zkusit jako poslední!)
        }

        res.json({
            status: 'ok',
            hostname: hostname,
            port: port,
            clientType: clientType,
            variants: urlVariants,
            recommended: urlVariants[0],
            message: clientType === 'web'
                ? `Pro webové aplikace zkuste nejdřív: ${urlVariants[0]} (BEZ .local). .local často nefunguje v webových aplikacích!`
                : `Pro iOS zkuste nejdřív: ${urlVariants[0]}`,
            testingInstructions: 'Zkuste každou variantu v pořadí a použijte první, která odpoví na /healthcheck endpoint.'
        });
    } catch (e) {
        console.error('Chyba pri ziskavani variant:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
})

// Endpoint pro zjištění IP adresy serveru
app.get('/network-info', async (req, res) => {
    try {
        const localIP = await getLocalIPAddress();
        const hostname = await getHostname();
        const port = PORT;
        res.json({
            status: 'ok',
            localhost: `http://localhost:${port}`,
            network: `http://${localIP}:${port}`,
            hostnameUrl: `http://${hostname}:${port}`,
            hostnameLocal: `http://${hostname}.local:${port}`,
            ipAddress: localIP,
            hostname: hostname,
            port: port,
            message: `Pro přístup z iPadu použijte: http://${hostname}.local:${port} (iOS) nebo http://${hostname}:${port} nebo http://${localIP}:${port}`,
            important: `⚠️ DŮLEŽITÉ: Použijte http:// (ne https://) a port ${port} (ne ${port.toString().slice(0, -1)})`
        });
    } catch (e) {
        console.error('Chyba pri zjistovani sitovych informaci:', e.message);
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
        console.error('Chyba pri kontrole tiskarny:', e.message);
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
                    console.error('Chyba pri spousteni restart scriptu:', error);
                }
                // Ukončíme aktuální proces - restart script ho restartuje
                setTimeout(() => {
                    process.exit(0);
                }, 500);
            });
        }, 500);
    } catch (e) {
        console.error('Chyba pri restartu serveru:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// Endpoint pro získání ngrok URL
app.get('/ngrok-url', async (req, res) => {
    try {
        // Nejdřív zkusíme získat z ngrok API
        let ngrokUrl = await getNgrokUrl();

        // Pokud se to nepodaří, zkusíme načíst ze souboru
        if (!ngrokUrl) {
            ngrokUrl = await loadNgrokUrlFromFile();
        }

        if (ngrokUrl) {
            res.json({
                status: 'ok',
                url: ngrokUrl,
                source: 'api' // nebo 'file'
            });
        } else {
            res.json({
                status: 'ok',
                url: null,
                message: 'Ngrok URL není dostupná. Ujistěte se, že ngrok běží.',
                hint: 'Spusťte ngrok pomocí: ngrok http 8000'
            });
        }
    } catch (error) {
        console.error('Chyba pri ziskavani ngrok URL:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Endpoint pro otevření pokladní zásuvky
app.post('/open-drawer', async (req, res) => {
    try {
        console.log('Pokus o otevreni pokladni zasuvky...')
        console.log('Pouzivana tiskarna:', RECEIPT_PRINTER)

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
            if (stderr) console.log('Chybove hlasky:', stderr);

            // Smažeme dočasný soubor
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupError) {
                console.warn('Nepodarilo se smazat docasny soubor:', cleanupError.message);
            }

            if (error) {
                console.error('Chyba pri otevirani zasuvky:', error);
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
                console.log('Pokladni zasuvka uspesne otevrena');
                res.json({
                    status: 'ok',
                    message: 'Pokladní zásuvka otevřena',
                    details: {
                        printer: RECEIPT_PRINTER,
                        output: stdout
                    }
                });
            } else {
                console.error('Chyba pri otevirani zasuvky:', stdout);
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
        console.error('Chyba pri otevirani zasuvky:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
});

const PORT = process.env.PORT || 8000
const HOST = process.env.HOST || '0.0.0.0' // Poslouchá na všech síťových rozhraních

// Funkce pro zjištění hostname počítače
async function getHostname() {
    const os = await import('os');
    return os.hostname();
}

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

// Funkce pro získání ngrok URL z ngrok API
async function getNgrokUrl() {
    try {
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await response.json();
        const httpsTunnel = data.tunnels?.find(t => t.proto === 'https');
        return httpsTunnel?.public_url || null;
    } catch (error) {
        // Ngrok API není dostupné nebo ngrok neběží
        return null;
    }
}

// Funkce pro načtení ngrok URL ze souboru
async function loadNgrokUrlFromFile() {
    try {
        const fs = await import('fs');
        const path = await import('path');
        const urlFile = path.join(__dirname, 'ngrok-url.txt');

        if (fs.existsSync(urlFile)) {
            const url = fs.readFileSync(urlFile, 'utf8').trim();
            if (url && url.startsWith('https://')) {
                return url;
            }
        }
    } catch (error) {
        // Ignorujeme chyby při čtení souboru
    }
    return null;
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
    const hostname = await getHostname();

    // Funkce pro zobrazení ngrok URL
    const displayNgrokUrl = async () => {
        // Počkáme chvíli, aby ngrok stihl spustit
        setTimeout(async () => {
            let ngrokUrl = await getNgrokUrl();

            // Pokud se to nepodaří, zkusíme načíst ze souboru
            if (!ngrokUrl) {
                ngrokUrl = await loadNgrokUrlFromFile();
            }

            if (ngrokUrl) {
                console.log(`   Ngrok HTTPS: ${ngrokUrl}`)
                console.log(`   POS aplikace muze pouzit tuto URL pro komunikaci`)
            } else {
                console.log(`   Ngrok URL neni dostupna (ngrok mozna nebezi)`)
            }
        }, 3000); // Počkáme 3 sekundy
    };

    if (!isPortAvailable) {
        console.log(`Port ${PORT} je uz obsazeny. Zkousim port ${PORT + 1}...`);
        const altPort = PORT + 1;
        const isAltPortAvailable = await checkPort(altPort);

        if (isAltPortAvailable) {
            app.listen(altPort, HOST, () => {
                console.log(`Print agent bezi na:`)
                console.log(`   Lokalne: http://localhost:${altPort}`)
                console.log(`   Hostname: http://${hostname}:${altPort}`)
                displayNgrokUrl();
            });
        } else {
            console.error(`Ani port ${PORT} ani ${altPort} neni dostupny. Ukoncuji aplikaci.`);
            process.exit(1);
        }
    } else {
        app.listen(PORT, HOST, () => {
            console.log(`Print agent bezi na:`)
            console.log(`   Lokalne: http://localhost:${PORT}`)
            console.log(`   Hostname: http://${hostname}:${PORT}`)
            displayNgrokUrl();
        });
    }
}

startServer();
