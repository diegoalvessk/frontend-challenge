import AxeBuilder from '@axe-core/playwright'
import { expect, mock, open, signIn, test } from './support'

test.describe('Acessibilidade', () => {
  for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
    test(`sem violações graves do axe em ${path}`, async ({ page }) => {
      await open(page, path)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    })
  }

  test('navegação por teclado com foco visível e link para pular conteúdo', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow)
    expect(outline).not.toBe('nonenone')
  })

  test('diálogo prende o foco, fecha com Esc e devolve o foco ao gatilho', async ({ page }) => {
    await open(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' }).first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('erros de formulário são associados aos campos', async ({ page }) => {
    await open(page, '/entrar')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy}`)).toHaveText('Informe o e-mail.')
  })

  test('mutations são anunciadas na região live', async ({ page }) => {
    await signIn(page, undefined, '/nft/golden-signal-160')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByTestId('live-region')).toContainText('Golden Signal #160 adicionado aos favoritos.')
  })
})

test.describe('Carregamento e falhas', () => {
  test('skeletons com shimmer durante carregamento lento @mobile', async ({ page }) => {
    await open(page, '/', 'slow')
    await expect(page.getByTestId('catalog-skeleton')).toBeVisible()
    await expect(page.getByTestId('catalog-skeleton').locator('.shimmer').first()).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-skeleton')).toBeVisible()
  })

  test('falha HTTP 5xx mostra feedback e recupera após nova tentativa', async ({ page }) => {
    await open(page, '/', 'server-error')
    const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(error).toBeVisible({ timeout: 15_000 })
    // O servidor se recupera; a nova tentativa do usuário carrega o catálogo.
    await mock(page).setScenario('default')
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('falha transitória é recuperada pelo retry automático', async ({ page }) => {
    await open(page, '/', 'flaky')
    await expect(page.getByTestId('catalog-grid').locator('> li')).toHaveCount(9, { timeout: 15_000 })
  })

  test('sem conexão: feedback de erro e indicador de tempo real', async ({ page }) => {
    await open(page, '/', 'offline')
    await expect(page.getByRole('alert').filter({ hasText: 'Sem conexão com o servidor' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('connection-banner')).toBeVisible()
  })

  test('respeita preferência por movimento reduzido no shimmer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/', 'slow')
    const animation = await page
      .getByTestId('catalog-skeleton')
      .locator('.shimmer')
      .first()
      .evaluate((el) => getComputedStyle(el, '::after').animationName)
    expect(animation).toBe('none')
  })
})
