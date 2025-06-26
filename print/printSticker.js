import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'
import { writeMetadata } from 'png-metadata-writer'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STICKER_PRINTER = process.env.STICKER_PRINTER || 'Brother QL-700'
const IRFANVIEW_PATH = process.env.IRFANVIEW_PATH || 'C:\\Program Files\\IrfanView\\i_view64.exe'

// 62mm x 29mm @ 300 DPI
const STICKER_WIDTH = 732
const STICKER_HEIGHT = 342
const DPI = 300

export async function printSticker(drink = {}) {
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

    const toppingsHtml = (drink.toppings || [])
        .map(t => `<div class="line">1 Balls: ${t}</div>`)
        .join('\n')

    const data = {
        pcs: drink.pcs,
        name: drink.name,
        order: drink.order,
        round: drink.round,
        sweetness: drink.sweetness,
        ice: drink.ice,
        message: drink.message,
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

    const browser = await puppeteer.launch({ headless: 'new' })
    const page = await browser.newPage()
    await page.setViewport({ width: STICKER_WIDTH, height: STICKER_HEIGHT, deviceScaleFactor: 1 })
    await page.setContent(template, { waitUntil: 'networkidle0' })
    await page.screenshot({
        path: imagePath,
        fullPage: true
    })
    await browser.close()

    const buffer = fsSync.readFileSync(imagePath)
    const bufferWithDpi = writeMetadata(buffer, {
        pHYs: {
            x: DPI * 39.3701,
            y: DPI * 39.3701,
            unitSpecifier: 'meter'
        }
    })
    fsSync.writeFileSync(imagePath, bufferWithDpi)

    // Kontrola existence IrfanView
    if (!fsSync.existsSync(IRFANVIEW_PATH)) {
        throw new Error(`❌ IrfanView nebyl nalezen na cestě: ${IRFANVIEW_PATH}`)
    }

    // Tisk přes IrfanView
    const command = `"${IRFANVIEW_PATH}" "${imagePath}" /print="${STICKER_PRINTER}" /silent`
    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error('❌ Tisk selhal:', err)
        } else {
            console.log(`✅ Sticker vytisknut na ${STICKER_PRINTER}`)
            if (stdout) console.log(stdout)
            if (stderr) console.error(stderr)
        }
    })

    console.log(`🖼️ Sticker vygenerován v temp složce: ${imagePath}`)
}
