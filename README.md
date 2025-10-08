# 🖨️ Print Agent Server 🖨️🖨️🖨️🖨️

Lokální tiskový agent pro POS systém s podporou účtenek a štítků.

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
```http
POST /print-receipt
Content-Type: application/json

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