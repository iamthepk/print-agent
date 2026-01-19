import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'
import { writeMetadata } from 'png-metadata-writer'
import dotenv from 'dotenv'

dotenv.config()

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STICKER_PRINTER = process.env.STICKER_PRINTER || 'Brother QL-700'
const IRFANVIEW_PATH = process.env.IRFANVIEW_PATH || 'C:\\Program Files\\IrfanView\\i_view64.exe'

// 62mm x 29mm @ 300 DPI
const STICKER_WIDTH = 732
const STICKER_HEIGHT = 342
const DPI = 300

export async function printSticker(drink = {}) {
    try {
        // Defaultní hodnoty pro povinná pole a message (pro testování)
        // Volitelná pole (toppings, extraShots) se nepoužijí, pokud je POS nepošle
        // Message je hardcodovaný a použije se vždy, pokud ho POS nepřepíše
        const defaultDrink = {
            pcs: '1',
            name: "Lootea's Brown Sugar 700 ml",
            order: "6989",
            round: "1",
            sweetness: "less sweet",
            ice: "less ice",
            message: "Smile, You are beautiful!"
        }

        // Uložíme si, která volitelná pole POS skutečně poslal
        const hasToppings = 'toppings' in drink
        const hasExtraShots = 'extraShots' in drink

        // Merge: použijeme defaultní hodnoty jen pro pole, která POS neposlal
        drink = { ...defaultDrink, ...drink }

        // Pokud POS neposlal volitelná pole, nastavíme je na undefined, aby se nepoužily defaultní hodnoty
        // (toppings, extraShots jsou volitelná - pokud je POS nepošle, nechceme je zobrazit)
        // Message zůstává hardcodovaný v defaultDrink
        if (!hasToppings) drink.toppings = undefined
        if (!hasExtraShots) drink.extraShots = undefined

        // HTML pro toppings - pouze pokud existují
        // Frontend posílá kompletně formátované stringy:
        // - Pokud quantity === 1: jen název (např. "Strawberry Balls")
        // - Pokud quantity !== 1: množství včetně "x" (např. "0.5x Strawberry Balls", "2x Chocolate")
        // Použijeme stringy tak, jak přijdou, bez přidávání dalšího množství
        const toppingsHtml = (drink.toppings && drink.toppings.length > 0)
            ? drink.toppings.map(t => `<div class="topping">${t}</div>`).join('\n')
            : ''

        // HTML pro extra shots - pouze pokud existují
        // Frontend posílá kompletně formátované stringy (stejně jako toppings)
        // Použijeme stringy tak, jak přijdou, bez přidávání dalšího množství
        const extraShotsHtml = (drink.extraShots && drink.extraShots.length > 0)
            ? drink.extraShots.map(shot => `<div class="topping">Extra shot: ${shot}</div>`).join('\n')
            : ''

        // Sestavení textu o sladkosti a ledu (povinné)
        const parts = []
        if (drink.sweetness) parts.push(drink.sweetness)
        if (drink.ice) parts.push(drink.ice)
        const drinkNote = parts.join(' ; ')

        // Sestavení textu o mléku a alkoholu na jednom řádku (volitelné)
        const milkAlcoholParts = []
        if (drink.milk) milkAlcoholParts.push(drink.milk)
        if (drink.alcohol) milkAlcoholParts.push(drink.alcohol)
        const milkAlcoholNote = milkAlcoholParts.join(' | ')
        const milkAlcoholNoteHtml = milkAlcoholNote
            ? `<div class="drink-note">${milkAlcoholNote}</div>`
            : ''

        // HTML pro flavor - pouze pokud existuje
        // Flavor přichází jako string ve formátu "Mixed with vanilla" nebo "Mixed with vanilla, Mixed with chocolate"
        const flavorHtml = (drink.flavor && drink.flavor.trim() !== '')
            ? `<div class="drink-note">${drink.flavor}</div>`
            : ''

        const data = {
            pcs: drink.pcs || '',
            name: drink.name || '',
            order: drink.order || '',
            round: drink.round || '',
            sweetness: drink.sweetness || '',
            ice: drink.ice || '',
            milk: drink.milk || '',
            alcohol: drink.alcohol || '',
            flavor: drink.flavor || '',
            message: drink.message || '', // Message je hardcodovaný v defaultDrink, nebo ho POS může přepsat
            drinkNote: drinkNote,
            milkAlcoholNote: milkAlcoholNote,
            milkAlcoholNoteHtml: milkAlcoholNoteHtml,
            flavorHtml: flavorHtml,
            extraShotsList: extraShotsHtml,
            toppingsList: toppingsHtml
        }

        const templatePath = path.join(__dirname, '../templates/stickerTemplate.html')
        let template = await fs.readFile(templatePath, 'utf-8')
        for (const key in data) {
            template = template.replace(new RegExp(`{{${key}}}`, 'g'), data[key])
        }

        const tempDir = path.join(__dirname, '../temp')
        await fs.mkdir(tempDir, { recursive: true })
        const timestamp = Date.now()
        const imagePath = path.join(tempDir, `sticker-${timestamp}.png`)

        console.log('🖼️ Spouštím Puppeteer pro generování PNG...')
        const browser = await puppeteer.launch({ headless: 'new' })
        const page = await browser.newPage()
        await page.setViewport({ width: STICKER_WIDTH, height: STICKER_HEIGHT, deviceScaleFactor: 1 })
        await page.setContent(template, { waitUntil: 'networkidle0' })
        await page.screenshot({
            path: imagePath,
            fullPage: true,
            omitBackground: false
        })
        await browser.close()
        console.log('✅ PNG vygenerován:', imagePath)

        // Přidání DPI metadat
        const buffer = fsSync.readFileSync(imagePath)
        const bufferWithDpi = writeMetadata(buffer, {
            pHYs: {
                x: DPI * 39.3701,
                y: DPI * 39.3701,
                unitSpecifier: 'meter'
            }
        })
        fsSync.writeFileSync(imagePath, bufferWithDpi)
        console.log('✅ DPI metadata přidána')

        // Kontrola existence IrfanView
        if (!fsSync.existsSync(IRFANVIEW_PATH)) {
            throw new Error(`❌ IrfanView nebyl nalezen na cestě: ${IRFANVIEW_PATH}`)
        }

        // Tisk přes IrfanView (nyní s async/await a silent mode)
        const command = `"${IRFANVIEW_PATH}" "${imagePath}" /print="${STICKER_PRINTER}" /silent /hide`
        console.log('🖨️ Spouštím tisk (silent mode):', command)

        try {
            const { stdout, stderr } = await execAsync(command, {
                windowsHide: true,
                timeout: 30000
            })
            console.log(`✅ Sticker vytisknut na ${STICKER_PRINTER}`)
            if (stdout) console.log('Stdout:', stdout)
            if (stderr) console.log('Stderr:', stderr)
        } catch (printError) {
            console.error('❌ Chyba při tisku:', printError.message)
            throw new Error(`Chyba při tisku štítku: ${printError.message}`)
        }

        // Po úspěšném tisku smažeme dočasný PNG soubor
        setTimeout(() => {
            try {
                fsSync.unlinkSync(imagePath)
                console.log('🗑️ Dočasný PNG soubor smazán:', imagePath)
            } catch (e) {
                console.warn('⚠️ Nepodařilo se smazat dočasný PNG soubor:', e.message)
            }
        }, 2000)

        return { status: 'ok', message: 'Štítek odeslán k tisku' }
    } catch (error) {
        console.error('❌ Chyba v printSticker:', error.message)
        throw error
    }
}
