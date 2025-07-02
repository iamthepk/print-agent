# 🖨️ LOOTEA Print Agent

**LOOTEA Print Agent** je lokální tiskový server pro Bubble Tea provozovny. Poskytuje HTTP API pro automatizovaný tisk účtenek (Epson TM-T20III) a štítků (Brother QL-700). Slouží jako most mezi webovou aplikací/POS systémem a lokálními tiskárnami.

---

## ✨ Klíčové funkce

- 🧾 **Tisk účtenek** - moderní design s Bebas Neue fontem
- 🏷️ **Tisk štítků** - customizovatelné štítky pro nápoje
- 💰 **Otevření pokladní zásuvky** - ESC/POS příkazy
- 🌐 **HTTP API** - jednoduché REST endpointy
- 🗂️ **Automatický úklid** - temp soubory se mazají automaticky
- 🎨 **Moderní design** - profesionální vzhled účtenek

---

## 🛠️ Jak to funguje

### 1. Tisk účtenky
- API přijme JSON s daty objednávky
- Vygeneruje PDF účtenku pomocí PDFKit s **Bebas Neue** fontem
- Účtenka obsahuje: logo, company info, položky, daně, platbu, footer
- PDF se vytiskne přes SumatraPDF na tiskárnu
- Dočasný PDF se automaticky smaže

### 2. Tisk štítku  
- API přijme JSON s daty štítku
- Vygeneruje HTML template, převede na PNG pomocí Puppeteer
- Přidá správné DPI metadata pro kvalitní tisk
- PNG se vytiskne přes IrfanView na štítkovou tiskárnu
- Dočasný PNG se automaticky smaže

### 3. Otevření zásuvky
- Odešle ESC/POS příkaz přímo na tiskárnu
- Používá Windows API pro RAW tisk

---

## 🚀 Instalace

### 1. Předpoklady
- **Node.js 20.x+** - [Stáhnout](https://nodejs.org/)
- **SumatraPDF** - [Stáhnout](https://www.sumatrapdfreader.org/download-free-pdf-viewer)
- **IrfanView** - [Stáhnout](https://www.irfanview.com/) (pro štítky)
- **Windows** - aplikace je navržena pro Windows prostředí

### 2. Setup
```bash
# 1. Klonovat/stáhnout projekt
git clone [repo-url]
cd print-agent

# 2. Nainstalovat závislosti
npm install

# 3. Vytvořit .env soubor (viz níže)

# 4. Přidat Bebas Neue font (viz níže)

# 5. Spustit server
npm start
```

### 3. Konfigurace (.env soubor)
```env
# Názvy tiskáren (musí odpovídat názvům v Windows)
RECEIPT_PRINTER=EPSON TM-T20III Receipt
STICKER_PRINTER=Brother QL-700

# Cesty k aplikacím
SUMATRA_PATH=C:\Users\team\AppData\Local\SumatraPDF\SumatraPDF.exe
IRFANVIEW_PATH=C:\Program Files\IrfanView\i_view64.exe

# Server port
PORT=8000
```

### 4. Font setup
Pro správný vzhled účtenek potřebujete **Bebas Neue** font:

```
print-agent/
  - fonts/
    - BebasNeue-Regular.ttf  ← stáhnout z Google Fonts
  - templates/
  - server.js
  - ...
```

**Stáhnout font:**
1. Jděte na [Google Fonts - Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue)
2. Stáhněte TTF soubor
3. Uložte jako `fonts/BebasNeue-Regular.ttf`

---

## 🌐 API Reference

### Základní info
- **Base URL:** `http://localhost:8000`
- **Content-Type:** `application/json`
- **Všechny endpointy:** POST kromě healthcheck

### 📄 Tisk účtenky
**POST** `/print-receipt`

```json
{
  "orderNumber": "8932",
  "receiptNumber": "12345", 
  "createdAt": "02.07.2024 12:29:50",
  "customerName": "Walk-in Customer",
  "items": [
    {
      "name": "Iced Americano (700ml)",
      "qty": 1,
      "unitPrice": 130.00,
      "taxCodes": "A"
    }
  ],
  "subtotal": 108.26,
  "vat": [
    {
      "rate": 21,
      "amount": 21.74
    }
  ],
  "totalCZK": 130.00,
  "totalEUR": 5.12,
  "exchangeRate": "25.4",
  "paymentMethod": "Card - Contactless"
}
```

**Volitelné parametry:**
- `customerPhone`, `customerEmail` - kontakty zákazníka
- `discountAmount`, `discountPercent` - slevy
- `change` - vydané
- `companyPhone` - telefon firmy

### 🏷️ Tisk štítku  
**POST** `/print-sticker`

```json
{
  "pcs": "1",
  "name": "Brown Sugar Milk Tea 700ml", 
  "order": "8932",
  "round": "1",
  "sweetness": "less sweet",
  "ice": "normal ice",
  "message": "Enjoy your drink!",
  "toppings": ["Tapioca Pearls", "Brown Sugar"]
}
```

### 💰 Otevření zásuvky
**POST** `/open-drawer`

```json
{}
```

### ❤️ Health Check
**GET** `/healthcheck`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-07-02T12:29:50.123Z"
}
```

---

## 🎨 Design účtenky

Účtenka má moderní design s těmito prvky:

### Struktura
1. **Header** - číslo objednávky vpravo nahoře
2. **Logo** - LOOTEA (Bebas Neue 25pt)
3. **Company info** - název, adresa, VAT
4. **Receipt details** - číslo účtenky, datum
5. **Items** - položky s cenami
6. **Summary** - subtotal, daně, slevy
7. **Total** - celková částka (výrazně)
8. **Payment** - způsob platby, zaplaceno
9. **Footer** - kurz, social media, @looteacz

### Typography
- **Font:** Bebas Neue (fallback: Helvetica)
- **Velikosti:** 12-25pt podle sekce
- **Layout:** 80mm šířka s 1cm marginy

---

## 🚁 Spuštění jako služba (NSSM)

Pro produkční nasazení doporučujeme spustit jako Windows službu:

```cmd
# 1. Stáhnout NSSM z https://nssm.cc/
# 2. Otevřít CMD jako admin
# 3. Nainstalovat službu

nssm install LooteaPrintAgent
# Path: C:\Program Files\nodejs\node.exe  
# Startup directory: C:\path\to\print-agent
# Arguments: server.js

# 4. Spustit službu
nssm start LooteaPrintAgent
```

**Výhody:**
- Automatické spuštění při startu Windows
- Běh na pozadí bez oken
- Restart při pádu aplikace
- Nezávislé na přihlášení uživatele

---

## 🔧 Řešení problémů

### Tiskárna nenalezena
```
Error: Printer 'EPSON TM-T20III Receipt' not found
```
**Řešení:**
1. Zkontrolujte název tiskárny v Windows (Control Panel → Devices and Printers)
2. Aktualizujte `.env` soubor s přesným názvem
3. Restartujte print agent

### Font se nenačte
```
Bebas Neue font not found, using default fonts
```
**Řešení:**
1. Stáhněte `BebasNeue-Regular.ttf` z Google Fonts
2. Uložte do `fonts/BebasNeue-Regular.ttf`
3. Restartujte server

### PDF se nevytiskne
**Řešení:**
1. Zkontrolujte cestu k SumatraPDF v `.env`
2. Ověřte, že SumatraPDF je nainstalované
3. Zkuste manuálně vytisknout PDF z SumatraPDF

### Server se nespustí
```
Error: listen EADDRINUSE :::8000
```
**Řešení:**
1. Port 8000 je obsazený
2. Změňte port v `.env`: `PORT=8001`
3. Nebo ukončete aplikaci na portu 8000

---

## 📂 Struktura projektu

```
print-agent/
├── fonts/
│   └── BebasNeue-Regular.ttf     # Font pro účtenky
├── print/
│   ├── printReceipt.js           # Tisk účtenek
│   └── printSticker.js           # Tisk štítků
├── templates/
│   ├── receiptTemplate.js        # PDF template účtenky
│   └── stickerTemplate.html      # HTML template štítku
├── temp/                         # Dočasné soubory (auto-cleanup)
├── .env                          # Konfigurace
├── server.js                     # Hlavní server
├── package.json                  # NPM závislosti
└── README.md                     # Tato dokumentace
```

---

## 🤝 Contributing

1. Fork projekt
2. Vytvořte feature branch (`git checkout -b feature/amazing-feature`)
3. Commit změny (`git commit -m 'Add amazing feature'`)
4. Push do branch (`git push origin feature/amazing-feature`)
5. Otevřete Pull Request

---

## 📄 License

MIT License - viz [LICENSE](LICENSE) soubor.

---

## 🙋‍♂️ Support

**Problémy s instalací?** Otevřete [GitHub Issue](../../issues)

**Potřebujete pomoc?** Kontaktujte vývojářský tým.

---

*Vytvořeno s ❤️ pro LOOTEA Bubble Tea*