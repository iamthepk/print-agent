# 📄 Print Agent API - Dynamický Template Dokumentace

Tento dokument popisuje, jak POS aplikace má odesílat data pro tisk účtenek pomocí **dynamického template**, který podporuje všechny company informace z databáze.

---

## 🚀 Dynamický template (VÝCHOZÍ)

**Dynamický template je nyní výchozí** - používá se automaticky pro všechny requesty.

**Není nutné nastavovat `useDynamicTemplate`** - pokud toto pole chybí nebo je `true`, použije se dynamický template.

**Záloha (legacy):** Starý template se použije pouze pokud explicitně nastavíš:
```json
{
  "useDynamicTemplate": false
}
```
*(Použije se pouze pro zálohu/legacy podporu, dokud nebude dynamický template plně otestován)*

---

## 📋 API Endpoint

```
POST http://localhost:8000/print-receipt
Content-Type: application/json
```

### ⚠️ DŮLEŽITÉ: Konfigurace URL pro POS aplikaci

**Pro webové POS aplikace** (např. `pos.lootea.cz`) **NEPOUŽÍVEJTE** `http://localhost:8000`, protože to se pokusí připojit k localhostu na zařízení uživatele, ne k PC s print agentem!

**Správné řešení:**

1. **Získejte správnou URL pomocí endpointu:**
```javascript
// Získejte URL print agentu
const response = await fetch('http://lootealetenska:8000/print-agent-url?type=web');
const data = await response.json();
const printAgentUrl = data.url; // např. "http://lootealetenska:8000"
```

2. **Nebo použijte hostname přímo:**
```javascript
// ✅ Správně pro webovou aplikaci
const printAgentUrl = 'http://lootealetenska:8000';  // Hostname PC s print agentem

// ❌ ŠPATNĚ - nebude fungovat z webové aplikace
const printAgentUrl = 'http://localhost:8000';
```

3. **Pro iOS zařízení (iPad):**
```javascript
const printAgentUrl = 'http://lootealetenska.local:8000';  // S .local pro iOS
```

**Dostupné endpointy pro zjištění URL:**
- `GET /print-agent-url?type=web` - Pro webové aplikace
- `GET /print-agent-url?type=ios` - Pro iOS zařízení
- `GET /network-info` - Kompletní síťové informace

---

## 📦 Struktura Request Body

### Základní struktura

```json
{
  "useDynamicTemplate": true,
  "orderNumber": "12345",
  "receiptNumber": "R-2024-001",
  "items": [
    {
      "qty": 2,
      "name": "Čaj Matcha",
      "unitPrice": 150
    }
  ],
  "totalCZK": 300,
  
  // Company informace (všechna pole jsou volitelná)
  "company_logo": "https://example.com/logo.png",
  "company_name": "We Are Lootea s.r.o.",
  "company_phone": "+420 123 456 789",
  "company_address": "Rybná 716/24",
  "company_city": "Prague",
  "company_poscode": "110 00",
  "company_country": "Czech Republic",
  "company_VAT": "CZ11838787",
  "company_email": "info@lootea.cz",
  "company_website": "www.lootea.cz",
  "company_google_reviews_qr_code": "https://example.com/qr.png",
  
  // Footer texty (volitelné)
  "footer_custom_text": "LOOT YOUR BALLS",
  "footer_social_text": "Enjoy & follow us on our social media",
  "footer_social_handle": "@looteacz"
}
```

---

## 🏢 Company Informace - Pole a Formáty

### 📷 Logo (`company_logo`)

**Typ:** String (URL nebo lokální název souboru)

**Formáty:**
- **URL:** `"https://example.com/logo.png"` - Obrázek se stáhne z URL
- **Lokální soubor:** `"company_logo.png"` - Načte se ze složky `assets/`

**Priorita načítání:**
1. Pokud je URL, stáhne se z POS URL
2. Pokud selže stahování, použije se lokální `assets/company_logo.png` jako záloha
3. Pokud není k dispozici, zobrazí se placeholder: `<company_logo>`

**Příklad:**
```json
{
  "company_logo": "https://cdn.example.com/logos/company-logo.png"
}
```

---

### 🏛️ Název firmy (`company_name`)

**Typ:** String

**Příklad:**
```json
{
  "company_name": "We Are Lootea s.r.o."
}
```

**Pokud chybí:** Zobrazí se `<company_name>`

---

### 📞 Telefon (`company_phone`)

**Typ:** String

**Příklad:**
```json
{
  "company_phone": "+420 123 456 789"
}
```

**Pokud chybí:** Zobrazí se `<company_phone>`

---

### 📍 Adresa (`company_address`)

**Typ:** String

**Příklad:**
```json
{
  "company_address": "Rybná 716/24"
}
```

**Pokud chybí:** Zobrazí se `<company_address>`

---

### 🏙️ Město (`company_city`)

**Typ:** String

**Poznámka:** Zobrazí se na stejném řádku jako PSČ.

**Příklad:**
```json
{
  "company_city": "Prague"
}
```

**Pokud chybí:** Zobrazí se `<company_city>`

---

### 📮 PSČ (`company_poscode`)

**Typ:** String

**Poznámka:** Zobrazí se na stejném řádku jako město (např. "Prague 110 00").

**Příklad:**
```json
{
  "company_poscode": "110 00"
}
```

**Pokud chybí:** Zobrazí se `<company_poscode>`

---

### 🌍 Země (`company_country`)

**Typ:** String

**Příklad:**
```json
{
  "company_country": "Czech Republic"
}
```

**Pokud chybí:** Zobrazí se `<company_country>`

---

### 🆔 DIČ/VAT (`company_VAT`)

**Typ:** String

**Poznámka:** Na účtence se zobrazí jako "DIČ: [hodnota]"

**Příklad:**
```json
{
  "company_VAT": "CZ11838787"
}
```

**Pokud chybí:** Zobrazí se `DIČ: <company_VAT>`

---

### 📧 Email (`company_email`)

**Typ:** String

**Příklad:**
```json
{
  "company_email": "info@lootea.cz"
}
```

**Pokud chybí:** Zobrazí se `<company_email>`

---

### 🌐 Webová stránka (`company_website`)

**Typ:** String

**Příklad:**
```json
{
  "company_website": "www.lootea.cz"
}
```

**Pokud chybí:** Zobrazí se `<company_website>`

---

### 📱 QR Kód Google Reviews (`company_google_reviews_qr_code`)

**Typ:** String (URL nebo lokální název souboru)

**Formáty:**
- **URL:** `"https://example.com/qr.png"` - Obrázek se stáhne z URL
- **Lokální soubor:** `"company_qr.png"` - Načte se ze složky `assets/`

**Priorita načítání:**
1. Pokud je URL, stáhne se z POS URL
2. Pokud selže stahování, použije se lokální `assets/company_qr.png` jako záloha
3. Pokud není k dispozici, zobrazí se placeholder: `<company_google_reviews_qr_code>`

**Poznámka:** Nad QR kódem se zobrazí text "Review us <3>"

**Příklad:**
```json
{
  "company_google_reviews_qr_code": "https://cdn.example.com/qr/reviews-qr.png"
}
```

**Alternativní pole:** Můžeš použít i `company_qr` (obě pole jsou podporovaná)

---

## 🦶 Footer Texty

### Hlavní footer text (`footer_custom_text`)

**Typ:** String

**Výchozí hodnota (pokud chybí):** `"LOOT YOUR BALLS"`

**Příklad:**
```json
{
  "footer_custom_text": "LOOT YOUR BALLS"
}
```

---

### Social text (`footer_social_text`)

**Typ:** String

**Výchozí hodnota (pokud chybí):** `"Enjoy & follow us on our social media"`

**Příklad:**
```json
{
  "footer_social_text": "Enjoy & follow us on our social media"
}
```

---

### Social handle (`footer_social_handle`)

**Typ:** String

**Výchozí hodnota (pokud chybí):** `"@looteacz"`

**Příklad:**
```json
{
  "footer_social_handle": "@looteacz"
}
```

---

## 📊 Položky účtenky (Items)

### Struktura položky

```json
{
  "qty": 2,
  "name": "Čaj Matcha",
  "unitPrice": 150,
  "price": 150  // Alternativní k unitPrice
}
```

**Pole:**
- `qty` - Počet (povinné)
- `name` - Název položky (povinné)
- `unitPrice` nebo `price` - Jednotková cena (povinné)

---

## 💰 Finanční částky

### Subtotal (`subtotal`)

**Typ:** Number

**Poznámka:** Zobrazí se pouze pokud je jiný než `totalCZK`

```json
{
  "subtotal": 720
}
```

---

### VAT/DPH (`vat`)

**Typ:** Array of Objects

```json
{
  "vat": [
    {
      "rate": 21,
      "amount": 151.2
    },
    {
      "rate": 15,
      "amount": 0
    }
  ]
}
```

**Pole:**
- `rate` - Sazba DPH v procentech
- `amount` - Částka DPH

---

### Celková částka (`totalCZK`)

**Typ:** Number (povinné)

```json
{
  "totalCZK": 871.2
}
```

---

### Celková částka v EUR (`totalEUR`)

**Typ:** Number (volitelné)

```json
{
  "totalEUR": 35.5
}
```

---

## 💳 Platební údaje

### Způsob platby (`paymentMethod`)

**Typ:** String

**Možné hodnoty:**
- `"Cash"` - Hotovost
- `"Card"` nebo `"Card - Contactless"` - Karta (zobrazí se jako "Card - Contactless")

```json
{
  "paymentMethod": "Cash"
}
```

---

### Vrácená částka (`givenAmount`)

**Typ:** Number

**Poznámka:** Používá se pro hotovostní platby

```json
{
  "givenAmount": 900
}
```

---

### Vráceno (`change`)

**Typ:** Number

**Poznámka:** Zobrazí se pouze pokud je `> 0`

```json
{
  "change": 28.8
}
```

---

## 💱 Kurz (`exchangeRate`)

**Typ:** String

**Poznámka:** Zobrazí se před footer textem

```json
{
  "exchangeRate": "1 EUR = 24.54 CZK"
}
```

---

## 🎫 Sleva (`discountAmount`)

**Typ:** Number

**Volitelná pole:**
- `discountPercent` - Procentuální sleva
- `discountName` - Název slevy
- `discountType` - Typ slevy (např. `"fixed"`)

```json
{
  "discountAmount": 50,
  "discountPercent": 10
}
```

---

## 📝 Kompletní příklad Requestu

```json
{
  "orderNumber": "888",
  "receiptNumber": "R-2024-001",
  "items": [
    {
      "qty": 2,
      "name": "Čaj Matcha",
      "unitPrice": 150
    },
    {
      "qty": 1,
      "name": "Bubble Tea",
      "unitPrice": 120
    }
  ],
  "subtotal": 420,
  "vat": [
    {
      "rate": 21,
      "amount": 88.2
    }
  ],
  "totalCZK": 508.2,
  "totalEUR": 20.7,
  "paymentMethod": "Cash",
  "givenAmount": 600,
  "change": 91.8,
  "exchangeRate": "1 EUR = 24.54 CZK",
  
  "company_logo": "https://cdn.example.com/logos/company-logo.png",
  "company_name": "We Are Lootea s.r.o.",
  "company_phone": "+420 123 456 789",
  "company_address": "Rybná 716/24",
  "company_city": "Prague",
  "company_poscode": "110 00",
  "company_country": "Czech Republic",
  "company_VAT": "CZ11838787",
  "company_email": "info@lootea.cz",
  "company_website": "www.lootea.cz",
  "company_google_reviews_qr_code": "https://cdn.example.com/qr/reviews-qr.png",
  
  "footer_custom_text": "LOOT YOUR BALLS",
  "footer_social_text": "Enjoy & follow us on our social media",
  "footer_social_handle": "@looteacz"
}
```

---

## 🔄 Mapování z databáze `company_info`

Níže je tabulka pro mapování polí z databáze `company_info` do API requestu:

| Databáze pole | API pole | Poznámka |
|--------------|----------|----------|
| `logo` | `company_logo` | URL nebo název souboru |
| `name` | `company_name` | Název firmy |
| `phone` | `company_phone` | Telefonní číslo |
| `address` | `company_address` | Ulice a číslo |
| `city` | `company_city` | Město |
| `postal_code` | `company_poscode` | PSČ |
| `ico` | `company_VAT` | IČO/DIČ |
| `email` | `company_email` | Email |
| `website` | `company_website` | Webová stránka |
| `google_reviews_qr_code` | `company_google_reviews_qr_code` | URL nebo název souboru |

---

## ⚠️ Důležité poznámky

### Placeholdery

Pokud pole **chybí** nebo je **prázdné** (`null`, `undefined`, `""`), zobrazí se na účtence placeholder ve formátu `<field_name>`.

**Příklad:**
- Pokud `company_name` chybí → zobrazí se `<company_name>`
- Pokud `company_logo` chybí → zobrazí se `<company_logo>`

### Obrázky (Logo a QR kód)

**Priorita načítání:**
1. **POS URL** - Pokud je poskytnuta URL, stáhne se z ní
2. **Lokální záloha** - Pokud selže stahování, použije se lokální soubor:
   - Logo: `assets/company_logo.png`
   - QR kód: `assets/company_qr.png`
3. **Placeholder** - Pokud není nic k dispozici, zobrazí se placeholder

### Footer texty

Footer texty (`footer_custom_text`, `footer_social_text`, `footer_social_handle`) mají **výchozí hodnoty**, pokud chybí:
- `footer_custom_text` → `"LOOT YOUR BALLS"`
- `footer_social_text` → `"Enjoy & follow us on our social media"`
- `footer_social_handle` → `"@looteacz"`

---

## 📞 Kontakt a podpora

Pro dotazy nebo problémy kontaktujte vývojový tým.

---

**Verze dokumentace:** 1.0  
**Poslední aktualizace:** 2024

