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
        const defaultDrink = {
            pcs: '1',
            name: "Lootea's Brown Sugar 700 ml",
            order: "6989",
            round: "1",
            sweetness: "less sweet",
            ice: "less ice",
            message: "Smile, You are beautiful!",
            toppings: ["Blueberry", "Peach", "Pomegranate", "Cherry"]
        }

        drink = { ...defaultDrink, ...drink }

        // HTML pro toppings - pouze pokud existují
        // Pokud topping už obsahuje množství (např. "2x název"), použijeme ho tak, jak je
        // Jinak přidáme "1x" před název
        const toppingsHtml = (drink.toppings && drink.toppings.length > 0)
            ? drink.toppings.map(t => {
                // Zkontrolujeme, zda string už začíná číslem a "x" (např. "2x", "3x")
                const quantityPattern = /^\d+x\s/i;
                if (quantityPattern.test(t.trim())) {
                    // Topping už má množství, použijeme ho tak, jak je
                    return `<div class="topping">${t}</div>`;
                } else {
                    // Topping nemá množství, přidáme "1x"
                    return `<div class="topping">1x ${t}</div>`;
                }
            }).join('\n')
            : ''

        // HTML pro extra shots - pouze pokud existují
        // Extra shots přicházejí ve formátu "množstvíx název" (např. "2x Vodka", "1x Rum")
        // Množství je vždy součástí názvu, takže použijeme shot tak jak je
        const extraShotsHtml = (drink.extraShots && drink.extraShots.length > 0)
            ? drink.extraShots.map(shot => {
                // Zkontrolujeme, zda string už začíná číslem a "x" (např. "2x", "3x")
                const quantityPattern = /^\d+x\s/i;
                if (quantityPattern.test(shot.trim())) {
                    // Extra shot už má množství, použijeme ho tak, jak je
                    return `<div class="topping">Extra shot: ${shot}</div>`;
                } else {
                    // Extra shot nemá množství, přidáme "1x"
                    return `<div class="topping">Extra shot: 1x ${shot}</div>`;
                }
            }).join('\n')
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

        const data = {
            pcs: drink.pcs || '',
            name: drink.name || '',
            order: drink.order || '',
            round: drink.round || '',
            sweetness: drink.sweetness || '',
            ice: drink.ice || '',
            milk: drink.milk || '',
            alcohol: drink.alcohol || '',
            message: drink.message || '',
            drinkNote: drinkNote,
            milkAlcoholNote: milkAlcoholNote,
            milkAlcoholNoteHtml: milkAlcoholNoteHtml,
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
            fullPage: true
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
