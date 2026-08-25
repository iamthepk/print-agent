# Print Agent v2 QA Specification

Datum: 2026-08-25

Tento dokument zachycuje produktove a technicke rozhodnuti z QA pro novou verzi Print Agenta. Slouzi jako specifikace pro implementaci na feature vetvi.

## Cil

Vytvorit Windows-only Print Agent jako samostatnou aplikaci s installerem, vlastnim admin UI, vyberem tiskaren podle roli a bez zavislosti na source code checkoutu.

POS a Print Agent budou dlouhodobe jeden produktovy ekosystem, ale instalace zustane oddelena:

- POS bezi jako webova aplikace.
- Print Agent se instaluje jen na Windows PC, ktere ma pristup k tiskarnam a pokladni zasuvce.
- POS ma v nastaveni odkaz na hotovy instalator Print Agenta.

## Zakladni Rozhodnuti

- Print Agent v2 bude vyvijen na samostatne vetvi, aby se neporusila soucasna funkcni verze.
- Prvni verze je pouze pro Windows.
- Print Agent bude samostatna aplikace s instalatorem.
- Print Agent bude mit vlastni lokalni admin UI panel.
- POS nebude umet tisknout pres browser print dialog.
- POS bude tisknout pouze pres Print Agent, nebo nebude tisknout vubec.
- Tiskarny se nastavuji v Print Agent UI, ne v POS.
- POS muze jen zapnout/vypnout, co chce tisknout, a cist stav agenta.

## Cilovy Runtime Model

Soucasny stav neni skutecna Windows Service. Dnes se agent spousti pres zkratku ve Windows Startup, ktera vola VBS a `start.bat`.

Pro v2:

- Agent bezi silent na pozadi.
- Agent se spousti po prihlaseni uzivatele do Windows.
- Agent ma ikonu v tray liste.
- Agent se pri padu automaticky restartuje.
- Windows Service se zatim nedela jako default, protoze tiskarny, tray UI a driver/user-session integrace mohou byt spolehlivejsi v prihlasene user session.
- Pozdeji lze zvazit service mode, pokud se overi pristup k printer subsystemu.

Tray menu ma minimalne obsahovat:

- Open Print Agent
- Restart
- Copy remote URL
- Quit

## Installer

Installer pro prvni verzi:

- umozni vybrat instalacni cestu,
- nainstaluje agenta mimo source checkout,
- pribali potrebne runtime soubory vcetne `WinSpoolerHelper.exe`,
- vytvori config/log/runtime slozky mimo repo,
- nastavi autostart po prihlaseni,
- spusti agenta po instalaci,
- prida uninstaller,
- zachova config pri upgradu,
- pri prvni instalaci vyzada admin heslo nebo PIN pro Agent UI.

Doporucene umisteni:

```text
Install:
  C:\Program Files\Lootea Print Agent

Config:
  %APPDATA%\Lootea\PrintAgent\config.json

Logs:
  %LOCALAPPDATA%\Lootea\PrintAgent\logs\
```

## Tiskove Role

V prvni verzi budou podporovane maximalne tyto role:

- `receipt` - jedna uctenkova tiskarna,
- `kitchen` - jedna kuchyn/bar/pripravna tiskarna,
- `cash_drawer` - navazana na receipt tiskarnu.

Pravidla:

- `cash_drawer` pouziva stejnou fyzickou tiskarnu jako `receipt`.
- V UI se muze zobrazovat jako samostatna role, ale je locked na receipt printer.
- Kazda role muze byt disabled/None.
- Pokud POS chce `receipt + kitchen`, ale agent nema nakonfigurovanou kitchen roli, POS konfiguraci nepovoli ulozit, pokud je agent dostupny a stav lze overit.
- Pokud je agent offline, POS muze nastaveni ulozit s warningem a overi ho po reconnectu.

Slovo `sticker` se bude postupne opoustet:

- dnesni sticker tisk na napoje se v novem contractu jmenuje `kitchen`,
- v POS kodu se bude postupne prepisovat terminologie ze sticker na kitchen,
- soucasne DB pole `print_sticker` se zatim mapuje jako `printKitchen`,
- pozdeji se DB/UI rozdeli na `print_kitchen` a `print_receipt`.

## POS Chovani

POS Printing Settings budou obsahovat jedno pole pro Print Agent URL a nastaveni chovani tisku.

POS nastavuje:

- Print Agent enabled/disabled,
- receipt printing enabled/disabled,
- kitchen printing enabled/disabled,
- open drawer on cash payment enabled/disabled.

POS pouze zobrazuje:

- agent connected/disconnected,
- agent version,
- protocol version,
- receipt printer status,
- kitchen printer status,
- cash drawer mapping,
- warningy typu `Kitchen printer not configured`.

POS nemeni:

- vyber konkretni tiskarny,
- role tiskaren,
- token v agentovi,
- remote tunnel konfiguraci agenta.

## Status a Chyby

Stavajici systemove diody v POS zustavaji hlavni rychla signalizace. Print dioda ukazuje zakladni stav:

- zelena: agent/tisk dostupny,
- cervena: agent offline, bad token, chybejici role nebo chyba tiskarny.

Detail chyby se ukazuje pres toast a v Printing Settings.

Pravidla pri chybach:

- Platba/prodej se nikdy nezasekne kvuli tisku.
- Kdyz Print Agent nefunguje, uctenka se i tak ulozi.
- Kdyz receipt tisk selze, POS ukaze warning toast.
- Kdyz kitchen tisk selze, POS ukaze warning toast.
- Kdyz tiskarna hlasi paper out/offline/error, POS ukaze warning toast a proces pokracuje.
- Agent offline znamena, ze se netiskne. Neni browser fallback.
- Uctenku musi jit zpetne dohledat a dovytisknout existujicim reprint flow.

Print Agent UI ma ukazovat zivy stav tiskaren:

- refresh kazdych 10 sekund,
- refresh pri otevreni POS/Agent UI.

## Kitchen Tisk

`kitchen` znamena obecny pripraveny tisk pro bar/kuchyn/pripravnu.

Soucasny use case:

- jde o dnesni napojovy sticker,
- tiskne se za danou polozku/drink,
- trigger zustava stejny jako dnes,
- tiskne se pri pridani/uprave polozky podle soucasneho POS flow.

Budouci use case:

- POS muze pozdeji tisknout jidla nebo kuchynske tickety,
- `kitchen` muze zustat obecny nazev,
- template lze pozdeji rozsirit nebo vybirat.

## Deduplikace

Cil deduplikace je ochrana proti dvojkliku, retry a duplicitnimu requestu. Neni to fronta k pozdejsimu tisku.

Pravidla:

- Kazdy automaticky print job ma stabilni `jobId`.
- Stejny `jobId` agent zpracuje jen jednou.
- Pokud POS posle stejny `jobId` znovu, agent vrati stav typu `already_processed`.
- Rucni reprint ma vzdy novy `jobId`, aby se vytiskl znovu.
- Uprava polozky ma novy `jobId`, protoze jde o novou verzi kitchen tisku.
- Multi-device concurrent POS neni v prvni verzi podporovany.
- Prvni verze podporuje jedno aktivni POS zarizeni na jednu provozovnu / jeden Print Agent.
- Dedupe historie muze byt lokalne drzana pro aktualni business day nebo 24 hodin.
- Dedupe historie se muze ulozit na disk, ale po restartu nesmi nic sama dotiskavat.

## Token a Pairing

Token chrani vsechny citlive akce agenta.

Pravidla:

- Token se vygeneruje pri instalaci nebo prvnim spusteni.
- Token se ukaze jen jednou.
- UI jasne rekne, ze token je tajny a nema se sdilet.
- Ulozeny token v agentovi ma byt hash, ne plaintext.
- POS token zada rucne.
- POS token ulozi lokalne pro konkretni browser/zarizeni.
- Pokud se token ztrati, admin vygeneruje novy token.
- Po regeneraci prestane POS fungovat, dokud se nezada novy token.
- `open drawer` pouziva stejny token jako tisk.

Doporucene rozdeleni uloziste:

- `localStorage`: Print Agent URL a token pro konkretni POS zarizeni.
- Supabase: necitlive preference typu `printReceipts`, `printKitchen`, `openDrawerOnCash`.

## Remote URL a Ngrok

Ngrok zustava podporovana remote access varianta, protoze POS muze bezet na tabletu nebo jinem PC a tiskarny mohou byt na serverovem Windows PC.

Rozhodnuti:

- Ngrok/remote tunnel muze zustat soucasti podporovaneho setupu.
- Neni zadny autosync URL pres Supabase.
- Admin zkopiruje remote URL z Print Agent UI.
- POS ma jedno pole `Print Agent URL`.
- POS po vlozeni URL a tokenu udela test connection.
- POS ulozi URL pouze po uspesnem testu, pokud je agent dostupny.
- Pokud je agent offline, POS muze ulozit nastaveni s warningem.
- V POS UI se URL zobrazuje maskovane, ne v plnem zneni.
- Běžny zamestnanec nema videt celou remote URL ani token.
- Admin UI agenta je chranene heslem/PINem.

Technicky nazev v kodu by mel byt obecny:

- `remoteAccessUrl`,
- `tunnelProvider: "ngrok"`.

POS by nemel byt pevne svazany s ngrokem. Staci, ze zna URL.

## Print Agent API v2

Doporuceny cilovy contract:

```text
GET  /health
GET  /printers
GET  /config
PATCH /config
POST /print-jobs
POST /test/receipt
POST /test/kitchen
POST /test/drawer
```

Citlive endpointy vyzaduji token:

- `/config`,
- `/print-jobs`,
- `/test/receipt`,
- `/test/kitchen`,
- `/test/drawer`,
- legacy endpoints, pokud zustanou zachovane.

`/health` muze byt dostupny bez tokenu, ale vraci jen necitlive minimum. Pro detailni health/config/capabilities se pouzije token.

`/health` ma vracet minimalne:

```json
{
  "status": "ok",
  "agentVersion": "0.1.0",
  "protocolVersion": "1"
}
```

Detailni stav s tokenem:

```json
{
  "status": "ok",
  "agentVersion": "0.1.0",
  "protocolVersion": "1",
  "capabilities": {
    "receipt": true,
    "kitchen": true,
    "cashDrawer": true
  },
  "printers": {
    "receipt": {
      "configured": true,
      "online": true,
      "name": "EPSON TM-T20III Receipt"
    },
    "kitchen": {
      "configured": true,
      "online": true,
      "name": "Brother QL-700"
    },
    "cashDrawer": {
      "configured": true,
      "online": true,
      "name": "EPSON TM-T20III Receipt"
    }
  }
}
```

## Templates

Prvni verze nepodporuje vyber template v UI.

Pouzije se:

- `receipt.default` - soucasna receipt sablona, postupne ocistena od Lootea-specific hardcodu,
- `kitchen.default` - dnesni napojovy sticker layout, ale v contractu a UI pojmenovany jako kitchen.

Pozdeji:

- template selector v Agent UI,
- vice receipt template,
- vice kitchen/ticket template,
- obecnejsi template pro jidla.

Lootea-specific veci se maji postupne presouvat z template do payloadu nebo konfigurace:

- logo,
- company name,
- address,
- footer texts,
- QR code,
- label/kitchen message,
- viditelnost poli.

## Public Release a Monorepo

Slouceni repozitaru ma prijit az po stabilizaci Print Agent v2 contractu.

Doporuceny cilovy monorepo tvar:

```text
pos/
  apps/
    web/
    print-agent/
  packages/
    print-protocol/
    shared/
  supabase/
    migrations/
    functions/
    config.toml
  docs/
    printing.md
    print-agent.md
    deployment.md
  package.json
  vercel.json
```

Slouceni ma smysl pro:

- spolecny print protocol,
- jednotnou dokumentaci,
- GitHub Releases s instalatorem agenta,
- kompatibilitu POS a agenta,
- verejny release jako jeden produkt.

Slouceni nema znamenat spolecnou instalaci. POS a Print Agent zustanou oddelene runtime aplikace.

## Implementacni Poradi

1. Ulozit tento QA/spec dokument do feature vetve.
2. Pridat runtime config mimo repo.
3. Pridat model tiskovych roli: `receipt`, `kitchen`, `cash_drawer`.
4. Pridat admin UI pro vyber tiskaren a zobrazeni stavu.
5. Pridat token auth a jednorazove zobrazeni tokenu.
6. Pridat/migrovat endpointy na `/health`, `/printers`, `/config`, `/print-jobs`.
7. Pridat dedupe pres `jobId`.
8. Zachovat legacy endpointy docasne, pokud to pomuze postupnemu prepojeni POS.
9. Upravit POS `printAgent.ts` na novy contract a terminologii `kitchen`.
10. Upravit POS Printing Settings.
11. Pripravit standalone build a installer.
12. Az potom resit monorepo merge.

## Aktualni Zachovane Chovani

Pri implementaci v2 zachovat:

- receipt se uklada v POS pred tiskem,
- tisk po platbe bezi asynchronne,
- chyba tisku nevraci platbu ani neblokuje prodej,
- receipt reprint v POS zustava,
- kitchen/sticker reprint v POS zustava,
- cash drawer se otevira pri cash payment, pokud je to v POS povolene,
- manual open drawer tlacitko zustava.

## Otevrene Body Pro Pozdeji

- skutecny Windows Service mode,
- macOS/CUPS adapter,
- AirPrint/WiFi/Bluetooth tisk,
- template selector,
- vice tiskaren pro jednu roli,
- plna multi-device podpora,
- cloud relay misto verejneho tunnelu,
- code signing installeru.
