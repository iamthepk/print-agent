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

### Spuštění serveru
```bash
# Silent spuštění (doporučeno)
scripts\start-silent.bat

# Nebo pomocí VBS (nejtišší)
scripts\start-silent.vbs

# Interaktivní správce
scripts\server-manager.bat
```

### Zastavení serveru
```bash
scripts\stop-server.bat
```

## 📁 Struktura projektu

```
print-agent/
├── 📄 server.js              # Hlavní server aplikace
├── 📦 package.json           # Node.js závislosti
├── 📁 print/                 # Tiskové moduly
│   ├── printReceipt.js       # Tisk účtenek
│   └── printSticker.js       # Tisk štítků
├── 📁 templates/             # Šablony pro tisk
│   ├── receiptTemplate.js    # Šablona účtenky
│   └── stickerTemplate.html  # Šablona štítku
├── 📁 scripts/               # Spouštěcí skripty
│   ├── start-silent.bat      # Silent spuštění
│   ├── start-silent.vbs      # VBS silent spuštění
│   ├── server-manager.bat    # Interaktivní správce
│   ├── stop-server.bat       # Zastavení serveru
│   ├── install-service.bat   # Instalace Windows služby
│   └── uninstall-service.bat # Odebrání Windows služby
├── 📁 assets/                # Obrázky a zdroje
└── 📁 fonts/                 # Fonty pro tisk
```

## 🔧 Konfigurace

### Tiskárny
Nastavte v `.env` souboru:
```env
RECEIPT_PRINTER=EPSON TM-T20III Receipt
STICKER_PRINTER=Brother QL-700
PORT=8000
```

### Automatické spouštění
1. **Windows služba** (nejlepší):
   ```bash
   scripts\install-service.bat
   ```

2. **Startup složka**:
   ```bash
   copy scripts\start-silent.vbs "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
   ```

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
  "createdAt": "2024-03-18 12:34",  // Datum a čas
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
  "exchangeRate": "25.4 CZK/EUR"     // Kurz (volitelné)
}
```

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

## 🛠️ Správa

### Kontrola stavu
```bash
# Zkontrolovat, zda server běží
netstat -an | findstr ":800"

# Nebo použít správce
scripts\server-manager.bat
```

### Logy
- Server logy: `server-status.log`
- PowerShell logy: `%TEMP%\print-agent.log`

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