import { addToCartViaApi, expect, mock, open, test } from './support'

test.describe('Detalhe do NFT', () => {
  test('acesso direto exibe galeria, informações, edições e preço @mobile', async ({ page, isMobileProject }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Coleção:')).toBeVisible()
    if (!isMobileProject) {
      await expect(page.getByTestId('detail-price')).toHaveText('1.19 ETH')
      await page.getByRole('button', { name: 'Detalhe do rosto' }).click()
      await expect(page.getByRole('button', { name: 'Detalhe do rosto' })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('NFT inexistente mostra página de não encontrado', async ({ page }) => {
    await open(page, '/nft/nao-existe-123')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('rota inexistente mostra 404', async ({ page }) => {
    await open(page, '/qualquer/coisa')
    await expect(page.getByText('404')).toBeVisible()
  })

  test('edição indisponível não pode ser escolhida e o limite de quantidade é respeitado', async ({ page }) => {
    // Seed: edição 1/1 de sage-nomad-009 começa esgotada.
    await open(page, '/nft/sage-nomad-009')
    const soldOut = page.getByRole('radio', { name: /Edição 1\/1, esgotada/ })
    await expect(soldOut).toHaveAttribute('aria-disabled', 'true')
    await soldOut.click({ force: true })
    await expect(soldOut).toHaveAttribute('aria-checked', 'false')

    // Disponibilidade 2 na edição 1/10 => o seletor para em 2.
    await mock(page).setAvailability('sage-nomad-009', '1-10', 2)
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    await expect(page.getByTestId('availability')).toContainText('2 de 10 disponíveis')
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' }).first()
    await increase.click()
    await expect(increase).toBeDisabled()

    // Já existindo 2 no carrinho, o limite restante é zero.
    await addToCartViaApi(page, [{ nftId: 'sage-nomad-009', editionId: '1-10', quantity: 2 }])
    await page.reload()
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    await expect(page.getByTestId('availability')).toContainText('máximo permitido')
    await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
  })

  test('edição que esgota em tempo real é desmarcada e informada', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'true')
    await mock(page).setAvailability('emerald-ape-042', '1-50', 0)
    await expect(page.getByRole('radio', { name: /Edição 1\/50, esgotada/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('radio', { name: /Edição 1\/50/ })).toHaveAttribute('aria-checked', 'false')
  })
})
