import { USERS, addToCartViaApi, expect, loginViaUi, open, test } from './support'

test.describe('Carrinho', () => {
  test('adiciona, altera quantidade, remove e mantém após refresh @mobile', async ({ page, isMobileProject }) => {
    await open(page, '/nft/emerald-ape-042')
    if (isMobileProject) await page.getByRole('button', { name: 'Comprar NFT' }).click()
    else await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(1)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.19 ETH')

    await lines.first().getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(lines.first().getByLabel('Quantidade: 2')).toBeVisible()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.38 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('2.396 ETH')

    await page.reload()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.38 ETH')

    await page.getByRole('button', { name: 'Remover Emerald Ape #042 do carrinho' }).filter({ visible: true }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('cupom inválido, expirado e válido com resumo coerente com a API', async ({ page }) => {
    await open(page, '/')
    await addToCartViaApi(page, [{ nftId: 'violet-nomad-314', editionId: '1-50', quantity: 2 }])
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.78 ETH')

    const input = page.getByLabel('Código promocional')
    await input.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Código promocional inválido.')).toBeVisible()
    await expect(input).toHaveAttribute('aria-invalid', 'true')

    await input.fill('VERAO2025')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Este código promocional expirou.')).toBeVisible()

    await input.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('applied-coupon')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.278 ETH')
    // 2.78 - 0.278 + 0.016 = 2.518 (precisão decimal, sem erro de ponto flutuante)
    await expect(page.getByTestId('summary-total')).toHaveText('2.518 ETH')

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.00 ETH')
  })

  test('itens do visitante são preservados ao autenticar', async ({ page }) => {
    await open(page, '/')
    await addToCartViaApi(page, [{ nftId: 'golden-beat-207', editionId: '1-50', quantity: 3 }])
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar/)
    await loginViaUi(page, USERS.bruno)
    await expect(page).toHaveURL(/\/pagamento$/)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('cart-line').getByLabel('Quantidade: 3')).toBeVisible()
  })

  test('alteração de preço via Socket.IO é informada e exige aceite', async ({ page }) => {
    await open(page, '/')
    await addToCartViaApi(page, [{ nftId: 'ivory-baron-088', editionId: '1-50', quantity: 1 }])
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.79 ETH')
    await page.evaluate(() => window.__KURIO_MOCK__!.changePrice('ivory-baron-088', 1.1))
    await expect(page.getByTestId('cart-changes-banner')).toBeVisible()
    await expect(page.getByTestId('cart-line-issues')).toContainText('Preço alterado de 1.79 ETH para 1.97 ETH')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.97 ETH')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
    await expect(page.getByTestId('cart-changes-banner')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeEnabled()
  })
})
