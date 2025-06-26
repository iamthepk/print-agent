# 🖨️ Print Agent

Lokální tiskový agent pro tisk účtenek (Epson TM-T20III) a štítků (Brother QL-700) pro Bubble Tea provoz.

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