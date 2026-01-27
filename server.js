import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'
import { checkPrinterAvailability, canOpenPrinter, isWinSpoolerHelperAvailable, openDrawer } from './print/rawPrinter.js'
import { printConfig } from './config/printConfig.js'
import fs from 'fs'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())
app.use('/assets', express.static(path.join(__dirname, 'assets')))

// Use centralized printer config
const RECEIPT_PRINTER = printConfig.RECEIPT_PRINTER
const STICKER_PRINTER = printConfig.STICKER_PRINTER

// Runtime method override (for testing - stored in memory)
let runtimeMethodOverride = null;

console.log('============================================')
console.log('PRINT AGENT CONFIGURATION')
console.log('============================================')
console.log('RECEIPT_PRINTER:', RECEIPT_PRINTER)
console.log('STICKER_PRINTER:', STICKER_PRINTER)
console.log('RECEIPT_METHOD:', printConfig.RECEIPT_METHOD)
console.log('RECEIPT_FALLBACK_METHOD:', printConfig.RECEIPT_FALLBACK_METHOD)
console.log('RECEIPT_STRICT_MODE:', printConfig.RECEIPT_STRICT_MODE)
console.log('RECEIPT_ENCODING_MODE:', printConfig.RECEIPT_ENCODING_MODE)
console.log('RECEIPT_CODEPAGE:', printConfig.RECEIPT_CODEPAGE)
console.log('RECEIPT_CHARS_PER_LINE:', printConfig.RECEIPT_CHARS_PER_LINE)
console.log('RAW_SEND_METHOD:', printConfig.RAW_SEND_METHOD)
console.log('RAW_SEND_FALLBACK:', printConfig.RAW_SEND_FALLBACK)
console.log('WINSPOOLER_HELPER_PATH:', printConfig.WINSPOOLER_HELPER_PATH)
console.log('============================================')

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
                .print-method-selector {
                    margin: 30px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 5px;
                    text-align: left;
                }
                .print-method-selector h3 {
                    margin-bottom: 15px;
                    color: #2c3e50;
                    font-size: 16px;
                }
                .method-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .method-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: white;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .method-option:hover {
                    background: #e9ecef;
                }
                .method-option input[type="radio"] {
                    cursor: pointer;
                }
                .method-option label {
                    cursor: pointer;
                    flex: 1;
                    margin: 0;
                }
                .method-description {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                .test-receipt-button {
                    margin-top: 15px;
                    width: 100%;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img src="${logoPath}" alt="LOOTEA Logo" class="logo" onerror="this.style.display='none';">
                <div class="title">PRINT AGENT</div>
                
                <div class="print-method-selector">
                    <h3>📄 Metoda tisku účtenek:</h3>
                    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                        Výchozí metoda (config): <strong>${printConfig.RECEIPT_METHOD === 'escpos' ? 'ESC/POS' : 'SumatraPDF'}</strong>
                        <span id="runtime-override-info" style="margin-left: 10px; color: #007bff; font-weight: bold;"></span>
                    </div>
                    <div class="method-options">
                        <div class="method-option" onclick="selectMethod('escpos')">
                            <input type="radio" id="method-escpos" name="printMethod" value="escpos" ${printConfig.RECEIPT_METHOD === 'escpos' ? 'checked' : ''}>
                            <label for="method-escpos">
                                <strong>ESC/POS (Raw)</strong>
                                <div class="method-description">Rychlý tisk, neomezená délka, podpora českých diakritik</div>
                            </label>
                        </div>
                        <div class="method-option" onclick="selectMethod('pdf')">
                            <input type="radio" id="method-pdf" name="printMethod" value="pdf" ${printConfig.RECEIPT_METHOD === 'pdf' ? 'checked' : ''}>
                            <label for="method-pdf">
                                <strong>SumatraPDF (PDF)</strong>
                                <div class="method-description">Legacy metoda, limit ~280mm délky</div>
                            </label>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button class="test-receipt-button" onclick="testReceiptPrint(event)" style="flex: 1;">🖨️ Testovat tisk účtenky</button>
                        <button onclick="setDefaultMethod(event)" style="flex: 1; background: #28a745;">⚙️ Nastavit jako výchozí</button>
                        <button onclick="clearDefaultMethod(event)" style="flex: 1; background: #6c757d;">🔄 Resetovat</button>
                    </div>
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
                    // Load current runtime override on page load
                    async function loadCurrentMethod() {
                        try {
                            const response = await fetch('/get-print-method');
                            const data = await response.json();
                            if (data.status === 'ok') {
                                const overrideInfo = document.getElementById('runtime-override-info');
                                if (data.runtimeOverride) {
                                    overrideInfo.textContent = '[Aktivní: ' + (data.runtimeOverride === 'escpos' ? 'ESC/POS' : 'SumatraPDF') + ']';
                                    overrideInfo.style.color = '#28a745';
                                } else {
                                    overrideInfo.textContent = '';
                                }
                            }
                        } catch (error) {
                            console.error('Error loading current method:', error);
                        }
                    }
                    
                    // Load on page load
                    loadCurrentMethod();
                    
                    function selectMethod(method) {
                        document.getElementById('method-' + method).checked = true;
                    }
                    
                    function getSelectedMethod() {
                        const selected = document.querySelector('input[name="printMethod"]:checked');
                        return selected ? selected.value : 'escpos';
                    }
                    
                    async function setDefaultMethod(event) {
                        event.preventDefault();
                        const selectedMethod = getSelectedMethod();
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Nastavuji...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result';
                        resultDiv.innerHTML = '⏳ Nastavuji výchozí metodu...';
                        
                        try {
                            const response = await fetch('/set-print-method', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ method: selectedMethod })
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.className = 'result success';
                                resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Všechny požadavky z POS systému budou používat tuto metodu</small>';
                                await loadCurrentMethod(); // Refresh override info
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message;
                            }
                        } catch (error) {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '⚙️ Nastavit jako výchozí';
                    }
                    
                    async function clearDefaultMethod(event) {
                        event.preventDefault();
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        
                        button.disabled = true;
                        button.textContent = '⏳ Resetuji...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result';
                        resultDiv.innerHTML = '⏳ Resetuji na výchozí metodu z konfigurace...';
                        
                        try {
                            const response = await fetch('/set-print-method', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ method: null })
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.className = 'result success';
                                resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Používá se výchozí metoda z konfigurace</small>';
                                await loadCurrentMethod(); // Refresh override info
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message;
                            }
                        } catch (error) {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🔄 Resetovat';
                    }
                    
                    async function testReceiptPrint(event) {
                        const button = event.target;
                        const resultDiv = document.getElementById('result');
                        const selectedMethod = getSelectedMethod();
                        
                        button.disabled = true;
                        button.textContent = '⏳ Tisknu...';
                        resultDiv.style.display = 'block';
                        resultDiv.className = 'result';
                        resultDiv.innerHTML = '⏳ Tisknu testovací účtenku metodou: <strong>' + (selectedMethod === 'escpos' ? 'ESC/POS' : 'SumatraPDF') + '</strong>...';
                        
                        // Test receipt data
                        const testReceipt = {
                            receipt_number: 'TEST-' + Date.now(),
                            order_number: '999',
                            sold_at: new Date().toISOString(),
                            items: [
                                {
                                    name: 'Testovací položka - Příliš žluťoučký kůň',
                                    quantity: 1,
                                    price: 123.45
                                },
                                {
                                    name: 'Další test - Úpěl ďábelské ódy',
                                    quantity: 2,
                                    price: 67.89
                                }
                            ],
                            total_czk: 259.23,
                            payment_method: [
                                { method: 'Hotovost', amount: 259.23 }
                            ],
                            note: 'Testovací účtenka - metoda: ' + (selectedMethod === 'escpos' ? 'ESC/POS' : 'SumatraPDF')
                        };
                        
                        try {
                            const response = await fetch('/print-receipt?method=' + selectedMethod, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(testReceipt)
                            });
                            
                            const data = await response.json();
                            
                            if (data.status === 'ok') {
                                resultDiv.className = 'result success';
                                let html = '✅ ' + data.message + '<br><br>';
                                html += '<small>';
                                html += '<strong>Metoda:</strong> ' + (data.method === 'escpos' ? 'ESC/POS' : 'PDF') + '<br>';
                                html += '<strong>Tiskárna:</strong> ' + (data.printer || 'N/A') + '<br>';
                                if (data.durationMs) {
                                    html += '<strong>Doba:</strong> ' + data.durationMs + ' ms<br>';
                                }
                                if (data.fallbackUsed) {
                                    html += '<strong>⚠️ Použita záložní metoda</strong><br>';
                                }
                                html += '</small>';
                                resultDiv.innerHTML = html;
                            } else {
                                resultDiv.className = 'result error';
                                resultDiv.innerHTML = '❌ ' + data.message + '<br><small>Chyba: ' + (data.error || 'Neznámá chyba') + '</small>';
                            }
                        } catch (error) {
                            resultDiv.className = 'result error';
                            resultDiv.innerHTML = '❌ Chyba při komunikaci se serverem: ' + error.message;
                        }
                        
                        button.disabled = false;
                        button.textContent = '🖨️ Testovat tisk účtenky';
                    }
                    
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
        console.log('📥 Received print-receipt request');
        console.log('📥 Query params:', req.query);
        console.log('📥 Body keys:', Object.keys(req.body || {}));

        // Support method override via query parameter or body
        const methodFromQuery = req.query.method;
        const methodFromBody = req.body?.method;
        const printMethod = methodFromQuery || methodFromBody;

        // Remove method from body if it was there (to avoid passing it to printReceipt as receipt data)
        const receiptData = { ...req.body };
        if (receiptData.method) {
            delete receiptData.method;
        }

        // Prepare options for printReceipt
        const options = {};
        if (printMethod && (printMethod === 'escpos' || printMethod === 'pdf')) {
            options.method = printMethod;
            console.log(`📋 Print method override (from request): ${printMethod}`);
        } else if (runtimeMethodOverride && (runtimeMethodOverride === 'escpos' || runtimeMethodOverride === 'pdf')) {
            options.method = runtimeMethodOverride;
            console.log(`📋 Print method override (from runtime setting): ${runtimeMethodOverride}`);
        } else {
            console.log(`📋 Using default method from config: ${printConfig.RECEIPT_METHOD}`);
        }

        console.log('📋 Calling printReceipt with options:', options);
        const result = await printReceipt(receiptData, options)
        console.log('✅ Print successful:', result.method || 'default');

        res.json({
            status: 'ok',
            ...result
        })
    } catch (e) {
        console.error('❌ Chyba pri tisku uctenky:', e.message)
        console.error('❌ Error stack:', e.stack)
        res.status(500).json({
            status: 'error',
            message: e.message,
            ...(typeof e === 'object' ? e : {})
        })
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

// Endpoint pro zjištění print capabilities (ESC/POS support, config, etc.)
app.get('/print-capabilities', async (req, res) => {
    try {
        // Check if receipt printer is available
        const printerCheck = await checkPrinterAvailability(RECEIPT_PRINTER);

        // Check if can open printer via WinSpooler API (more reliable)
        const canOpenPrinterResult = await canOpenPrinter(RECEIPT_PRINTER);

        // Check if WinSpoolerHelper.exe is available
        const winSpoolerAvailable = await isWinSpoolerHelperAvailable();

        res.json({
            status: 'ok',
            capabilities: {
                escpos: {
                    available: printerCheck.available,
                    canOpenPrinter: canOpenPrinterResult,
                    printer: RECEIPT_PRINTER,
                    printerFound: printerCheck.found,
                    printerOffline: printerCheck.offline,
                    encoding: printConfig.RECEIPT_ENCODING_MODE,
                    codepage: printConfig.RECEIPT_CODEPAGE,
                    charsPerLine: printConfig.RECEIPT_CHARS_PER_LINE
                },
                pdf: {
                    available: true,
                    printer: RECEIPT_PRINTER,
                    sumatraPath: printConfig.SUMATRA_PATH
                },
                rawSend: {
                    winSpoolerHelperAvailable: winSpoolerAvailable,
                    winSpoolerHelperPath: printConfig.WINSPOOLER_HELPER_PATH,
                    primaryMethod: printConfig.RAW_SEND_METHOD,
                    fallbackMethod: printConfig.RAW_SEND_FALLBACK,
                    canOpenPrinter: canOpenPrinterResult
                }
            },
            config: {
                receiptMethod: printConfig.RECEIPT_METHOD,
                receiptFallbackMethod: printConfig.RECEIPT_FALLBACK_METHOD,
                receiptStrictMode: printConfig.RECEIPT_STRICT_MODE,
                rawSendMethod: printConfig.RAW_SEND_METHOD,
                rawSendFallback: printConfig.RAW_SEND_FALLBACK,
                receiptPrinter: RECEIPT_PRINTER,
                stickerPrinter: STICKER_PRINTER
            },
            message: printerCheck.available
                ? (canOpenPrinterResult
                    ? 'ESC/POS receipt printing is available and ready (WinSpooler API confirmed)'
                    : 'ESC/POS receipt printing available but WinSpooler API check failed (will use fallback)')
                : 'ESC/POS receipt printing not available (printer not found or offline)'
        });
    } catch (e) {
        console.error('Chyba pri zjistovani capabilities:', e.message);
        res.status(500).json({
            status: 'error',
            message: e.message
        });
    }
});

// Test endpoint pro ESC/POS s českými diakritiky
app.post('/test-receipt-escpos', async (req, res) => {
    try {
        console.log('🧪 Testing ESC/POS receipt with Czech diacritics...');

        // Create test receipt with Czech diacritics
        const testReceipt = {
            receipt_number: 'TEST-' + Date.now(),
            order_number: '999',
            sold_at: new Date().toISOString(),
            items: [
                {
                    name: 'Příliš žluťoučký kůň',
                    quantity: 1,
                    price: 123.45
                },
                {
                    name: 'Úpěl ďábelské ódy',
                    quantity: 2,
                    price: 67.89
                }
            ],
            total_czk: 259.23,
            total_eur: 10.21,
            payment_method: [
                { method: 'Hotovost', amount: 259.23 }
            ],
            note: 'Test české diakritiky: ěščřžýáíéóúůďťň ĚŠČŘŽÝÁÍÉÓÚŮĎŤŇ'
        };

        // Force ESC/POS method for test
        const result = await printReceipt(testReceipt, { method: 'escpos' });

        res.json({
            status: 'ok',
            message: 'Test receipt sent to printer',
            testData: {
                czechTest: 'Příliš žluťoučký kůň úpěl ďábelské ódy',
                encoding: printConfig.RECEIPT_ENCODING_MODE,
                codepage: printConfig.RECEIPT_CODEPAGE
            },
            ...result
        });
    } catch (e) {
        console.error('Chyba pri testovani ESC/POS:', e.message);
        res.status(500).json({
            status: 'error',
            message: e.message,
            ...(typeof e === 'object' ? e : {})
        });
    }
});

app.get('/healthcheck', (req, res) => {
    res.json({ status: 'ok' })
})

// Diagnostic endpoint to check if server is receiving requests
app.get('/diagnostic', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running and responding',
        timestamp: new Date().toISOString(),
        config: {
            receiptMethod: printConfig.RECEIPT_METHOD,
            receiptFallbackMethod: printConfig.RECEIPT_FALLBACK_METHOD,
            receiptPrinter: printConfig.RECEIPT_PRINTER,
            runtimeMethodOverride: runtimeMethodOverride
        }
    })
})

// Endpoint to set runtime method override (for testing)
app.post('/set-print-method', (req, res) => {
    try {
        const { method } = req.body;

        if (method && (method === 'escpos' || method === 'pdf' || method === null)) {
            if (method === null) {
                runtimeMethodOverride = null;
                console.log('📋 Runtime method override cleared - using config default');
            } else {
                runtimeMethodOverride = method;
                console.log(`📋 Runtime method override set to: ${method}`);
            }

            res.json({
                status: 'ok',
                message: `Print method override set to: ${method || 'default (from config)'}`,
                currentOverride: runtimeMethodOverride,
                defaultMethod: printConfig.RECEIPT_METHOD
            });
        } else {
            res.status(400).json({
                status: 'error',
                message: 'Invalid method. Use "escpos", "pdf", or null to clear override'
            });
        }
    } catch (e) {
        console.error('Chyba pri nastavovani metody:', e.message);
        res.status(500).json({
            status: 'error',
            message: e.message
        });
    }
})

// Endpoint to get current print method setting
app.get('/get-print-method', (req, res) => {
    res.json({
        status: 'ok',
        defaultMethod: printConfig.RECEIPT_METHOD,
        runtimeOverride: runtimeMethodOverride,
        effectiveMethod: runtimeMethodOverride || printConfig.RECEIPT_METHOD
    });
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

        // Zkontrolujeme dostupnost obou tiskáren (PowerShell Get-CimInstance – WMIC není na Win11)
        const checkPrinter = async (printerName) => {
            const safeName = String(printerName).replace(/'/g, "''");
            const command = `powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Printer -Filter \\\"Name='${safeName}'\\\" | Select-Object Name, WorkOffline, PrinterStatus | ConvertTo-Json -Compress"`;
            try {
                const { stdout } = await execAsync(command, { windowsHide: true, timeout: 10000 });
                const raw = (stdout || '').trim();
                let printerFound = false;
                let isOffline = false;
                let hasUnknownStatus = false;
                if (raw && raw !== '') {
                    try {
                        let data = JSON.parse(raw);
                        if (Array.isArray(data) && data.length) data = data[0];
                        printerFound = !!data && (data.Name === printerName || (data.Name && data.Name.toUpperCase() === printerName.toUpperCase()));
                        isOffline = !!data && data.WorkOffline === true;
                        // PrinterStatus: 1=Other, 2=Unknown, 3=Idle, 4=Printing, 5=Warmup...
                        hasUnknownStatus = !!data && data.PrinterStatus === 2;
                    } catch (_) {
                        printerFound = false;
                    }
                }
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
        const fs = await import('fs');

        res.json({
            status: 'ok',
            message: 'Server bude restartován...'
        });

        // Pošleme odpověď a pak spustíme restart script
        setTimeout(() => {
            try {
                console.log('🔄 Restartování serveru (silent)...');
                const restartVbs = path.join(__dirname, 'scripts', 'run-restart-silent.vbs');
                
                if (!fs.existsSync(restartVbs)) {
                    console.error('❌ run-restart-silent.vbs neexistuje:', restartVbs);
                    setTimeout(() => process.exit(1), 1000);
                    return;
                }

                // VBS spustí restart.bat skrytě (bez CMD okna), restart.bat pak spustí start.bat přes run-start-silent.vbs
                const command = `wscript "${restartVbs}"`;
                
                console.log('📋 Spouštím restart (silent):', restartVbs);
                
                exec(command, {
                    windowsHide: true,
                    cwd: __dirname
                }, (error) => {
                    if (error) {
                        console.error('❌ Chyba pri spousteni restart scriptu:', error);
                    } else {
                        console.log('✅ Restart script spuštěn úspěšně');
                    }
                });

                // Restart script (stop + start) zabije tento proces; process.exit je záloha
                setTimeout(() => {
                    console.log('🔄 Ukončuji tento proces...');
                    process.exit(0);
                }, 3000);
            } catch (error) {
                console.error('❌ Chyba pri spousteni restart scriptu:', error);
                // Pokud selže restart script, alespoň ukončíme proces
                setTimeout(() => {
                    process.exit(1);
                }, 1000);
            }
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

// Endpoint pro otevření pokladní zásuvky – pouze WinSpooler (žádný type/UNC)
app.post('/open-drawer', async (req, res) => {
    try {
        console.log('Pokus o otevreni pokladni zasuvky...');
        console.log('Pouzivana tiskarna:', RECEIPT_PRINTER);

        await openDrawer(RECEIPT_PRINTER);

        console.log('Pokladni zasuvka: prikaz odeslan (WinSpooler, pin 2 + pin 5)');
        res.json({
            status: 'ok',
            message: 'Pokladní zásuvka otevřena',
            details: { printer: RECEIPT_PRINTER }
        });
    } catch (e) {
        const msg = e?.message ?? String(e);
        console.error('Chyba pri otevirani zasuvky:', msg);
        res.status(500).json({
            status: 'error',
            message: msg || 'Nepodařilo se otevřít zásuvku',
            details: {
                printer: RECEIPT_PRINTER,
                error: msg,
                hint: 'Zásuvka jde jen přes WinSpoolerHelper.exe – zkontrolujte, že WinSpoolerHelper.exe je v kořenové složce projektu.'
            }
        });
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
