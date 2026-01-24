# 🖨️ Print Agent Server

Lokální tiskový agent pro POS systém s podporou účtenek a štítků.

## ✨ Hlavní funkce

- 🧾 **Tisk účtenek** na termální tiskárně (Epson TM-T20III)
  - ✅ **ESC/POS RAW tisk** (výchozí) - neomezená délka, rychlý tisk (2-3s)
  - ✅ **PDF tisk** (záložní) - přes SumatraPDF, limit ~280mm
  - ✅ **Automatický fallback** - pokud ESC/POS selže, použije se PDF
  - ✅ **Podpora českých diakritik** - UTF-8 nebo CP852 codepage
  - ✅ **Univerzální** - funguje s většinou ESC/POS tiskáren, ne jen Epson
  - ✅ Normální prodejní účtenky
  - ✅ **Refund účtenky** (vrácení peněz) se záporými hodnotami pro POS
  - ✅ **Zobrazení slev s procenty** (např. "Discount 10%: -20.00 CZK")
  - ✅ **Odkaz na původní účtenku** u refundů ("Refunded Receipt No.: ...")
  - ✅ Hotovostní platby s automatickým výpočtem vrácených peněz
  - ✅ DPH, kurzy měn, informace o zákazníkovi
- 🏷️ **Tisk štítků** na štítkové tiskárně (Brother QL-700)
- 💰 **Otevírání pokladní zásuvky**
- 🚀 **Automatické spuštění** při startu Windows
- 🔄 **Běží na pozadí** (silent mode)
- 📡 **REST API** pro komunikaci s POS systémem

## 🚀 Rychlý start

### 📦 Kompletní instalace na nový PC

**Kontrolní seznam - co musíte mít nainstalované:**

- [ ] **Node.js** (LTS verze) - https://nodejs.org/
- [ ] **.NET 6.0 SDK** - https://dotnet.microsoft.com/download/dotnet/6.0 (pro WinSpoolerHelper.exe)
- [ ] **ngrok** - https://ngrok.com/download (přidat do PATH)
- [ ] **SumatraPDF** (volitelné) - https://www.sumatrapdfreader.org/ (pro PDF fallback)
- [ ] **IrfanView** - https://www.irfanview.com/ (pro tisk štítků)
- [ ] **Epson TM-T20III Receipt** - tiskárna připojená a nainstalovaná
- [ ] **Brother QL-700** - tiskárna připojená a nainstalovaná
- [ ] **.env soubor** - vytvořený a nakonfigurovaný
- [ ] **WinSpoolerHelper.exe** - v kořenovém adresáři projektu (nebo zkompilovaný)

**Požadavky pro úplně nový počítač (kde není nic nainstalované):**

#### 1. Node.js a npm
- **Stáhněte a nainstalujte Node.js** z https://nodejs.org/
- **Doporučená verze:** LTS (Long Term Support) - aktuálně v20.x nebo v22.x
- **Ověření instalace:**
  ```bash
  node --version
  npm --version
  ```

#### 2. .NET 6.0 SDK (pro WinSpoolerHelper.exe)
- **Stáhněte a nainstalujte .NET 6.0 SDK** z https://dotnet.microsoft.com/download/dotnet/6.0
- **Vyberte:** .NET 6.0 SDK (ne Runtime)
- **Ověření instalace:**
  ```bash
  dotnet --version
  ```
- **Poznámka:** Pokud máte WinSpoolerHelper.exe už v projektu, tento krok můžete přeskočit

#### 3. ngrok (pro tunelování)
- **Stáhněte ngrok** z https://ngrok.com/download
- **Rozbalte** do složky (např. `C:\ngrok\`)
- **Přidejte do PATH:**
  - Otevřete "System Properties" → "Environment Variables"
  - Přidejte cestu k ngrok do "Path" (např. `C:\ngrok`)
- **Ověření instalace:**
  ```bash
  ngrok version
  ```

#### 4. SumatraPDF (volitelné - pro PDF tisk jako fallback)
- **Stáhněte SumatraPDF** z https://www.sumatrapdfreader.org/download-free-pdf-viewer
- **Nainstalujte** do výchozí lokace: `C:\Users\<username>\AppData\Local\SumatraPDF\`
- **Nebo nastavte cestu** v `.env`:
  ```env
  SUMATRA_PATH="C:\Program Files\SumatraPDF\SumatraPDF.exe"
  ```

#### 5. IrfanView (pro tisk štítků)
- **Stáhněte IrfanView** z https://www.irfanview.com/
- **Nainstalujte** do výchozí lokace: `C:\Program Files\IrfanView\`
- **Nebo nastavte cestu** v `.env`:
  ```env
  IRFANVIEW_PATH=C:\Program Files\IrfanView\i_view64.exe
  ```

#### 6. Tiskárny
- **Epson TM-T20III Receipt** (pro účtenky)
  - Připojte USB kabelem k PC
  - Nainstalujte ovladače (obvykle automaticky přes Windows Update)
  - Ověřte název tiskárny v Windows:
    ```powershell
    Get-Printer | Select-Object Name
    ```
- **Brother QL-700** (pro štítky)
  - Připojte USB kabelem k PC
  - Nainstalujte ovladače z https://support.brother.com/
  - Ověřte název tiskárny v Windows

#### 7. Nastavení projektu
```bash
# 1. Klonujte nebo stáhněte projekt
cd C:\Users\<username>\Documents\GitHub\print-agent

# 2. Nainstalujte Node.js závislosti
npm install

# 3. Vytvořte .env soubor (viz níže)
# 4. Zkontrolujte nebo zkompilujte WinSpoolerHelper.exe (viz níže)
```

#### 8. Konfigurace .env souboru
Vytvořte soubor `.env` v kořenovém adresáři projektu:
```env
# Tiskárny
RECEIPT_PRINTER=EPSON TM-T20III Receipt
STICKER_PRINTER=Brother QL-700

# Metoda tisku účtenek
RECEIPT_METHOD=escpos
RECEIPT_FALLBACK_METHOD=pdf
RECEIPT_STRICT_MODE=false

# ESC/POS nastavení
RECEIPT_ENCODING_MODE=utf8
RECEIPT_CODEPAGE=cp852
RECEIPT_CHARS_PER_LINE=48

# RAW printing metoda
RAW_SEND_METHOD=winspooler
RAW_SEND_FALLBACK=unc_copy
WINSPOOLER_HELPER_PATH=./WinSpoolerHelper.exe

# SumatraPDF (pokud není na výchozí cestě)
SUMATRA_PATH="C:\Users\<username>\AppData\Local\SumatraPDF\SumatraPDF.exe"

# IrfanView (pokud není na výchozí cestě)
IRFANVIEW_PATH=C:\Program Files\IrfanView\i_view64.exe

# Server
PORT=8000
HOST=127.0.0.1
```

**Důležité:** Nahraďte `<username>` vaším skutečným uživatelským jménem ve Windows.

#### 9. WinSpoolerHelper.exe
**Option A: Použít pre-built binární (pokud je v projektu)**
- Pokud je `WinSpoolerHelper.exe` už v kořenovém adresáři, nic nedělejte
- Print agent ho automaticky použije

**Option B: Zkompilovat ze zdrojového kódu**
```bash
# Přejděte do složky s C# projektem
cd native\winspooler

# Spusťte build skript
build.bat

# Zkopírujte výsledný exe do kořenového adresáře
copy bin\Release\net6.0\win-x64\publish\WinSpoolerHelper.exe ..\..\WinSpoolerHelper.exe

# Ověření
cd ..\..
WinSpoolerHelper.exe --check "EPSON TM-T20III Receipt"
```

#### 10. První spuštění
```bash
# Spusťte server
npm start

# Nebo pomocí start.bat
start.bat
```

Server by se měl spustit na `http://localhost:8000` a ngrok by se měl automaticky spustit.

**Ověření:**
- Otevřete prohlížeč: http://localhost:8000
- Měli byste vidět Print Agent dashboard
- Zkontrolujte `ngrok-url.txt` pro ngrok URL

#### 11. Nastavení automatického spuštění při startu PC (silent mode)

**Pro automatické spuštění Print Agenta při každém přihlášení do Windows:**

1. **Zkopírujte VBS skript do Startup složky:**
   ```bash
   copy "scripts\PrintAgent_ngrok_Services.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
   ```

2. **Ověření:**
   - Otevřete Startup složku:
     ```bash
     shell:startup
     ```
   - Měli byste vidět `PrintAgent_ngrok_Services.vbs` v seznamu

3. **Jak to funguje:**
   - Při každém přihlášení do Windows se automaticky spustí Print Agent Server
   - Server běží na pozadí (skrytě, bez oken)
   - Ngrok se spustí automaticky a vytvoří HTTPS tunel
   - Ngrok URL se uloží do `ngrok-url.txt` v kořenovém adresáři projektu
   - Status log se vytvoří v `server-status.log`

4. **Kontrola, že to funguje:**
   - Po restartu PC zkontrolujte, zda server běží:
     ```bash
     # Otevřete prohlížeč
     http://localhost:8000
     ```
   - Zkontrolujte log soubor:
     ```bash
     type server-status.log
     ```
   - Zkontrolujte ngrok URL:
     ```bash
     type ngrok-url.txt
     ```

5. **Zastavení automatického spuštění:**
   - Odstraňte soubor ze Startup složky:
     ```bash
     del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PrintAgent_ngrok_Services.vbs"
     ```
   - Nebo použijte `stop.bat` pro zastavení běžícího serveru

**Poznámka:** VBS skript spouští `start.bat` skrytě, takže server i ngrok běží na pozadí bez oken.

### Instalace závislostí
```bash
npm install
```

**Poznámka:** Po instalaci závislostí se automaticky nainstaluje `iconv-lite` pro podporu českých diakritik (codepage CP852).

### Windows Prerequisites

**Pro ESC/POS tisk (výchozí metoda):**
- ✅ **Windows 10/11** - žádné další požadavky
- ✅ **USB připojení k tiskárně** - tiskárna musí být nainstalovaná v systému
- ✅ **Tiskárna v systému** - musí být viditelná přes `Control Panel > Devices and Printers`
- ✅ **Správný název tiskárny** - nastavte v `.env` jako `RECEIPT_PRINTER`
- ✅ **WinSpoolerHelper.exe** - Pre-built binární nebo build z source (viz níže)

**Pro PDF tisk (záložní metoda):**
- ✅ **SumatraPDF** - automaticky se používá pokud existuje na `C:\Users\team\AppData\Local\SumatraPDF\SumatraPDF.exe`
- ⚠️ **Pokud SumatraPDF není na výchozí cestě**, nastavte `SUMATRA_PATH` v `.env`

### Building WinSpoolerHelper.exe

**WinSpoolerHelper.exe** je nativní Windows aplikace pro RAW printing přes Windows Spooler API. Je to spolehlivější než UNC/copy hack.

**Option 1: Use Pre-built Binary (Recommended)**
```bash
# If WinSpoolerHelper.exe is already in the root directory, you're done!
# The print agent will automatically use it.
```

**Option 2: Build from Source**

**Prerequisites:**
- .NET 6.0 SDK or later: https://dotnet.microsoft.com/download

**Build steps:**
```bash
# Navigate to native helper directory
cd native/winspooler

# Run build script
build.bat

# Copy to print agent root
copy bin\Release\net6.0\win-x64\publish\WinSpoolerHelper.exe ..\..\WinSpoolerHelper.exe

# Verify
cd ..\..
WinSpoolerHelper.exe --check "EPSON TM-T20III Receipt"
```

**Manual build:**
```bash
cd native/winspooler
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
```

**What does WinSpoolerHelper.exe do?**
- Uses Windows Print Spooler API (OpenPrinter, WritePrinter, etc.)
- Sends data as "RAW" datatype (direct bytes, no conversion)
- Works with USB printers by name (no UNC/sharing required)
- Fast (100-200ms overhead) and reliable

**Ověření tiskárny:**
1. Otevřete PowerShell a spusťte:
   ```powershell
   wmic printer get name,status
   ```
2. Zkopírujte přesný název vaší tiskárny (např. "EPSON TM-T20III Receipt")
3. Nastavte v `.env`:
   ```env
   RECEIPT_PRINTER=EPSON TM-T20III Receipt
   ```

### Spuštění serveru

**Nejjednodušší způsob:**
```bash
# Spustí server v produkčním módu
npm start

# Nebo pomocí start.bat
start.bat
```

**Jak to funguje:**
1. Spustí se Print Agent Server na portu 8000
2. Počká se 3 sekundy, až se server spustí
3. Automaticky se spustí ngrok tunel k portu 8000
4. Ngrok vytvoří HTTPS URL (např. `[ngrok-url-redacted]`)
5. URL se zobrazí v konzoli a uloží do `ngrok-url.txt`

**Poznámka:** Oba příkazy (`npm start` i `start.bat`) dělají totéž - spustí server i ngrok automaticky.

### Restart serveru

**Rychlý restart pomocí npm:**
```bash
npm restart
```

Tento příkaz automaticky:
1. Zastaví běžící server na portu 8000/8001
2. Počká na ukončení procesů
3. Spustí server znovu pomocí `start.bat`

### Zastavení serveru

**Pomocí skriptu:**
```bash
stop.bat
```

**Manuálně (PowerShell):**
```powershell
# Najdeme a ukončíme proces na portu 8000/8001
$port = Get-NetTCPConnection -LocalPort 8000,8001 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port) { Stop-Process -Id $port.OwningProcess -Force }
```

**Manuálně (CMD):**
```cmd
for /f "tokens=5" %a in ('netstat -ano ^| findstr ":800"') do taskkill /PID %a /F
```

## 📋 Přehled příkazů

| Příkaz | Popis |
|--------|-------|
| `npm start` | Spustí server i ngrok automaticky |
| `start.bat` | Spustí server i ngrok automaticky (stejné jako `npm start`) |
| `stop.bat` | Zastaví server i ngrok |
| `scripts\restart.bat` | Restartuje server i ngrok |

## 🔄 Jak to funguje

### 📖 Case Study - Kompletní workflow

#### 1. Spuštění systému

**Automatické spuštění při přihlášení:**
```
Uživatel se přihlásí do Windows
  ↓
Windows spustí soubory ze Startup složky
  ↓
PrintAgent_ngrok_Services.vbs se spustí (skrytě)
  ↓
VBS skript spustí start.bat (skrytě)
```

**Manuální spuštění:**
```
Uživatel spustí start.bat (nebo npm start)
  ↓
start.bat se spustí
```

#### 2. Spuštění Print Agent Serveru

```
start.bat:
  1. Přepne se do správného adresáře (cd /d "%~dp0")
  2. Spustí Node.js server: node.exe server.js
  3. Počká 3 sekundy
  4. Zkontroluje, zda server běží na portu 8000
```

**Výsledek:** Print Agent Server běží na `http://localhost:8000`

#### 3. Spuštění ngrok tunelu

```
start.bat (pokud server běží):
  1. Spustí PowerShell skript: start-ngrok.ps1
  2. start-ngrok.ps1:
     - Zkontroluje, zda ngrok je v PATH
     - Zkontroluje, zda server běží na portu 8000
     - Spustí ngrok: ngrok http 8000
     - Počká 3 sekundy
     - Získá HTTPS URL z ngrok API (http://127.0.0.1:4040/api/tunnels)
     - Uloží URL do ngrok-url.txt
```

**Výsledek:** Ngrok běží a vytváří HTTPS tunel (např. `[ngrok-url-redacted]`)

#### 4. Komunikace POS aplikace s Print Agentem

```
POS aplikace (běží na HTTPS, např. https://pos.lootea.cz):
  1. Získá ngrok URL (z ngrok-url.txt nebo API endpoint)
  2. Pošle HTTP POST požadavek:
     POST [ngrok-url-redacted]/print-receipt
     Body: { orderNumber: "123", items: [...], ... }
  3. Ngrok přesměruje požadavek na localhost:8000
  4. Print Agent Server přijme požadavek
```

#### 5. Zpracování požadavku a tisk

**Pro účtenky (`/print-receipt`):**
```
Print Agent Server:
  1. Validuje vstupní data
  2. Generuje PDF účtenku pomocí PDFKit
  3. Otevře PDF přes SumatraPDF
  4. Tiskne na termální tiskárnu (Epson TM-T20III)
  5. Vrátí odpověď POS aplikaci: { status: "ok" }
```

**Pro štítky (`/print-sticker`):**
```
Print Agent Server:
  1. Validuje vstupní data
  2. Generuje HTML šablonu štítku
  3. Použije Puppeteer pro renderování HTML do obrázku
  4. Tiskne na štítkovou tiskárnu (Brother QL-700)
  5. Vrátí odpověď POS aplikaci: { status: "ok" }
```

**Systém podporuje dvě tiskárny:**
- **Epson TM-T20III** - termální tiskárna pro účtenky
- **Brother QL-700** - štítková tiskárna pro štítky

#### 6. Ukončení

```
Uživatel spustí stop.bat:
  1. Najde procesy node.exe a ngrok.exe
  2. Ukončí je
  3. Server i ngrok se zastaví
```

### Architektura

Print Agent Server je Node.js aplikace, která:
1. **Naslouchá na portu 8000** (nebo 8001, pokud 8000 není dostupný)
2. **Přijímá HTTP POST požadavky** od POS aplikace (přes ngrok tunnel nebo přímo)
3. **Generuje PDF dokumenty** pro účtenky pomocí PDFKit
4. **Tiskne přes SumatraPDF** na termální tiskárnu
5. **Komunikuje s Brother QL-700** pro tisk štítků pomocí Puppeteer

### Spuštění a ngrok

**Automatické spuštění ngroku:**
- Při spuštění pomocí `npm start` nebo `start.bat` se automaticky:
  1. Spustí Print Agent Server na portu 8000
  2. Počká se, až server běží (kontrola portu)
  3. Spustí se ngrok tunel: `ngrok http 8000`
  4. Získá se HTTPS URL z ngrok API (`http://127.0.0.1:4040/api/tunnels`)
  5. URL se zobrazí v konzoli a uloží do `ngrok-url.txt`

**Důležité:**
- Ngrok se spouští **BEZ autentizace** (důležité pro POS aplikace)
- Ngrok URL se může měnit při každém restartu (free plán)
- URL lze získat také přes API endpoint: `GET /ngrok-url`

### Možnosti připojení

**1. Přímé připojení (pro testování):**
- Frontend volá Print Agent přímo: `http://lootealetenska:8000/print-receipt`
- Vyžaduje řešení CORS, `.local` domén, atd.

**2. Ngrok Tunnel (doporučeno pro produkci - aktuální řešení):**
- Print Agent běží lokálně na `http://127.0.0.1:8000`
- Ngrok vytvoří veřejný HTTPS URL (např. `https://abc123.ngrok.io`)
- Frontend volá ngrok URL: `POST https://abc123.ngrok.io/print-receipt`
- Ngrok tuneluje požadavky do lokálního Print Agenta
- **Výhody:** 
  - ✅ HTTPS (žádné Mixed Content problémy)
  - ✅ Žádné CORS problémy (ngrok podporuje CORS)
  - ✅ Žádné problémy s `.local` doménami
  - ✅ Funguje i přes Vercel a jiné serverless platformy
  - ✅ Veřejný URL pro přístup odkudkoliv
  - ✅ Jednoduchá konfigurace

**Jak nastavit ngrok:**

**Automatické spuštění (doporučeno):**
```bash
# 1. Nainstalujte ngrok (https://ngrok.com/download)
#    Ujistěte se, že je ngrok v PATH

# 2. Spusťte Print Agent pomocí start.bat
start.bat

# Ngrok se spustí automaticky po spuštění serveru!
# URL se zobrazí v konzoli a uloží do ngrok-url.txt
```

**Manuální spuštění:**
```bash
# 1. Spusťte Print Agent na portu 8000
npm start

# 2. V novém terminálu spusťte ngrok (BEZ autentizace!)
ngrok http 8000

# 3. Zkopírujte HTTPS URL (např. [ngrok-url-redacted])
# 4. Použijte tento URL v POS aplikaci
```

**⚠️ DŮLEŽITÉ:**
- Ngrok musí běžet **BEZ autentizace** (`ngrok http 8000`), jinak POS aplikace dostane 401 chybu
- URL se ukládá automaticky do `ngrok-url.txt`
- URL můžete získat také přes API endpoint: `GET /ngrok-url`
- S free plánem se URL mění při každém restartu ngroku

### Dynamický template systém
- **Používá se pouze dynamický template** (`receiptTemplateDynamic.js`)
- **Všechna data z POS aplikace**: Logo, QR kódy, firemní údaje atd. jsou načítány z JSON payloadu

### Automatické formátování
- **Datum**: Automaticky se přeformátuje na formát `dd-mm-yyyy` (např. "03-11-2025")
- **Velikosti**: Logo a QR kód mají pevnou velikost 80 bodů (nastaveno v Print Agentu)
- **Encoding**: Batch soubory používají UTF-8 kódování pro správné zobrazení českých znaků

## 📁 Struktura projektu

```
print-agent/
├── 📄 server.js                      # Hlavní server aplikace
├── 📦 package.json                   # Node.js závislosti a skripty
├── 🚀 start.bat                      # Hlavní spouštěcí skript
├── 📁 print/                         # Tiskové moduly
│   ├── printReceipt.js               # Tisk účtenek
│   └── printSticker.js               # Tisk štítků
├── 📁 templates/                     # Šablony pro tisk
│   └── receiptTemplateDynamic.js     # Dynamická šablona účtenky
├── 📁 scripts/                       # Spouštěcí a správní skripty
│   ├── PrintAgent_ngrok_Services.vbs # VBS skript pro automatické spuštění při přihlášení (silent)
│   └── restart.bat                   # Restart serveru i ngrok
├── 📄 start.bat                      # Hlavní spouštěcí skript (server + ngrok)
├── 📄 stop.bat                       # Zastavení serveru i ngrok
├── 📄 start-ngrok.ps1                # PowerShell skript pro spuštění ngroku
├── 📁 assets/                        # Obrázky a zdroje (logo, QR kódy)
├── 📁 fonts/                         # Fonty pro tisk (Bebas Neue)
└── 📄 ngrok-url.txt                  # Uložená ngrok URL (automaticky generováno)
```

## 🔧 Konfigurace

### Tiskárny a metody tisku
Nastavte v `.env` souboru:
```env
# Printer names
RECEIPT_PRINTER=EPSON TM-T20III Receipt
STICKER_PRINTER=Brother QL-700

# Receipt printing method
RECEIPT_METHOD=escpos              # escpos (default) or pdf
RECEIPT_FALLBACK_METHOD=pdf        # pdf (default) or none
RECEIPT_STRICT_MODE=false          # true = no fallback on error

# ESC/POS settings
RECEIPT_ENCODING_MODE=utf8         # utf8 (default) or codepage
RECEIPT_CODEPAGE=cp852             # cp852 (Czech), cp850 (Western), cp866 (Cyrillic)
RECEIPT_CHARS_PER_LINE=48          # Default for 80mm receipts

# RAW printing method (Windows Spooler)
RAW_SEND_METHOD=winspooler         # winspooler (default, recommended) or unc_copy
RAW_SEND_FALLBACK=unc_copy         # unc_copy (default) or none
WINSPOOLER_HELPER_PATH=./WinSpoolerHelper.exe  # Path to helper exe

# Server
PORT=8000
HOST=127.0.0.1
```

### Metody tisku účtenek

**1. ESC/POS RAW tisk (výchozí, doporučeno)**
- ✅ **Neomezená délka** účtenek (žádný limit jako u PDF)
- ✅ **Rychlý tisk** (2-3 sekundy)
- ✅ **Univerzální** - funguje s většinou ESC/POS termálních tiskáren
- ✅ **Podpora českých diakritik** - UTF-8 nebo CP852 codepage
- ✅ **Žádné externí nástroje** (nevyžaduje SumatraPDF)
- ⚠️ Vyžaduje USB připojení k tiskárně

**2. PDF tisk (záložní metoda)**
- ✅ **Spolehlivý** - používá SumatraPDF
- ⚠️ **Limit délky** ~280mm (fixní výška PDF)
- ⚠️ **Pomalejší** - generování PDF + SumatraPDF overhead

**Doporučené nastavení pro produkci:**
```env
RECEIPT_METHOD=escpos              # Primární metoda
RECEIPT_FALLBACK_METHOD=pdf        # Záloha pokud ESC/POS selže
RECEIPT_STRICT_MODE=false          # Povolit fallback
RAW_SEND_METHOD=winspooler         # Windows Spooler API (nejspolehlivější)
RAW_SEND_FALLBACK=unc_copy         # UNC/copy fallback
```

**Pokud chcete používat pouze PDF:**
```env
RECEIPT_METHOD=pdf
RECEIPT_FALLBACK_METHOD=none
```

**⚠️ DŮLEŽITÉ o HOST:**
- **Pro ngrok tunnel (doporučeno):** Použijte `HOST=127.0.0.1` (localhost) - ngrok vytahuje localhost a směruje to dál
- **Pro přímý přístup z sítě:** Nastavte `HOST=0.0.0.0` (naslouchá na všech síťových rozhraních)

### 🌐 Připojení k POS aplikaci (Ngrok Tunnel)

**💡 Aktuální řešení - Ngrok Tunnel (doporučeno pro produkci):**

POS aplikace používá **ngrok tunnel** pro komunikaci s Print Agentem. Toto řešení funguje i přes Vercel a jiné serverless platformy.

**Jak to funguje:**
1. Print Agent běží lokálně na `http://127.0.0.1:8000`
2. Ngrok se spustí automaticky (při použití `start.bat`) nebo manuálně: `ngrok http 8000`
3. Ngrok vytvoří veřejný HTTPS URL (např. `[ngrok-url-redacted]`)
4. **Frontend** volá: `POST [ngrok-url-redacted]/print-receipt`
5. Ngrok tuneluje požadavky do lokálního Print Agenta

**Výhody:**
- ✅ HTTPS (žádné Mixed Content problémy)
- ✅ Funguje i přes Vercel a jiné serverless platformy
- ✅ Žádné CORS problémy (ngrok podporuje CORS)
- ✅ Žádné problémy s `.local` doménami
- ✅ Veřejný URL pro přístup odkudkoliv
- ✅ Jednoduchá konfigurace
- ✅ **Automatické spuštění** ngroku společně s Print Agentem
- ✅ **Automatické získání URL** přes API endpoint `/ngrok-url`

**Nastavení ngrok:**

**Automatické spuštění (doporučeno):**
```bash
# 1. Nainstalujte ngrok (https://ngrok.com/download)
#    Ujistěte se, že je ngrok v PATH

# 2. Spusťte Print Agent pomocí start.bat
start.bat

# Ngrok se spustí automaticky po spuštění serveru!
# URL se zobrazí v konzoli a uloží do ngrok-url.txt
```

**Manuální spuštění:**
```bash
# 1. Spusťte Print Agent
npm start

# 2. V novém terminálu spusťte ngrok (BEZ autentizace!)
ngrok http 8000

# 3. Zkopírujte HTTPS URL z ngrok výstupu (např. [ngrok-url-redacted])
# 5. Použijte tento URL v POS aplikaci
```

**Příklad volání z POS aplikace:**
```javascript
// POS aplikace běží na HTTPS (https://pos.lootea.cz)
const printAgentUrl = 'https://abc123.ngrok.io'; // Ngrok URL

await fetch(`${printAgentUrl}/print-receipt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(receiptData)
});
```

**Poznámka:** Pro produkci zvažte použití ngrok s pevným URL (ngrok paid plan) nebo alternativní řešení s vlastním serverem.

### 🔄 Alternativní řešení (pokud ngrok nevyhovuje)

**Přímé připojení z lokální sítě:**
Pokud potřebujete přistupovat přímo z lokální sítě (bez ngrok), nastavte `HOST=0.0.0.0` v `.env` a použijte IP adresu nebo hostname PC.

### Automatické spouštění při startu PC

**✅ Ngrok se nyní spouští automaticky při všech způsobech spuštění!**

#### Nastavení automatického spuštění (silent mode)

**Pro automatické spuštění Print Agenta při každém přihlášení do Windows:**

1. **Zkopírujte VBS skript do Startup složky:**
   ```bash
   copy "scripts\PrintAgent_ngrok_Services.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
   ```

2. **Otevření Startup složky pro kontrolu:**
   ```bash
   # Otevřete Startup složku v Průzkumníku
   shell:startup
   ```
   - Měli byste vidět `PrintAgent_ngrok_Services.vbs` v seznamu

3. **Jak to funguje:**
   - ✅ Při každém přihlášení do Windows se automaticky spustí Print Agent Server
   - ✅ Server běží na pozadí (skrytě, bez oken)
   - ✅ Ngrok se spustí automaticky a vytvoří HTTPS tunel
   - ✅ Ngrok URL se uloží do `ngrok-url.txt` v kořenovém adresáři projektu
   - ✅ Status log se vytvoří v `server-status.log`

4. **Kontrola, že to funguje:**
   - Po restartu PC zkontrolujte, zda server běží:
     ```bash
     # Otevřete prohlížeč
     http://localhost:8000
     ```
   - Zkontrolujte log soubor:
     ```bash
     type server-status.log
     ```
   - Zkontrolujte ngrok URL:
     ```bash
     type ngrok-url.txt
     ```
   - Nebo použijte PowerShell:
     ```powershell
     # Zkontrolujte, zda server běží na portu 8000
     Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
     ```

5. **Zastavení automatického spuštění:**
   - Odstraňte soubor ze Startup složky:
     ```bash
     del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PrintAgent_ngrok_Services.vbs"
     ```
   - Nebo použijte `stop.bat` pro zastavení běžícího serveru:
     ```bash
     stop.bat
     ```

**Poznámka:** VBS skript spouští `start.bat` skrytě, takže server i ngrok běží na pozadí bez oken.

#### Manuální spuštění (s konzolí)

**Pokud chcete vidět výstup v konzoli:**
```bash
start.bat
```
- Spustí Print Agent a ngrok s výstupem do konzole
- Ngrok URL se zobrazí v konzoli a uloží do `ngrok-url.txt`

## 🌐 API Endpointy

### Tisk účtenky

**Endpoint:** `POST /print-receipt`  
**Content-Type:** `application/json`

**Response transparentnost:**
Endpoint vrací detailní informace o použité metodě tisku:
```json
{
  "status": "ok",
  "method": "escpos",           // "escpos" nebo "pdf"
  "fallbackUsed": false,        // true pokud primární metoda selhala
  "durationMs": 2345,           // doba tisku v ms
  "bytesWritten": 1024,         // počet bytů odeslaných (ESC/POS)
  "printer": "EPSON TM-T20III Receipt",
  "message": "Receipt printed via ESC/POS"
}
```

**V případě chyby:**
```json
{
  "status": "error",
  "message": "Print failed (strict mode): Printer not found",
  "method": "escpos",
  "fallbackUsed": false,
  "durationMs": 123,
  "error": "Printer not found"
}
```

#### Normální prodej
```http
POST /print-receipt
Content-Type: application/json

{
  "orderNumber": "123",
  "receiptNumber": "R-001",
  "createdAt": "2024-03-18 12:34",
  "customerName": "Jan Novák",
  "items": [
    {
      "qty": 2,
      "name": "Brown Sugar Milk Tea",
      "price": 89
    }
  ],
  "subtotal": 178.00,
  "vat": [
    {
      "rate": 21,
      "amount": 30.79
    }
  ],
  "discountAmount": 20.00,
  "discountPercent": 10,
  "totalCZK": 158.00,
  "totalEUR": 6.22,
  "exchangeRate": "25.4 CZK/EUR",
  "paymentMethod": "Hotovost",
  "givenAmount": 200.00,
  "change": 42.00
}
```

#### Refund účtenka (vrácení peněz)

**🚨 DŮLEŽITÉ pravidla pro refund:**
1. ✅ **`isRefund: true`** - MUSÍ být nastaveno
2. ✅ **`originalReceiptNumber`** - Odkaz na původní účtenku (POVINNÉ)
3. ✅ **`totalCZK`** - MUSÍ být **ZÁPORNÉ** (např. -89.0) pro POS systém
4. ✅ **Nové `receiptNumber`** - Refund má vlastní číslo (ne stejné jako původní)

**Co se zobrazí na účtence:**
- Velký nadpis **"REFUND RECEIPT"**
- **"Refunded Receipt No.: RF-001"** (odkaz na původní účtenku)
- Všechny ceny jako záporné hodnoty (např. -89.00 CZK)
- Text "Refunded amount" místo "Paid amount"

```http
POST /print-receipt
Content-Type: application/json

{
  "isRefund": true,
  "receiptNumber": "202500000000040",
  "originalReceiptNumber": "202500000000035",
  "orderNumber": "16",
  "createdAt": "2024-10-27 15:00",
  "customerName": "Jan Novák",
  "items": [
    {
      "qty": 1,
      "name": "Brown Sugar Milk Tea",
      "price": 89
    }
  ],
  "subtotal": 89.0,
  "vat": [
    {
      "rate": 21,
      "amount": 15.41
    }
  ],
  "totalCZK": -89.0,
  "paymentMethod": "Card"
}
```

**Jak to vypadá na účtence:**
```
         REFUND RECEIPT

Receipt No.: 202500000000040
Refunded Receipt No.: 202500000000035  ← Odkaz
Customer: Jan Novák
2024-10-27 15:00
─────────────────────────────
Brown Sugar Milk Tea     -89.00 CZK  ← Záporné
─────────────────────────────
Subtotal:               -89.00 CZK
Tax 21%:                -15.41 CZK

TOTAL:                  -89.00 CZK  ← Záporné
─────────────────────────────
Card:                   -89.00 CZK
Refunded amount:        -89.00 CZK
```

### 📝 Všechna podporovaná pole

```javascript
{
  // === ZÁKLADNÍ INFO ===
  "orderNumber": "123",              // Číslo objednávky (#123 nahoře)
  "receiptNumber": "R-001",          // Číslo účtenky
  "createdAt": "2024-03-18 12:34",  // Datum a čas (automaticky formátováno na dd-mm-yyyy)
  "customerName": "Jan Novák",       // Jméno zákazníka
  
  // === REFUND ===
  "isRefund": true,                  // true = refund účtenka
  "originalReceiptNumber": "R-001",  // POVINNÉ pro refund - odkaz na původní účtenku
  
  // === POLOŽKY ===
  "items": [
    {
      "qty": 2,                      // Množství
      "name": "Brown Sugar Tea",     // Název
      "price": 89                    // Cena (nebo "unitPrice")
    }
  ],
  
  // === CENY ===
  "subtotal": 178.00,                // Mezisoučet
  "totalCZK": 178.00,                // Celkem v Kč (pro REFUND musí být ZÁPORNÉ: -178.00)
  "totalEUR": 7.00,                  // Celkem v EUR (volitelné)
  
  // === DPH ===
  "vat": [
    {
      "rate": 21,                    // Sazba (21%)
      "amount": 30.79                // Částka DPH
    }
  ],
  
  // === SLEVA ===
  "discountAmount": 20.00,           // Sleva v Kč (povinné pro zobrazení slevy)
  "discountPercent": 10,             // Sleva v % (zobrazí "Discount 10%: -20.00 CZK")
  "discountName": "Student",         // Název slevy (zobrazí "Discount (Student): -20.00 CZK")
  "discountType": "fixed",           // Typ slevy: "fixed" (zobrazí "Discount 20 CZK: -20.00 CZK")
                                     // + Zobrazí se text "You saved 20.00 CZK!"
  
  // === PLATBA ===
  "paymentMethod": "Hotovost",       // Metoda platby
  "givenAmount": 200.00,             // Částka od zákazníka (jen hotovost)
  "change": 42.00,                   // Vráceno (automaticky se spočítá pokud chybí)
  
  // === DALŠÍ ===
  "exchangeRate": "25.4 CZK/EUR",    // Kurz (volitelné)
  
  // === FIRMOVÉ ÚDAJE (pro dynamický template) ===
  "company_logo": "https://...",     // URL loga firmy
  "company_name": "Název firmy s.r.o.",
  "company_phone": "+420 123 456 789",
  "company_address": "Ulice 123",
  "company_city": "Praha",
  "company_poscode": "11000",
  "company_country": "Česká republika",
  "company_VAT": "CZ12345678",
  "company_email": "info@firma.cz",
  "company_website": "https://firma.cz",
  "company_google_reviews_qr_code": "https://...",  // URL QR kódu pro recenze
  
  // === QR CODE TEXT (volitelné) ===
  "qr_text_above": "We appreciate your feedback",  // Text nad QR kódem - zobrazí se pouze pokud je poslán
  "qr_text_below": "Thank You!",                   // Text pod QR kódem - zobrazí se pouze pokud je poslán
  
  // === FOOTER TEXT (volitelné) ===
  "footer_custom_text": "Vlastní text",  // První řádek footeru (velký text) - zobrazí se pouze pokud je poslán
  "footer_social_text": "Sledujte nás",  // Druhý řádek footeru (malý text) - zobrazí se pouze pokud je poslán
  "footer_social_handle": "@firma"        // Třetí řádek footeru (handle) - zobrazí se pouze pokud je poslán
}
```

### 📌 Poznámky k dynamickému template

- **Logo a QR kód**: Pokud jsou URL, stáhnou se automaticky. Pokud nejsou k dispozici, nezobrazí se nic (žádné placeholdery)
- **Firemní údaje**: Pokud nějaké pole chybí, zobrazí se placeholder `<company_xxx>` (kromě company_phone, company_email, company_website - ty se nezobrazí, pokud chybí)
- **QR texty**: Texty nad a pod QR kódem lze přizpůsobit pomocí `qr_text_above` a `qr_text_below` (zobrazí se pouze pokud jsou poslány z POS aplikace)
- **Footer texty**: Tři řádky footeru lze přizpůsobit pomocí `footer_custom_text`, `footer_social_text` a `footer_social_handle` (zobrazí se pouze pokud jsou poslány z POS aplikace)
- **Formátování data**: Automaticky se přeformátuje na `dd-mm-yyyy hh:mm:ss` bez ohledu na vstupní formát
- **Velikosti**: Logo a QR kód mají pevnou velikost 80 bodů (nastaveno v Print Agentu)
- **OrderNumber**: Automaticky se přizpůsobí velikost písma pro dlouhá čísla, aby se vešla na účtenku

---

## 💡 Příklady kódu

### Normální prodej s hotovostí a slevou
```javascript
const receipt = {
  receiptNumber: "202500000000035",
  orderNumber: "16",
  createdAt: new Date().toLocaleString('cs-CZ'),
  customerName: "Jana Nováková",
  items: [
    { qty: 2, name: "Cappuccino", price: 75 },
    { qty: 1, name: "Brownie", price: 45 }
  ],
  subtotal: 195.0,
  vat: [{ rate: 21, amount: 33.77 }],
  discountAmount: 19.50,
  discountPercent: 10,         // Zobrazí "Discount 10%:"
  totalCZK: 175.50,
  paymentMethod: "Hotovost",
  givenAmount: 200.0,
  change: 24.50
};

await fetch('http://localhost:8000/print-receipt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(receipt)
});
```

### Refund účtenka
```javascript
// Původní účtenka
const originalReceipt = {
  receiptNumber: "202500000000035",
  totalCZK: 175.50,
  // ... další data
};

// Vytvoření refund účtenky
const refundReceipt = {
  isRefund: true,                                    // ← POVINNÉ
  receiptNumber: "202500000000040",                  // ← NOVÉ číslo
  originalReceiptNumber: originalReceipt.receiptNumber, // ← Odkaz na původní
  orderNumber: originalReceipt.orderNumber,
  createdAt: new Date().toLocaleString('cs-CZ'),
  customerName: originalReceipt.customerName,
  items: [
    { qty: 1, name: "Brownie", price: 45 }  // Vracené položky
  ],
  subtotal: 45.0,
  vat: [{ rate: 21, amount: 7.79 }],
  totalCZK: -45.0,                           // ← ZÁPORNÉ!
  paymentMethod: originalReceipt.paymentMethod
};

await fetch('http://localhost:8000/print-receipt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(refundReceipt)
});
```

---

## 🚨 Časté chyby a řešení

### ❌ Chyba: Refund bez záporné hodnoty
```javascript
{
  "isRefund": true,
  "totalCZK": 45.0  // ❌ ŠPATNĚ - POS to bere jako další tržbu!
}
```
**✅ Správně:**
```javascript
{
  "isRefund": true,
  "totalCZK": -45.0  // ✅ ZÁPORNÉ pro POS systém
}
```

### ❌ Chyba: Chybí originalReceiptNumber
```javascript
{
  "isRefund": true,
  "receiptNumber": "RF-002",
  // ❌ Chybí originalReceiptNumber
  "totalCZK": -45.0
}
```
**✅ Správně:**
```javascript
{
  "isRefund": true,
  "receiptNumber": "RF-002",
  "originalReceiptNumber": "R-001",  // ✅ POVINNÉ
  "totalCZK": -45.0
}
```

### ❌ Chyba: Sleva se nezobrazuje s procenty
```javascript
{
  "discountAmount": 20.0
  // ❌ Chybí discountPercent
}
// Zobrazí jen: "Discount: -20.00 CZK"
```
**✅ Správně:**
```javascript
{
  "discountAmount": 20.0,
  "discountPercent": 10  // ✅ Přidáno
}
// Zobrazí: "Discount 10%: -20.00 CZK" + "You saved 20.00 CZK!"
```

---

### Tisk štítku

**Endpoint:** `POST /print-sticker`  
**Content-Type:** `application/json`

#### Struktura dat

```javascript
{
  "pcs": "string",              // POVINNÉ - Počet kusů (obvykle "1")
  "name": "string",              // POVINNÉ - Název produktu s velikostí (např. "Cappuccino 250ml")
  "order": "string",             // POVINNÉ - Číslo objednávky (např. "123")
  "round": "string",             // POVINNÉ - Pořadové číslo drinku v rámci objednávky (např. "1", "2")
  "sweetness": "string",         // POVINNÉ - Úroveň sladkosti (např. "Bez cukru", "Středně", "Hodně")
  "ice": "string",               // POVINNÉ - Množství ledu (např. "Bez ledu", "Málo", "Hodně")
  "message": "string",           // VOLITELNÉ - Vlastní zpráva (legacy, nepoužívá se)
  "toppings": ["string"],        // VOLITELNÉ - Pole názvů příloh (např. ["Čokoláda", "Šlehačka"])
  "alcohol": "string",           // VOLITELNÉ - Název alkoholu (např. "Vodka", "Rum")
  "milk": "string",              // VOLITELNÉ - Název mléka (např. "Ovesné mléko", "Mandlové mléko")
  "extraShots": ["string"]       // VOLITELNÉ - Pole extra shotů ve formátu "množstvíx název" (např. ["2x Vodka", "1x Rum"])
}
```

#### Příklad kompletního payloadu

```json
{
  "pcs": "1",
  "name": "Cappuccino 250ml",
  "order": "123",
  "round": "1",
  "sweetness": "Středně",
  "ice": "Bez ledu",
  "toppings": ["Čokoláda", "Šlehačka"],
  "extraShots": ["2x Vodka", "1x Rum"],
  "alcohol": "Vodka",
  "milk": "Ovesné mléko"
}
```

#### Příklad minimálního payloadu (bez volitelných polí)

```json
{
  "pcs": "1",
  "name": "Espresso 250ml",
  "order": "123",
  "round": "1",
  "sweetness": "Bez cukru",
  "ice": "Bez ledu"
}
```

#### Poznámky

- **Povinná pole:** `pcs`, `name`, `order`, `round`, `sweetness`, `ice`
- **Volitelná pole:** `message`, `toppings`, `alcohol`, `milk`, `extraShots`
- **Formát extraShots:** pole stringů ve formátu `"množstvíx název"` (např. `"2x Vodka"`)
- **Formát toppings:** pole názvů příloh bez množství (zobrazí se jako `"1x Balls: název"`)
- **alcohol:** název hlavního alkoholu (pokud je drink alkoholický) - zobrazí se v řádku se sladkostí a ledem
- **milk:** název alternativního mléka (pokud není kravské mléko) - zobrazí se v řádku se sladkostí a ledem

#### Formátování na štítku

Štítek zobrazuje data v následujícím pořadí:
1. **Zpráva a číslo objednávky** (nahoře)
2. **Název nápoje** (velký text)
3. **Sladkost ; Led | Mléko | Alkohol** (vše na jednom řádku, pokud jsou k dispozici)
4. **Extra shots** (samostatné řádky, pokud jsou k dispozici)
5. **Toppings** (zobrazí se jako "1x Balls: název", pokud jsou k dispozici)

### Otevření pokladní zásuvky
```http
POST /open-drawer
```

### Print Capabilities
```http
GET /print-capabilities
```

Vrátí informace o dostupných metodách tisku a aktuální konfiguraci. Užitečné pro diagnostiku a kontrolu, zda je ESC/POS tisk dostupný.

**Odpověď:**
```json
{
  "status": "ok",
  "capabilities": {
    "escpos": {
      "available": true,
      "printer": "EPSON TM-T20III Receipt",
      "printerFound": true,
      "printerOffline": false,
      "encoding": "utf8",
      "codepage": "cp852",
      "charsPerLine": 48
    },
    "pdf": {
      "available": true,
      "printer": "EPSON TM-T20III Receipt",
      "sumatraPath": "C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"
    }
  },
  "config": {
    "receiptMethod": "escpos",
    "receiptFallbackMethod": "pdf",
    "receiptStrictMode": false,
    "receiptPrinter": "EPSON TM-T20III Receipt",
    "stickerPrinter": "Brother QL-700"
  },
  "message": "ESC/POS receipt printing is available and ready"
}
```

### Test ESC/POS Receipt
```http
POST /test-receipt-escpos
```

Vytiskne testovací účtenku s českými diakritiky pro ověření ESC/POS tisku. Vždy použije ESC/POS metodu (ignoruje konfiguraci).

**Testovací text:**
- "Příliš žluťoučký kůň"
- "Úpěl ďábelské ódy"
- "Test české diakritiky: ěščřžýáíéóúůďťň ĚŠČŘŽÝÁÍÉÓÚŮĎŤŇ"

**Odpověď:**
```json
{
  "status": "ok",
  "message": "Test receipt sent to printer",
  "testData": {
    "czechTest": "Příliš žluťoučký kůň úpěl ďábelské ódy",
    "encoding": "utf8",
    "codepage": "cp852"
  },
  "method": "escpos",
  "fallbackUsed": false,
  "durationMs": 1234,
  "bytesWritten": 512,
  "printer": "EPSON TM-T20III Receipt"
}
```

### Healthcheck
```http
GET /healthcheck
```

### Ngrok URL
```http
GET /ngrok-url
```

Vrátí aktuální ngrok HTTPS URL (pokud ngrok běží). Užitečné pro automatickou detekci URL v POS aplikacích:

**Úspěšná odpověď:**
```json
{
  "status": "ok",
  "url": "[ngrok-url-redacted]",
  "source": "api"
}
```

**Pokud ngrok neběží:**
```json
{
  "status": "ok",
  "url": null,
  "message": "Ngrok URL není dostupná. Ujistěte se, že ngrok běží.",
  "hint": "Spusťte ngrok pomocí: ngrok http 8000"
}
```

**Použití v POS aplikaci:**
```javascript
// Automatické získání ngrok URL
const response = await fetch('http://localhost:8000/ngrok-url');
const data = await response.json();

if (data.url) {
  // Použijte ngrok URL pro komunikaci
  const printAgentUrl = data.url;
  await fetch(`${printAgentUrl}/print-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(receiptData)
  });
}
```

**Poznámka:** Endpoint nejdřív zkusí získat URL z ngrok API (`http://127.0.0.1:4040/api/tunnels`), pokud se to nepodaří, zkusí načíst z uloženého souboru `ngrok-url.txt`.

### Síťové informace
```http
GET /network-info
```

Vrátí IP adresu serveru a URL pro přístup z jiných zařízení:
```json
{
  "status": "ok",
  "localhost": "http://localhost:8000",
  "network": "http://192.168.1.100:8000",
  "hostnameUrl": "http://lootealetenska:8000",
  "hostnameLocal": "http://lootealetenska.local:8000",
  "ipAddress": "192.168.1.100",
  "hostname": "lootealetenska",
  "port": 8000,
  "message": "Pro přístup z iPadu použijte: http://lootealetenska.local:8000 (iOS) nebo http://lootealetenska:8000 nebo http://192.168.1.100:8000"
}
```

### URL pro POS aplikace
```http
GET /print-agent-url?type=web
GET /print-agent-url?type=ios
```

Vrátí doporučenou URL podle typu klienta. Užitečné pro automatickou konfiguraci POS aplikací:
```json
{
  "status": "ok",
  "url": "http://lootealetenska:8000",
  "alternatives": {
    "hostname": "http://lootealetenska:8000",
    "hostnameLocal": "http://lootealetenska.local:8000",
    "ipAddress": "http://192.168.1.100:8000",
    "localhost": "http://localhost:8000"
  },
  "clientType": "web",
  "message": "Doporučená URL pro web: http://lootealetenska:8000",
  "note": "⚠️ Pro webové aplikace použijte hostname BEZ .local (funguje spolehlivěji)"
}
```

**Parametry:**
- `type=web` - Pro webové aplikace (doporučeno) - vrací hostname **BEZ .local**
- `type=ios` - Pro iOS zařízení (iPad/iPhone) - vrací hostname **S .local**
- `type=android` - Pro Android zařízení
- `type=desktop` - Pro desktop aplikace

### Automatická detekce (nový endpoint)
```http
GET /auto-detect?type=web
GET /auto-detect?type=ios
```

Vrátí všechny možné URL varianty v **správném pořadí priority**. **DŮLEŽITÉ:** Pro webové aplikace je `.local` na konci, protože často nefunguje!

**Pro webové aplikace (`type=web`):**
```json
{
  "status": "ok",
  "variants": [
    "http://lootealetenska:8000",           // 1. BEZ .local (nejlepší pro web!)
    "http://192.168.1.100:8000",            // 2. IP adresa
    "http://lootealetenska.local:8000",     // 3. S .local (zkusit jako poslední - často nefunguje!)
    "http://localhost:8000"                  // 4. Localhost
  ],
  "recommended": "http://lootealetenska:8000",
  "clientType": "web",
  "message": "Pro webové aplikace zkuste varianty v pořadí priority. .local často NEFUNGUJE v webových aplikacích - použijte hostname bez .local nebo IP adresu.",
  "usage": {
    "web": "Použijte: http://lootealetenska:8000 nebo http://192.168.1.100:8000 (NEPOUŽÍVEJTE .local jako první!)",
    "note": "⚠️ Webové aplikace často NEMOHOU resolvovat .local domény kvůli bezpečnostním omezením prohlížeče."
  }
}
```

**Pro iOS zařízení (`type=ios`):**
```json
{
  "status": "ok",
  "variants": [
    "http://lootealetenska.local:8000",     // 1. S .local (funguje na iOS)
    "http://lootealetenska:8000",           // 2. BEZ .local
    "http://192.168.1.100:8000",            // 3. IP adresa
    "http://localhost:8000"                 // 4. Localhost
  ],
  "recommended": "http://lootealetenska.local:8000",
  "clientType": "ios"
}
```

### Detekce variant podle hostname
```http
GET /detect-variants?hostname=lootealetenska&port=8000&type=web
```

Vrátí správné pořadí variant pro konkrétní hostname. Užitečné, když POS aplikace zná hostname, ale neví, v jakém pořadí zkoušet:
```json
{
  "status": "ok",
  "hostname": "lootealetenska",
  "port": 8000,
  "clientType": "web",
  "variants": [
    "http://lootealetenska:8000",           // 1. BEZ .local (zkusit jako první!)
    "http://192.168.1.100:8000",            // 2. IP adresa
    "http://lootealetenska.local:8000"      // 3. S .local (zkusit jako poslední!)
  ],
  "recommended": "http://lootealetenska:8000",
  "message": "Pro webové aplikace zkuste nejdřív: http://lootealetenska:8000 (BEZ .local). .local často nefunguje v webových aplikacích!",
  "testingInstructions": "Zkuste každou variantu v pořadí a použijte první, která odpoví na /healthcheck endpoint."
}
```

## 🛠️ Správa a diagnostika

### Kontrola stavu serveru
```bash
# Zkontrolovat, zda server běží na portu 8000/8001
netstat -an | findstr ":800"

# Nebo použít interaktivní správce
scripts\server-manager.bat

# Healthcheck přes API
curl http://localhost:8000/healthcheck
```

### Logy a debugování
- **Server logy**: Zobrazují se v konzoli (pokud běží v debug módu)
- **Status log**: `server-status.log` (pokud je vytvořen při silent spuštění)
- **Debug console**: Všechny změny v šablonách se projeví po restartu (`npm restart`)

### Workflow pro vývoj
1. **Upravte kód** v `templates/receiptTemplateDynamic.js` nebo jiných souborech
2. **Restartujte server**: `npm restart`
3. **Otestujte**: Odešlete testovací požadavek na `/print-receipt`
4. **Zkontrolujte výstup**: Vytisknutá účtenka nebo PDF v temp složce

## 🎯 Tipy pro lepší UI

### Vizuální vylepšení
- ✅ Emoji ikony v konzoli
- ✅ Barevné výstupy
- ✅ Strukturované logy s časovými razítky

### Správa
- ✅ Interaktivní menu
- ✅ Automatické logování
- ✅ Debug mód s oknem

### Výkon
- ✅ Automatická kontrola portů
- ✅ Fallback na alternativní porty
- ✅ Čisté ukončování procesů

## 📘 ESC/POS Tisk - Jak to funguje

### Architektura ESC/POS tisku

```
POS aplikace
    ↓
POST /print-receipt (JSON payload)
    ↓
print/printReceipt.js (orchestrace + method selection)
    ↓
print/printReceiptEscpos.js (rendering)
    ↓ (vytvoří ESC/POS buffer)
print/rawPrinter.js (Windows raw printing)
    ↓ (PowerShell + copy command)
Windows printer queue (USB)
    ↓
Termální tiskárna (ESC/POS compatible)
```

### Co je ESC/POS?

**ESC/POS** (Epson Standard Code for Point of Sale) je standardní protokol pro termální tiskárny:
- ✅ **Příkazy jako byte sekvence** - např. `\x1B\x40` = inicializace
- ✅ **Univerzální** - podporuje většina termálních tiskáren (Epson, Star, Citizen, atd.)
- ✅ **Neomezená délka** - žádný page break, tiskne až do konce
- ✅ **Rychlý** - přímá komunikace, žádné PDF/rendering overhead

### Podpora českých diakritik

**Režim UTF-8 (výchozí):**
```env
RECEIPT_ENCODING_MODE=utf8
```
- Moderní tiskárny (většina Epson TM-T20III, TM-T88, atd.)
- Všechny české znaky fungují přímo

**Režim Codepage (fallback):**
```env
RECEIPT_ENCODING_MODE=codepage
RECEIPT_CODEPAGE=cp852
```
- Starší tiskárny bez UTF-8
- CP852 = Central European (Czech, Polish, Hungarian)
- CP850 = Western European
- CP866 = Cyrillic

**Test diakritiky:**
```bash
curl -X POST http://localhost:8000/test-receipt-escpos
```

### Windows RAW Printing

**Primární metoda: WinSpoolerHelper.exe (Windows Spooler API)**

Používáme nativní C# helper aplikaci, která volá Windows Print Spooler API přímo:

```
Node.js Print Agent
    ↓ (execFile)
WinSpoolerHelper.exe
    ↓ (P/Invoke)
winspool.drv (Windows Spooler)
    ↓
OpenPrinter()      - Open printer handle
StartDocPrinter()  - Start job (datatype: "RAW")
StartPagePrinter() - Start page
WritePrinter()     - Write ESC/POS bytes
EndPagePrinter()   - End page
EndDocPrinter()    - End job
ClosePrinter()     - Close handle
    ↓
Printer Driver → USB → Tiskárna
```

**Výhody WinSpooler API:**
- ✅ **Spolehlivé** - skutečné Windows API, ne hack
- ✅ **Rychlé** - 100-200ms overhead (vs. 500ms PowerShell)
- ✅ **Nepotřebuje UNC/sdílení** - funguje s lokálními USB tiskárnami
- ✅ **RAW datatype** - žádná konverze, přímé ESC/POS bytes
- ✅ **Validace** - kontroluje dostupnost tiskárny (OpenPrinter)

**Fallback metoda: UNC copy command (legacy)**

Pokud WinSpoolerHelper.exe není dostupný nebo selže, použije se legacy metoda:

1. **Vytvoření temp souboru** s ESC/POS bytes
2. **Copy command**: `copy /B temp.bin \\localhost\PRINTER`
3. **Windows spooler** pošle data na tiskárnu
4. **Tiskárna** interpretuje ESC/POS příkazy

**Konfigurace metod:**
```env
RAW_SEND_METHOD=winspooler         # Primární (doporučeno)
RAW_SEND_FALLBACK=unc_copy         # Fallback (legacy)
```

### Konfigurace pro různé tiskárny

**Epson TM-T20III (testováno):**
```env
RECEIPT_PRINTER=EPSON TM-T20III Receipt
RECEIPT_METHOD=escpos
RECEIPT_ENCODING_MODE=utf8
RECEIPT_CHARS_PER_LINE=48
RAW_SEND_METHOD=winspooler
```

**Epson TM-T88V:**
```env
RECEIPT_PRINTER=EPSON TM-T88V Receipt
RECEIPT_METHOD=escpos
RECEIPT_ENCODING_MODE=utf8
RECEIPT_CHARS_PER_LINE=42  # narrower paper
RAW_SEND_METHOD=winspooler
```

**Star TSP143:**
```env
RECEIPT_PRINTER=Star TSP143
RECEIPT_METHOD=escpos
RECEIPT_ENCODING_MODE=utf8
RECEIPT_CHARS_PER_LINE=48
RAW_SEND_METHOD=winspooler
```

**Starší tiskárna bez UTF-8:**
```env
RECEIPT_PRINTER=Your Printer Name
RECEIPT_METHOD=escpos
RECEIPT_ENCODING_MODE=codepage
RECEIPT_CODEPAGE=cp852
RECEIPT_CHARS_PER_LINE=48
```

## 🚨 Řešení problémů

### Server se nespustí
1. Zkontrolujte, zda Node.js je nainstalován
2. Spusťte `stop.bat` pro zastavení všech instancí
3. Zkontrolujte logy v `server-status.log`

### Port není dostupný
- Server automaticky zkusí port 8001 pokud 8000 není dostupný
- Pro manuální změnu upravte `PORT` v `.env`

### Tiskárna nefunguje
1. Zkontrolujte připojení tiskárny
2. Ověřte název tiskárny v `.env`
3. Použijte endpoint `/check-printer` pro diagnostiku
4. Použijte endpoint `/print-capabilities` pro kontrolu ESC/POS dostupnosti

### WinSpoolerHelper.exe problémy

**1. "WinSpoolerHelper.exe not found":**
```bash
# Build helper from source
cd native/winspooler
build.bat

# Copy to print agent root
copy bin\Release\net6.0\win-x64\publish\WinSpoolerHelper.exe ..\..\WinSpoolerHelper.exe

# Verify
cd ..\..
WinSpoolerHelper.exe --check "EPSON TM-T20III Receipt"
```

**2. Build errors (.NET SDK not found):**
```bash
# Check if .NET is installed
dotnet --version

# If not, download from:
# https://dotnet.microsoft.com/download
```

**3. "Failed to open printer" (Win32 Error 1801):**
- Název tiskárny je nesprávný
- Zkontrolujte přesný název:
  ```bash
  wmic printer get name
  ```
- Nebo použijte PowerShell:
  ```powershell
  Get-Printer | Select-Object Name
  ```

**4. "Access denied" (Win32 Error 5):**
- Zkontrolujte oprávnění k tiskárně
- Zkuste spustit jako administrátor (pokud je to nutné)

**5. Fallback na UNC copy:**
```bash
# Pokud WinSpooler selže, print agent automaticky použije UNC copy
# Zkontrolujte logy pro details:
# "⚠️ Primary RAW send method (winspooler) failed"
# "🔄 Attempting RAW send fallback: unc_copy"

# Pro force UNC copy:
RAW_SEND_METHOD=unc_copy
```

**6. Test WinSpoolerHelper.exe manuálně:**
```bash
# Create test ESC/POS file
# ESC @ (init) + "Hello World" + LF + GS V (cut)

# Print via WinSpooler
WinSpoolerHelper.exe "EPSON TM-T20III Receipt" test.bin "Test Job"

# Check printer
WinSpoolerHelper.exe --check "EPSON TM-T20III Receipt"
```

### ESC/POS tisk nefunguje

**1. České znaky se netisknou správně:**
```env
# Zkuste změnit encoding mode
RECEIPT_ENCODING_MODE=codepage
RECEIPT_CODEPAGE=cp852
```

**2. Tiskárna vytiskne "raw" data (nečitelné znaky):**
- Tiskárna není v RAW módu
- Zkuste použít PDF metodu:
  ```env
  RECEIPT_METHOD=pdf
  RECEIPT_FALLBACK_METHOD=none
  ```

**3. Chyba "Printer not found":**
```bash
# Zjistěte přesný název tiskárny
wmic printer get name,status

# Nastavte přesný název v .env
RECEIPT_PRINTER=EPSON TM-T20III Receipt
```

**4. ESC/POS tisk je pomalý:**
- Normální rychlost je 2-3 sekundy
- Pokud trvá déle, zkontrolujte USB připojení
- Zkuste endpoint `/test-receipt-escpos` pro benchmark

**5. Fallback na PDF nefunguje:**
```bash
# Zkontrolujte config
curl http://localhost:8000/print-capabilities

# Ověřte SumatraPDF cestu
SUMATRA_PATH="C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"
```

**6. Test Czech diacritics:**
```bash
# Test ESC/POS s českými znaky
curl -X POST http://localhost:8000/test-receipt-escpos

# Pokud znaky nejsou správně:
# 1. Změňte RECEIPT_ENCODING_MODE=codepage
# 2. Nastavte RECEIPT_CODEPAGE=cp852
# 3. Restartujte server: npm restart
```

### Debugging ESC/POS

**Zapnout verbose logging:**
```bash
# V konzoli uvidíte:
# - Počet bytů odeslaných na tiskárnu
# - Encoding mode (utf8/codepage)
# - Metodu použitou (escpos/pdf)
# - Fallback info
# - Duration v ms
```

**Zkontrolovat capabilities:**
```bash
curl http://localhost:8000/print-capabilities
```

**Test s jednoduchým receiptem:**
```bash
curl -X POST http://localhost:8000/print-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_number": "TEST-001",
    "items": [{"name": "Test", "quantity": 1, "price": 100}],
    "total_czk": 100,
    "payment_method": [{"method": "Cash", "amount": 100}]
  }'
```

---

**Print Agent Server v1.2** - S Windows Spooler API RAW tiskem! 🎉