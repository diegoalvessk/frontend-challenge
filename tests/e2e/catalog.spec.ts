import type { NftSummary } from '../../src/contracts/catalog'
import type { Paginated } from '../../src/contracts/common'
import { expect, open, test } from './support'

const cards = (page: import('@playwright/test').Page) => page.getByTestId('catalog-grid').locator('> li')

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação e paginação compõem a URL e sobrevivem ao refresh e ao histórico', async ({ page }) => {
    await open(page, '/')
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByRole('link', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')

    // Paginação
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro reinicia a paginação; filtros são combináveis
    const filters = page.getByRole('complementary', { name: 'Filtros do catálogo' })
    await filters.getByRole('button', { name: /^Música/ }).click()
    await expect(page).toHaveURL(/cat=musica/)
    await expect(page).not.toHaveURL(/page=/)
    await filters.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(page).toHaveURL(/cat=musica.*net=ethereum|net=ethereum.*cat=musica/)
    await expect(filters.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')

    // Ordenação por menor preço
    await page.getByLabel('Ordenar por:').selectOption('preco-asc')
    await expect(page).toHaveURL(/sort=preco-asc/)
    // Aguarda a resposta da nova consulta (o grid mantém os dados anteriores enquanto atualiza).
    await expect
      .poll(async () => {
        const values = (await cards(page).locator('p').filter({ hasText: 'ETH' }).allInnerTexts()).map((p) => Number.parseFloat(p))
        return values.length > 0 && values.every((v, i) => i === 0 || values[i - 1] <= v)
      })
      .toBe(true)

    // Refresh mantém o estado
    const url = page.url()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(filters.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('preco-asc')

    // Histórico: voltar desfaz a ordenação, avançar refaz
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await expect(page.getByLabel('Ordenar por:')).toHaveValue('recentes')
    await page.goForward()
    await expect(page).toHaveURL(/sort=preco-asc/)
  })

  test('busca por texto reflete os parâmetros enviados à API e trata resultado vazio', async ({ page }) => {
    await open(page, '/')
    const response = page.waitForResponse((r) => r.url().includes('/api/nfts?') && r.url().includes('q=golden'))
    await page.getByRole('button', { name: 'Buscar NFTs' }).first().click()
    await page.getByLabel('Termo de busca').fill('golden')
    await page.getByLabel('Termo de busca').press('Enter')
    const { items } = (await (await response).json()) as Paginated<NftSummary>
    await expect(page).toHaveURL(/q=golden/)
    // A busca cobre nome, coleção e criador: "Amber Pulse" entra por pertencer à coleção Golden Frequencies.
    expect(items.length).toBeGreaterThan(0)
    for (const nft of items) expect(`${nft.name} ${nft.collection}`.toLowerCase()).toContain('golden')
    // O grid exibe exatamente a resposta (mantém os dados anteriores enquanto atualiza).
    await expect(cards(page).getByRole('heading')).toHaveText(items.map((nft) => nft.name))

    await page.goto('/?q=nao-existe-nenhum')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('link', { name: 'Limpar filtros' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a consulta atual', async ({ page }) => {
    // Latência derivada da URL: requisições anteriores podem chegar depois.
    await open(page, '/', 'variable-latency')
    await expect(cards(page).first()).toBeVisible({ timeout: 15_000 })
    const filters = page.getByRole('complementary', { name: 'Filtros do catálogo' })
    await filters.getByRole('button', { name: /^Fotografia/ }).click()
    await filters.getByRole('button', { name: /^Jogos/ }).click()
    await filters.getByRole('button', { name: /^Polygon/ }).click()
    await expect(page).toHaveURL(/net=polygon/)
    await expect(page.getByTestId('catalog-grid')).not.toHaveAttribute('aria-busy', 'true', { timeout: 15_000 })
    // O resultado exibido corresponde aos parâmetros finais (consultado direto na API).
    const expected = await page.evaluate(() =>
      fetch('/api/nfts?categories=fotografia,jogos&networks=polygon&sort=recentes&page=1&pageSize=9').then((r) => r.json()),
    )
    await expect(cards(page)).toHaveCount(Math.max(expected.items.length, 0))
    const names = await cards(page).getByRole('heading').allInnerTexts()
    expect(names).toEqual(expected.items.map((i: { name: string }) => i.name))
  })

  test('catálogo no mobile: busca com debounce e filtros em drawer @mobile', async ({ page, isMobileProject }) => {
    test.skip(!isMobileProject, 'layout mobile')
    await open(page, '/')
    await page.getByLabel('Explorar coleções').fill('nomad')
    await expect(page).toHaveURL(/q=nomad/)
    await page.getByRole('button', { name: 'Abrir filtros' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: /^Solana/ }).click()
    await expect(page).toHaveURL(/net=solana/)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
  })
})
