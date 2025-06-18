# 🖨️ Print Agent pro POS systém

**Print Agent** je lokální Node.js aplikace pro tisk účtenek a štítků nápojů z POS systému na specializované tiskárny. Agent běží na pozadí a poskytuje REST API pro vzdálený tisk z webových aplikací nebo pokladních systémů.

## 📋 Co to dělá?

- **Tisk účtenek** na běžné tiskárny (Epson TM-T20II/III) přes PDF
- **Tisk štítků nápojů** na štítkové tiskárny (Brother QL-700) přes PNG obrázky
- **REST API** pro vzdálené volání tisku z jiných aplikací
- **Automatické generování** PDF účtenek a PNG štítků ze strukturovaných dat

## 🎯 Použití

Typické využití v restauraci/kavárně:
1. **POS systém** (web/mobilní app) odešle objednávku na Print Agent
2. **Print Agent** vygeneruje a vytiskne účtenku pro zákazníka
3. **Print Agent** vytiskne štítek nápoje pro baristu
4. **Zákazník** dostane účtenku, barista vidí štítek s detaily nápoje

## 🛠️ Technické požadavky

- **Node.js 16+**
- **Windows** (kvůli SumatraPDF a IrfanView)
- **Nainstalované ovladače tiskáren**
- **[SumatraPDF](https://www.sumatrapdfreader.org/free-pdf-reader)** (pro tisk účtenek)
- **[IrfanView](https://www.irfanview.com/)** (pro tisk štítků, volitelné)

## 📦 Instalace

1. **Naklonuj projekt**
   ```bash
   git clone <repository-url>
   cd print-agent
   ```

2. **Nainstaluj závislosti**
   ```bash
   npm install
   ```

3. **Vytvoř konfigurační soubor `.env`**
   ```env
   RECEIPT_PRINTER=Epson TM-T20III Receipt
   STICKER_PRINTER=Brother QL-700
   PORT=8000
   ```

4. **Spusť aplikaci**
   ```bash
   npm start
   ```

## ⚙️ Konfigurace

### Nastavení tiskáren

V souboru `.env` nastav názvy tiskáren přesně tak, jak se zobrazují ve Windows:

```env
# Název účtenkové tiskárny (musí být přesný)
RECEIPT_PRINTER=Epson TM-T20III Receipt

# Název štítkové tiskárny (musí být přesný)
STICKER_PRINTER=Brother QL-700

# Port pro REST API
PORT=8000
```

**Tip:** Názvy tiskáren zjistíš v „Zařízení a tiskárny" ve Windows.

### Cesty k aplikacím

Aplikace očekává tyto cesty (obvykle výchozí instalace):
- **SumatraPDF:** `C:\Users\team\AppData\Local\SumatraPDF\SumatraPDF.exe`
- **IrfanView:** `C:\Program Files\IrfanView\i_view64.exe`

## 🚀 Používání

### REST API Endpointy

#### 📄 Tisk účtenky
```http
POST http://localhost:8000/print-receipt
Content-Type: application/json

{
  "receiptNo": "12345",
  "createdAt": "2024-06-01 12:34",
  "items": [
    { "qty": 2, "name": "Bubble Tea", "price": 89 },
    { "qty": 1, "name": "Tapioka", "price": 20 }
  ],
  "totalCZK": 198,
  "totalEUR": 8.00,
  "paymentMethod": "Hotově",
  "exchangeRate": "24.7"
}
```

#### 🏷️ Tisk štítku nápoje
```http
POST http://localhost:8000/print-sticker
Content-Type: application/json

{
  "pcs": "1",
  "name": "Lootea's Brown Sugar 700 ml",
  "order": "6989",
  "round": "1",
  "sweetness": "less sweet",
  "ice": "less ice",
  "message": "Smile, You are beautiful!",
  "toppings": ["Boba", "Lychee Jelly"]
}
```

#### 🩺 Health check
```http
GET http://localhost:8000/healthcheck
```

### PowerShell příklady

**Tisk účtenky:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/print-receipt" -Method Post -Body (@{
    receiptNo = "12345"
    createdAt = "2024-06-01 12:34"
    items = @(
        @{ qty = 2; name = "Bubble Tea"; price = 89 }
    )
    totalCZK = 178
    totalEUR = 7.2
    paymentMethod = "Hotově"
    exchangeRate = "24.7"
} | ConvertTo-Json) -ContentType "application/json"
```

**Tisk štítku:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/print-sticker" -Method Post
```

## 📁 Struktura projektu

```
print-agent/
├── 📄 server.js              # Hlavní HTTP server
├── 🖨️ print/
│   ├── printReceipt.js       # Tisk účtenek (PDF → tiskárna)
│   └── printSticker.js       # Tisk štítků (HTML → PNG → tiskárna)
├── 📝 templates/
│   ├── receiptTemplate.js    # Generování PDF účtenky
│   └── stickerTemplate.html  # HTML šablona štítku
├── 📦 temp/                  # Dočasné soubory (PDF, PNG)
├── 🎨 assets/                # Obrázky, loga
├── ⚙️ .env                   # Konfigurace
└── 📖 README.md              # Tento soubor
```

## 🔧 Řešení problémů

### Tiskárna nenalezena
- Zkontroluj název tiskárny v `.env` – musí být přesný
- Ověř, že je tiskárna zapnutá a připojená
- Zkontroluj ovladače tiskárny

### PDF se netiskne
- Zkontroluj, že je SumatraPDF nainstalováno na správné cestě
- Ověř, že tiskárna podporuje PDF tisk
- Zkus vytisknout PDF ručně z SumatraPDF

### Štítek se nevygeneruje
- Zkontroluj, že je Chrome/Chromium nainstalováno (potřebuje Puppeteer)
- Ověř, že složka `temp/` existuje a je zapisovatelná

### Mezera nahoře u účtenky
- Zkontroluj nastavení okrajů v ovladači tiskárny
- Nastav „Bez okrajů" nebo minimální okraje v nastavení tisku

## 🏢 Podnikové nasazení

Pro produkční použití doporučujeme:
- Spouštět jako Windows Service
- Nastavit automatický restart při pádu
- Logování do souborů
- Záložní tiskárny při výpadku

## 📞 Podpora

Při problémech zkontroluj:
1. Konzoli aplikace (chybové hlášky)
2. Nastavení tiskáren ve Windows
3. Že jsou nainstalované všechny požadované aplikace

---

**Vytvořeno pro POS systémy restaurací a kaváren** ☕  
*Print Agent umožňuje bezproblémový tisk účtenek a štítků z webových aplikací.*