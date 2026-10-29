import type { Page } from '@playwright/test'
import { USERS, addToCartViaApi, expect, mock, open, signIn, test } from './support'

async function reachReview(page: Page) {
  await expect(page.getByTestId('quote-lines')).toBeVisible()
  await page.getByTestId('review-order').click()
  await expect(page.getByTestId('review-dialog')).toBeVisible()
}

test.describe('Compra', () => {
  test('compra completa: do catálogo ao recibo confirmado @mobile', async ({ page, isMobileProject }) => {
    await open(page, '/')
    await page.getByRole('link', { name: 'Golden Beat #207', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
    await page.getByRole('button', { name: isMobileProject ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)

    await reachReview(page)
    await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // A confirmação só aparece quando o servidor simulado confirma (order.updated).
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH')
    await expect(page.getByRole('link', { name: 'Ver no Etherscan' })).toBeVisible()

    // O recibo é um snapshot: mudar o catálogo depois não altera os valores.
    await mock(page).changePrice('golden-beat-207', 2)
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH')

    // O item comprado saiu do carrinho.
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('após confirmar, remove do carrinho apenas os itens e quantidades comprados', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [
      { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 },
      { nftId: 'golden-signal-160', editionId: '1-50', quantity: 1 },
    ])
    await page.goto('/pagamento')
    await reachReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // Enquanto o pedido está pendente, o carrinho recebe mais itens (ex.: outra aba).
    await addToCartViaApi(page, [
      { nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 },
      { nftId: 'violet-nomad-314', editionId: '1-50', quantity: 1 },
    ])
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
    await page.goto('/carrinho')
    const lines = page.getByTestId('cart-line')
    await expect(lines).toHaveCount(2)
    await expect(lines.filter({ hasText: 'Emerald Ape #042' }).getByLabel('Quantidade: 1')).toBeVisible()
    await expect(lines.filter({ hasText: 'Violet Nomad #314' })).toBeVisible()
    await expect(lines.filter({ hasText: 'Golden Signal #160' })).toHaveCount(0)
  })

  test('valida os campos do colecionador antes da revisão', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }])
    await page.goto('/pagamento')
    await expect(page.getByTestId('quote-lines')).toBeVisible()
    await page.getByLabel('Endereço da carteira').fill('0x123')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('invalido')
    await page.getByTestId('review-order').click()
    await expect(page.getByText('Informe um endereço 0x com 40 caracteres hexadecimais.')).toBeVisible()
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
    await expect(page.getByLabel('Endereço da carteira')).toBeFocused()
    await expect(page.getByTestId('review-dialog')).toBeHidden()
  })

  test('carteira que recusa a conexão impede a revisão; desconexão volta ao estado inicial', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }])
    await page.goto('/pagamento')
    await mock(page).setScenario('wallet-reject')
    await page.getByTestId('review-order').click()
    await expect(page.getByTestId('wallet-connection')).toHaveText(/Conexão recusada/)
    await expect(page.getByTestId('review-dialog')).toBeHidden()

    await mock(page).setScenario('default')
    await page.getByTestId('wallet-connection').getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira conectada/)
    await page.getByTestId('wallet-connection').getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByTestId('wallet-connection')).toHaveText(/Carteira desconectada/)
  })
})

test.describe('Falhas de pagamento', () => {
  test('pagamento recusado preserva os itens do carrinho', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 2 }])
    await mock(page).setScenario('payment-declined')
    await page.goto('/pagamento')
    await reachReview(page)
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-line').getByLabel('Quantidade: 2')).toBeVisible()
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await signIn(page)
    await addToCartViaApi(page, [{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }])
    await page.goto('/pagamento')
    await reachReview(page)
    const confirm = page.getByTestId('confirm-order')
    await confirm.evaluate((button: HTMLButtonElement) => {
      for (let i = 0; i < 5; i++) button.click()
    })
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    expect(await mock(page).orders()).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o MESMO pedido pela chave de idempotência', async ({ page }) => {
    test.setTimeout(60_000)
    await signIn(page)
    await addToCartViaApi(page, [{ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }])
    await mock(page).setScenario('order-timeout')
    await page.goto('/pagamento')
    await reachReview(page)
    const posts: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/orders')) posts.push(r.headers()['idempotency-key'])
    })
    const aborted = page.waitForEvent('requestfailed', (r) => r.url().endsWith('/api/orders'), { timeout: 15_000 })
    await page.getByTestId('confirm-order').click()
    // 1ª tentativa: o pedido é criado, mas a resposta excede o timeout do cliente (8 s).
    await aborted
    await expect(page).toHaveURL(/\/pedidos\/ord_/, { timeout: 20_000 })
    expect(posts.length).toBeGreaterThanOrEqual(2)
    expect(new Set(posts).size).toBe(1)
    const orders = await mock(page).orders()
    expect(orders).toHaveLength(1)
    expect(page.url()).toContain(orders[0].id)
  })

  test('mesma chave com conteúdo diferente gera conflito de idempotência', async ({ page }) => {
    await signIn(page)
    const statuses = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('kurio.app.session')!)
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${s.token}`, 'idempotency-key': 'idem_teste_conflito' }
      await fetch('/api/cart/items', { method: 'POST', headers, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: '1-50', quantity: 1 }) })
      await fetch('/api/wallets/connect', { method: 'POST', headers, body: JSON.stringify({ walletId: 'wal_ana_primary', network: 'ethereum' }) })
      const quote = await fetch('/api/checkout/quote', { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum' }) }).then((r) => r.json())
      const collector = { displayName: 'Ana', username: 'ana.kurio', profileName: 'ana', network: 'ethereum', walletAddress: '0xA91F3c2B7d4E5f60718293aB4c5D6e7F8091E82C', altAddress: '', walletProvider: 'metamask', referralCode: 'KURIO-ANA', email: 'ana@kurio.dev', ensName: 'anakurio', note: '' }
      const first = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: quote.id, walletId: 'wal_ana_primary', collector }) })
      const replay = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: quote.id, walletId: 'wal_ana_primary', collector }) })
      const conflict = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: quote.id, walletId: 'wal_ana_primary', collector: { ...collector, note: 'outro' } }) })
      return [first.status, replay.status, replay.headers.get('idempotent-replayed'), conflict.status, (await conflict.json()).error.code]
    })
    expect(statuses).toEqual([201, 200, 'true', 409, 'IDEMPOTENCY_CONFLICT'])
  })
})
