import type { Page } from '@playwright/test'
import { addToCartViaApi, expect, open, signIn, test } from './support'

/**
 * Regressão visual com dados estáveis (seed determinístico). Elementos de
 * apoio à demonstração (painel de mocks, toasts) ficam fora da captura.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '[aria-label="Abrir painel de cenários da API simulada"], [data-sonner-toaster] { display: none !important; }' })
  // Garante que as imagens lazy fora da viewport também carreguem.
  await page.evaluate(async () => {
    for (const img of Array.from(document.images)) img.loading = 'eager'
    await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })))))
  })
}

test.describe('Regressão visual', () => {
  test('início @mobile', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT @mobile', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho @mobile', async ({ page }) => {
    await open(page, '/')
    await addToCartViaApi(page, [
      { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
      { nftId: 'violet-nomad-314', editionId: '1-50', quantity: 6 },
      { nftId: 'ivory-baron-088', editionId: '1-10', quantity: 2 },
    ])
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(3)
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento @mobile', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [
      { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 },
      { nftId: 'violet-nomad-314', editionId: '1-50', quantity: 6 },
    ])
    await page.goto('/pagamento')
    await expect(page.getByTestId('review-order')).toBeEnabled()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
