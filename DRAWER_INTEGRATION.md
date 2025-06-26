# 💰 Integrace otevírání pokladní zásuvky

Kompletní návod pro implementaci otevírání pokladní zásuvky EPSON TM-T20III v jiném projektu.

## 🔧 Požadavky

- Windows 10/11
- .NET Framework 4.0+ (už nainstalovaný ve Windows)
- EPSON TM-T20III Receipt tiskárna
- Pokladní zásuvka připojená k tiskárně

## 📡 API Endpoint

**POST** `/open-drawer`

### Odpověď při úspěchu:
```json
{
  "status": "ok",
  "message": "Pokladní zásuvka otevřena"
}
```

### Odpověď při chybě:
```json
{
  "status": "error",
  "message": "Popis chyby"
}
```

## 💻 Implementace (Node.js/Express)

```javascript
import { exec } from 'child_process';
import fs from 'fs';

app.post('/open-drawer', async (req, res) => {
    try {
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
```

## 🌐 Frontend integrace

### Základní fetch požadavek:
```javascript
async function openDrawer() {
    try {
        const response = await fetch('/open-drawer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            console.log('✅ Zásuvka otevřena');
        } else {
            console.error('❌ Chyba:', result.message);
        }
    } catch (error) {
        console.error('❌ Síťová chyba:', error);
    }
}
```

### S UI feedback:
```javascript
async function openDrawer() {
    const button = document.getElementById('open-drawer-btn');
    
    // Loading stav
    button.disabled = true;
    button.innerHTML = 'Otevírám... ⏳';
    
    try {
        const response = await fetch('/open-drawer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.status === 'ok') {
            // Úspěch
            button.innerHTML = 'Otevřeno! ✅';
            button.style.backgroundColor = '#4CAF50';
            
            // Reset po 2 sekundách
            setTimeout(() => {
                button.innerHTML = 'Otevřít zásuvku 💰';
                button.style.backgroundColor = '';
                button.disabled = false;
            }, 2000);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        // Chyba
        button.innerHTML = 'Chyba! ❌';
        button.style.backgroundColor = '#f44336';
        console.error('Chyba při otevírání zásuvky:', error);
        
        setTimeout(() => {
            button.innerHTML = 'Otevřít zásuvku 💰';
            button.style.backgroundColor = '';
            button.disabled = false;
        }, 3000);
    }
}
```

## 🔧 Konfigurace

### Environment proměnné:
```env
RECEIPT_PRINTER=EPSON TM-T20III Receipt
```

### Kontrola názvu tiskárny:
```bash
# Windows Command Prompt
wmic printer get name,portname
```

## 🧪 Testování

### Přes curl (PowerShell):
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/open-drawer" -Method POST
```

### Přes JavaScript v browseru:
```javascript
fetch('/open-drawer', { method: 'POST' })
  .then(response => response.json())
  .then(data => console.log(data));
```

## ⚙️ Jak to funguje

1. **ESC/POS příkaz**: `0x1B 0x70 0x30 0x37 0x79` (ESC p 0 7 y)
2. **Windows API**: Používá `winspool.drv` pro přímý RAW tisk
3. **Dočasné soubory**: C# kód se kompiluje a spustí, pak se automaticky smaže
4. **Kontrola úspěchu**: Program vrací "SUCCESS" při úspěchu

## 🚨 Řešení problémů

### Zásuvka se neotevírá:
1. Zkontrolujte název tiskárny v `wmic printer get name`
2. Ověřte, že je zásuvka správně připojena k tiskárně
3. Zkuste restartovat tiskárnu
4. Zkontrolujte, že tiskárna podporuje pokladní zásuvku

### Chyby kompilace:
1. Ověřte, že je nainstalován .NET Framework 4.0+
2. Zkontrolujte cestu: `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`

### Oprávnění:
1. Aplikace musí běžet s dostatečnými oprávněními pro zápis souborů
2. Tiskárna musí být dostupná pro RAW tisk

## 📋 Checklist pro implementaci

- [ ] Zkopírovat endpoint kód do serveru
- [ ] Přidat import `exec` a `fs`
- [ ] Nastavit správný název tiskárny
- [ ] Otestovat endpoint
- [ ] Implementovat frontend tlačítko
- [ ] Přidat error handling
- [ ] Otestovat s reálnou zásuvkou

## 💡 Tipy

- **UX**: Přidejte loading stav a feedback pro uživatele
- **Error handling**: Zobrazte uživateli srozumitelné chybové zprávy
- **Logging**: Logujte úspěšné i neúspěšné pokusy
- **Security**: Endpoint nemusí autentifikaci, ale zvažte rate limiting 