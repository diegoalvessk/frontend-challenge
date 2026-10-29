import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://localhost:5199/entrar')
await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
await page.getByPlaceholder('Senha').fill('Kurio@2026')
await page.getByRole('button', { name: 'Entrar', exact: true }).click()
await page.waitForURL('http://localhost:5199/')
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('kurio.app.session')); return fetch('/api/cart/items', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.token }, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 }) }) })
for (const w of [390, 768]) {
  await page.setViewportSize({ width: w, height: 900 })
  for (const p of ['/', '/nft/emerald-ape-042', '/carrinho', '/pagamento', '/perfil', '/perfil/carteiras', '/perfil/favoritos', '/em-breve/aprenda', '/rota-inexistente']) {
    await page.goto('http://localhost:5199' + p)
    await page.waitForTimeout(1200)
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
    if (r.sw > r.cw) {
      const culprits = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 4).map((el) => el.tagName + '.' + String(el.className).slice(0, 60)))
      console.log(w, p, 'OVERFLOW', r, culprits)
    } else console.log(w, p, 'ok')
  }
}
await browser.close()
