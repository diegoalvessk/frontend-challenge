import { chromium } from 'playwright'
const SP = process.argv[2]
const browser = await chromium.launch()
for (const [path, name, width] of [['/perfil', 'profile', 1440], ['/perfil/carteiras', 'wallets', 1440], ['/perfil', 'profile-m', 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  page.on('pageerror', (e) => console.log('[pageerror] ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('[error] ' + m.text()) })
  await page.goto('http://localhost:5199/entrar')
  await page.getByPlaceholder('contato@email.com').fill('ana@kurio.dev')
  await page.getByPlaceholder('Senha').fill('Kurio@2026')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL('http://localhost:5199/')
  await page.goto('http://localhost:5199' + path)
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${SP}/shots/${name}.png`, fullPage: false })
  await page.close()
}
await browser.close()
