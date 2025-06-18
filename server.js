import dotenv from 'dotenv'
import express from 'express'
import { printReceipt } from './print/printReceipt.js'
import { printSticker } from './print/printSticker.js'

dotenv.config()

const app = express()
app.use(express.json())

console.log('📄 RECEIPT_PRINTER:', process.env.RECEIPT_PRINTER || 'NENASTAVENO')
console.log('🏷️ STICKER_PRINTER:', process.env.STICKER_PRINTER || 'NENASTAVENO')

app.post('/print-receipt', async (req, res) => {
    try {
        await printReceipt(req.body)
        res.json({ status: 'ok' })
    } catch (e) {
        console.error('❌ Chyba při tisku účtenky:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})

app.post('/print-sticker', async (req, res) => {
    console.log('📦 Přijatá data pro štítek:', req.body) // ← DEBUG
    try {
        await printSticker(req.body)
        res.json({ status: 'ok' })
    } catch (e) {
        console.error('❌ Chyba při tisku štítku:', e.message)
        res.status(500).json({ status: 'error', message: e.message })
    }
})


app.get('/healthcheck', (req, res) => {
    res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
    console.log(`🚀 Print agent běží na http://localhost:${PORT}`)
})
