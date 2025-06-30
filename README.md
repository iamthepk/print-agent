# 🖨️ LOOTEA Print Agent

**LOOTEA Print Agent** je jednoduchý lokální server (Node.js aplikace), který umožňuje automatizovaný tisk účtenek (Epson TM-T20III) a štítků (Brother QL-700) v provozovnách Bubble Tea. Slouží jako most mezi webovou aplikací a lokální tiskárnou – přijímá HTTP požadavky a zajišťuje tisk na konkrétní zařízení připojené k počítači.

---

## 🛠️ Co aplikace dělá
- Přijímá požadavky na tisk účtenky nebo štítku přes HTTP API (POST endpointy)
- Vygeneruje účtenku jako PDF a odešle ji na tiskárnu přes SumatraPDF
- Vygeneruje štítek jako PNG, přidá DPI metadata a odešle jej na tiskárnu přes IrfanView
- Umožňuje otevřít pokladní zásuvku pomocí ESC/POS příkazu (C# kód spuštěný přes Windows API)
- Po startu serveru automaticky vyčistí složku `temp/` (odstraní všechny dočasné soubory)
- Hlavní stránka webu zobrazuje pouze nápis **LOOTEA PRINT AGENT**

---

## ⚙️ Jak to funguje
1. **Tisk účtenky**
   - API přijme JSON s daty účtenky
   - Vygeneruje PDF pomocí PDFKit
   - PDF se vytiskne přes SumatraPDF na zvolenou tiskárnu
   - Po tisku se PDF smaže

2. **Tisk štítku**
   - API přijme JSON s daty štítku
   - Vygeneruje HTML, převede jej na PNG pomocí Puppeteer
   - Přidá DPI metadata (pro správný tisk)
   - PNG se vytiskne přes IrfanView na zvolenou tiskárnu
   - Po tisku se PNG smaže

3. **Otevření pokladní zásuvky**
   - API endpoint spustí C# kód, který odešle ESC/POS příkaz na tiskárnu
   - Zásuvka se otevře

4. **Úklid temp složky**
   - Při každém spuštění agenta se složka `temp/` kompletně vyčistí

---

## 🚀 Jak zprovoznit

1. **Nainstalujte Node.js** (verze 20.x nebo novější)
   - [Stáhněte zde](https://nodejs.org/)

2. **Nainstalujte SumatraPDF** (pro tisk účtenek)
   - [Stáhněte zde](https://www.sumatrapdfreader.org/download-free-pdf-viewer)
   - Výchozí cesta: `C:\Users\team\AppData\Local\SumatraPDF\SumatraPDF.exe`

3. **Nainstalujte IrfanView** (pro tisk štítků)
   - [Stáhněte zde](https://www.irfanview.com/)
   - Výchozí cesta: `C:\Program Files\IrfanView\i_view64.exe`

4. **Nainstalujte závislosti**
   ```bash
   npm install
   ```

5. **Vytvořte .env soubor** v kořenové složce projektu:
   ```env
   RECEIPT_PRINTER=EPSON TM-T20III Receipt
   STICKER_PRINTER=Brother QL-700
   SUMATRA_PATH=C:\Users\team\AppData\Local\SumatraPDF\SumatraPDF.exe
   IRFANVIEW_PATH=C:\Program Files\IrfanView\i_view64.exe
   PORT=8000
   ```

6. **Spusťte server**
   ```bash
   npm start
   ```

7. **(Doporučeno) Spouštění agenta jako služba pomocí NSSM**
   - Pro automatické spouštění při startu PC a běh na pozadí bez oken použijte [NSSM (Non-Sucking Service Manager)](https://nssm.cc/):
     1. Stáhněte a rozbalte NSSM.
     2. Otevřete příkazový řádek jako správce a spusťte:
        ```cmd
        C:\nssm\win64\nssm.exe install LooteaPrintAgent
        ```
     3. Nastavte:
        - **Path:** cesta k `node.exe` (např. `C:\Program Files\nodejs\node.exe`)
        - **Startup directory:** složka s print agentem (např. `C:\Users\team\Documents\GitHub\print-agent`)
        - **Arguments:** `server.js`
     4. Službu spusťte:
        ```cmd
        nssm start LooteaPrintAgent
        ```
   - Výhody: běží na pozadí, automaticky po startu PC, bez nutnosti přihlášení uživatele, bez oken.

---

## 🌐 API Endpointy

- `POST /print-receipt` – tisk účtenky (JSON viz níže)
- `POST /print-sticker` – tisk štítku (JSON viz níže)
- `POST /open-drawer` – otevření pokladní zásuvky
- `GET /healthcheck` – kontrola běhu serveru

---

## 📋 Obsah
- [Instalace](#-instalace)
- [Konfigurace](#-konfigurace)
- [API Endpointy](#-api-endpointy)
- [Příklady použití](#-příklady-použití)
- [Řešení problémů](#-řešení-problémů)

## 🚀 Instalace

1. **Nainstalujte Node.js**
   - Minimální verze: 20.x
   - [Stáhněte zde](https://nodejs.org/)

2. **Nainstalujte SumatraPDF**
   - Potřebné pro tisk účtenek
   - [Stáhněte zde](https://www.sumatrapdfreader.org/download-free-pdf-viewer)
   - Výchozí instalační cesta: `C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe`

3. **Nainstalujte závislosti**
   ```bash
   npm install
   ```

4. **Vytvořte .env soubor**
   ```env
   RECEIPT_PRINTER=EPSON TM-T20III Receipt
   STICKER_PRINTER=Brother QL-700
   SUMATRA_PATH=C:\\Users\\team\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe
   ```

5. **Spusťte server**
   ```bash
   npm start
   ```

## ⚙️ Konfigurace

### Tiskárny
- **Účtenky**: Epson TM-T20III
  - Musí být nastavena jako výchozí tiskárna Windows
  - Název v Windows musí odpovídat `RECEIPT_PRINTER` v .env

- **Štítky**: Brother QL-700
  - Musí být nainstalovaný ovladač
  - Název v Windows musí odpovídat `STICKER_PRINTER` v .env

### Porty
- Výchozí port: 8000
- Lze změnit v .env: `PORT=3000`

## 🌐 API Endpointy

### 1. Tisk účtenky
**POST** `/print-receipt`

```json
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
}
```

### 2. Tisk štítku
**POST** `/print-sticker`

```json
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

### 3. Healthcheck
**GET** `/healthcheck`

Vrací: `{"status": "ok"}`

### 4. Otevření pokladní zásuvky
**POST** `/open-drawer`

Otevře pokladní zásuvku pomocí ESC/POS příkazu poslaného přes Windows API na tiskárnu.

Používá C# program s Windows API pro přímý RAW tisk na tiskárnu:
- ESC/POS příkaz: `0x1B 0x70 0x30 0x37 0x79`
- Automatické vytvoření a smazání dočasných souborů
- Kontrola úspěšnosti operace

Odpověď:
```json
{
  "status": "ok",
  "message": "Pokladní zásuvka otevřena"
}
```

## 📝 Příklady použití

### Tisk účtenky
```javascript
fetch('http://localhost:8000/print-receipt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    receiptNo: "123",
    createdAt: "2024-03-18 12:34",
    items: [{
      qty: 1,
      name: "Brown Sugar Milk Tea",
      price: 89
    }],
    totalCZK: 89,
    totalEUR: 3.50,
    exchangeRate: "25.4 CZK/EUR",
    paymentMethod: "Hotovost"
  })
})
```

### Tisk štítku
```javascript
fetch('http://localhost:8000/print-sticker', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pcs: "1",
    name: "Brown Sugar 700ml",
    order: "123",
    round: "1",
    sweetness: "less sweet",
    ice: "less ice",
    message: "Smile, You are beautiful!",
    toppings: ["Blueberry", "Peach"]
  })
})
```

## ❗ Řešení problémů

### Účtenky se netisknou
1. Zkontrolujte, zda je SumatraPDF nainstalován na správné cestě
2. Zkontrolujte název tiskárny v Windows
3. Zkontrolujte, zda je tiskárna online a má papír

### Štítky se netisknou
1. Zkontrolujte, zda je Brother QL-700 zapnutá a připojená
2. Zkontrolujte název tiskárny v Windows
3. Zkontrolujte, zda je nainstalovaný správný ovladač
4. Podívejte se do složky `temp/` na vygenerované PNG soubory

### Server nejde spustit
1. Zkontrolujte, zda běží Node.js: `node --version`
2. Zkontrolujte, zda jsou nainstalovány všechny závislosti: `npm install`
3. Zkontrolujte, zda není port 8000 obsazený
4. Zkontrolujte .env soubor

## 📦 Technické detaily

### Štítky
- Rozměr: 62mm x 29mm
- Rozlišení: 300 DPI
- Formát: PNG s DPI metadaty
- Rozměr v pixelech: 732x342

### Účtenky
- Šířka: 80mm
- Formát: PDF
- Font: Helvetica
- Velikost QR kódu: 20x20mm