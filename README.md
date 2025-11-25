# 🖨️ Print Agent Server

Lokální tiskový agent pro POS systém s podporou účtenek a štítků.

## ✨ Hlavní funkce

- 🧾 **Tisk účtenek** na termální tiskárně (Epson TM-T20III)
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

### Instalace závislostí
```bash
npm install
```

### Spuštění serveru

**Nejjednodušší způsob:**
```bash
# Spustí server v produkčním módu
npm start

# Nebo pomocí start.bat
start.bat
```

**Silent spuštění (na pozadí):**
```bash
# Silent spuštění (doporučeno pro produkci)
scripts\start-silent.bat

# Nebo pomocí VBS (nejtišší)
scripts\start-silent.vbs
```

**Interaktivní správce:**
```bash
scripts\server-manager.bat
```

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
scripts\stop-server.bat
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
| `npm start` | Spustí server v produkčním módu |
| `npm restart` | Restartuje server (zastaví a znovu spustí) |
| `start.bat` | Spustí server pomocí nejlepšího dostupného způsobu |
| `scripts\start-silent.bat` | Spustí server na pozadí (silent) |
| `scripts\stop-server.bat` | Zastaví běžící server |
| `scripts\server-manager.bat` | Interaktivní správce serveru |
| `scripts\restart-server.bat` | Pomocný skript pro restart (volá se z `npm restart`) |

## 🔄 Jak to funguje

### Architektura

Print Agent Server je Node.js aplikace, která:
1. **Naslouchá na portu 8000** (nebo 8001, pokud 8000 není dostupný)
2. **Přijímá HTTP POST požadavky** od POS aplikace (přes ngrok tunnel nebo přímo)
3. **Generuje PDF dokumenty** pro účtenky pomocí PDFKit
4. **Tiskne přes SumatraPDF** na termální tiskárnu
5. **Komunikuje s Brother QL-700** pro tisk štítků pomocí Puppeteer

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
│   ├── start-silent.bat              # Silent spuštění (pozadí) - s ngrok
│   ├── start-silent.vbs              # VBS silent spuštění (nejtišší) - s ngrok
│   ├── start-ngrok.ps1               # PowerShell skript pro spuštění ngroku
│   ├── start-with-ngrok.bat         # Wrapper pro Windows službu (server + ngrok)
│   ├── stop-server.bat               # Zastavení serveru
│   ├── restart-server.bat            # Restart serveru (volá se z npm restart)
│   ├── server-manager.bat            # Interaktivní správce
│   ├── install-service.bat           # Instalace Windows služby (s ngrok)
│   └── uninstall-service.bat         # Odebrání Windows služby
├── 📁 assets/                        # Obrázky a zdroje (logo, QR kódy)
├── 📁 fonts/                         # Fonty pro tisk (Bebas Neue)
└── 📄 ngrok-url.txt                  # Uložená ngrok URL (automaticky generováno)
```

## 🔧 Konfigurace

### Tiskárny
Nastavte v `.env` souboru:
```env
RECEIPT_PRINTER=EPSON TM-T20III Receipt
STICKER_PRINTER=Brother QL-700
PORT=8000
HOST=127.0.0.1
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

### Automatické spouštění

**✅ Ngrok se nyní spouští automaticky při všech způsobech spuštění!**

1. **Windows služba** (nejlepší):
   ```bash
   scripts\install-service.bat
   ```
   - Spustí Print Agent i ngrok automaticky při startu PC
   - Ngrok URL se uloží do `ngrok-url.txt`

2. **Startup složka**:
   ```bash
   copy scripts\start-silent.vbs "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
   ```
   - Spustí Print Agent i ngrok automaticky při startu PC
   - Ngrok běží na pozadí (skrytě)

3. **Manuální spuštění**:
   ```bash
   start.bat
   ```
   - Spustí Print Agent a ngrok s výstupem do konzole
   - Ngrok URL se zobrazí v konzoli

## 🌐 API Endpointy

### Tisk účtenky

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
```http
POST /print-sticker
Content-Type: application/json

{
  "pcs": "1",
  "name": "Brown Sugar 700ml",
  "order": "123",
  "round": "1",
  "sweetness": "less sweet",
  "ice": "less ice",
  "message": "Smile, You are beautiful!",
  "toppings": ["Blueberry", "Peach"]
}
```

### Otevření pokladní zásuvky
```http
POST /open-drawer
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

## 🚨 Řešení problémů

### Server se nespustí
1. Zkontrolujte, zda Node.js je nainstalován
2. Spusťte `scripts\stop-server.bat` pro zastavení všech instancí
3. Zkontrolujte logy v `server-status.log`

### Port není dostupný
- Server automaticky zkusí port 8001 pokud 8000 není dostupný
- Pro manuální změnu upravte `PORT` v `.env`

### Tiskárna nefunguje
1. Zkontrolujte připojení tiskárny
2. Ověřte název tiskárny v `.env`
3. Použijte endpoint `/check-printer` pro diagnostiku

---

**Print Agent Server v1.0** - Připraven pro produkční použití! 🎉