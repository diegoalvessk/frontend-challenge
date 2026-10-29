import { chromium } from 'playwright'
const SP = process.argv[2]
const browser = await chromium.launch()
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } })
  page.on('pageerror', (e) => console.log('[pageerror] ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('[error] ' + m.text()) })
  await page.goto('http://localhost:5199/')
  await page.waitForFunction(() => window.__KURIO_MOCK__)
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    const id = JSON.parse(localStorage.getItem('kurio.app.guest-cart-id'))
    const add = (nftId, editionId, quantity) => fetch('/api/cart/items', { method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-cart-id': id }, body: JSON.stringify({ nftId, editionId, quantity }) })
    await add('emerald-ape-042', '1-50', 2); await add('violet-nomad-314', '1-50', 6); await add('ivory-baron-088', '1-10', 2)
  })
  await page.goto('http://localhost:5199/carrinho')
  await page.waitForTimeout(2500)
  if (width === 1440) {
    await page.evaluate(() => window.__KURIO_MOCK__.changePrice('violet-nomad-314', 1.1))
    await page.waitForTimeout(1500)
  }
  await page.screenshot({ path: `${SP}/shots/cart-${width}.png`, fullPage: width === 1440 })
  await page.close()
}
await browser.close()
