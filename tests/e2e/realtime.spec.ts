import type { Page } from '@playwright/test'
import { addToCartViaApi, expect, mock, signIn, test } from './support'

async function openCheckoutWith(page: Page, nftId = 'emerald-ape-042') {
  await signIn(page)
  await addToCartViaApi(page, [{ nftId, editionId: '1-50', quantity: 1 }])
  await page.goto('/pagamento')
  await expect(page.getByTestId('quote-lines')).toBeVisible()
}

test.describe('Tempo real (Socket.IO)', () => {
  test('preço alterado durante o checkout bloqueia a cotação desatualizada e exige nova confirmação', async ({ page }) => {
    await openCheckoutWith(page)
    await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH')

    // 1-2) O NFT do carrinho muda de preço enquanto o usuário navega.
    await mock(page).changePrice('emerald-ape-042', 1.1)
    // 3) A interface informa a alteração.
    await expect(page.getByTestId('quote-stale')).toContainText('Emerald Ape #042: preço de 1.19 ETH para 1.31 ETH')
    // 4) O checkout impede confirmar com a cotação desatualizada.
    await expect(page.getByTestId('review-order')).toBeDisabled()

    await page.getByRole('button', { name: 'Revisar novos valores' }).click()
    await expect(page.getByTestId('quote-stale')).toBeHidden()
    await expect(page.getByTestId('summary-total')).toHaveText('1.326 ETH')
    await page.getByTestId('review-order').click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.326 ETH')
  })

  test('servidor rejeita cotação desatualizada (edição esgota na confirmação)', async ({ page }) => {
    await openCheckoutWith(page)
    await mock(page).setScenario('sold-out')
    await page.getByTestId('review-order').click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('quote-stale')).toContainText('Emerald Ape #042: edição esgotada')
    await expect(page.getByTestId('review-order')).toBeDisabled()
    expect(await mock(page).orders()).toHaveLength(0)
  })

  test('eventos duplicados ou antigos não regridem o estado nem reaplicam efeitos', async ({ page }) => {
    await signIn(page, undefined, '/nft/emerald-ape-042')
    await expect(page.getByTestId('detail-price')).toHaveText('1.19 ETH')
    await mock(page).changePrice('emerald-ape-042', 2)
    await expect(page.getByTestId('detail-price')).toHaveText('2.38 ETH')
    const notices = page.getByText('Atualização em tempo real: Emerald Ape #042 agora custa 2.38 ETH.')
    await expect(notices).toHaveCount(1)

    const event = await mock(page).currentNftEvent('emerald-ape-042')
    // Duplicata (mesmo eventId) e evento antigo (versão menor, preço anterior).
    await mock(page).emit(event)
    await mock(page).emit({
      ...event,
      eventId: 'nft:emerald-ape-042:v1-replay',
      version: 1,
      data: { ...(event.data as object), priceEth: '1.19', editions: [] },
    } as typeof event)
    await page.waitForTimeout(500)
    await expect(page.getByTestId('detail-price')).toHaveText('2.38 ETH')
    await expect(notices).toHaveCount(1)
  })

  test('eventos de pedido de outro usuário não são entregues nem aplicados', async ({ page }) => {
    await signIn(page)
    const clients = await mock(page).socketClients()
    expect(clients.every((c) => c.userId === 'usr_ana')).toBe(true)
    // Evento forjado para o Bruno: o servidor filtra e o cliente confere o userId.
    await mock(page).emit({
      eventId: 'order:ord_x:v2',
      type: 'order.updated',
      resource: { type: 'order', id: 'ord_x' },
      version: 2,
      occurredAt: new Date().toISOString(),
      data: { userId: 'usr_bruno', status: 'confirmed', transactionHash: '0x1', explorerUrl: null, declineReason: null },
    })
    await expect(page.getByTestId('live-region')).not.toContainText('Pagamento')
  })

  test('queda de conexão com pedido pendente: retomada sem criar outra compra', async ({ page }) => {
    await openCheckoutWith(page)
    await page.getByTestId('review-order').click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()

    // Conexão cai antes da confirmação; o pedido é liquidado no servidor.
    await mock(page).dropSocket(true)
    await expect(page.getByTestId('connection-banner')).toBeVisible()
    await mock(page).settlePendingOrders()

    // Recarregar recupera o estado pela API REST.
    await page.reload()
    await expect(page).toHaveURL(orderUrl)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await mock(page).restoreSocket()
    await expect(page.getByTestId('connection-banner')).toBeHidden({ timeout: 15_000 })

    const orders = await mock(page).orders()
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('confirmed')
  })

  test('reconexão reconcilia mudanças perdidas com a API REST', async ({ page }) => {
    await signIn(page, undefined, '/nft/ivory-baron-088')
    await expect(page.getByTestId('detail-price')).toHaveText('1.79 ETH')
    await mock(page).dropSocket(true)
    await expect(page.getByTestId('connection-banner')).toBeVisible()
    // Mudança acontece sem nenhum cliente conectado (evento perdido).
    await mock(page).changePrice('ivory-baron-088', 1.5)
    await page.waitForTimeout(300)
    await expect(page.getByTestId('detail-price')).toHaveText('1.79 ETH')
    await mock(page).restoreSocket()
    await expect(page.getByTestId('detail-price')).toHaveText('2.69 ETH', { timeout: 15_000 })
  })
})
