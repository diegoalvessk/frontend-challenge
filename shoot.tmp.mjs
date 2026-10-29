// uso: node shoot.tmp.mjs <path> <width> <name> [fullPage=1] [setup-js]
import { chromium } from 'playwright'
const [path, width, name, full = '1', setup = ''] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(width) < 600 ? 844 : 900 } })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text()) })
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message))
await page.goto('http://localhost:5199' + path)
await page.waitForFunction(() => window.__KURIO_MOCK__)
if (setup) await page.evaluate(setup)
await page.waitForTimeout(3000)
await page.screenshot({ path: 'C:/Users/DIEGO~1.TEI/AppData/Local/Temp/claude/c--Users-diego-teixeira-Documents-Projeto-Jungle/68c1fa21-814f-4064-be1e-f5289fc6512e/scratchpad/shots/' + name + '.png', fullPage: full === '1' })
console.log(logs.join('\n') || 'no console errors')
await browser.close()
