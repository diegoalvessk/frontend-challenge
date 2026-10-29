import { USERS, expect, mock, open, signIn, test } from './support'

test.describe('Favoritos', () => {
  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await open(page, '/nft/golden-signal-160')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fgolden-signal-160/)
  })

  test('favorito persiste para o usuário autenticado (atualização otimista) @mobile', async ({ page, isMobileProject }) => {
    await signIn(page, USERS.ana, '/nft/golden-signal-160')
    const toggle = isMobileProject
      ? page.getByRole('button', { name: 'Favoritar Golden Signal #160' }).first()
      : page.getByRole('button', { name: 'Favoritar', exact: true })
    await toggle.click()
    await expect(page.getByRole('button', { name: /Remover Golden Signal #160 dos favoritos|Favoritado/ }).first()).toBeVisible()
    // A interface muda na hora (otimista); aguarda a confirmação da API antes de recarregar.
    await expect(page.getByTestId('live-region')).toContainText('Golden Signal #160 adicionado aos favoritos.')
    await page.reload()
    await expect(page.getByRole('button', { name: /Remover Golden Signal #160 dos favoritos|Favoritado/ }).first()).toBeVisible()
    await page.goto('/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Golden Signal #160' })).toBeVisible()
  })

  test('falha na mutation desfaz a atualização otimista e permite recuperar', async ({ page }) => {
    await signIn(page, USERS.ana, '/nft/golden-signal-160')
    await mock(page).setScenario('favorites-fail')
    const favorite = page.getByRole('button', { name: 'Favoritar', exact: true })
    await favorite.click()
    // Rollback: volta ao estado anterior e informa o erro.
    await expect(page.getByText(/Não foi possível favoritar Golden Signal #160/).first()).toBeVisible()
    await expect(favorite).toHaveAttribute('aria-pressed', 'false')

    // Recuperação: com a API normalizada, a mesma ação funciona.
    await mock(page).setScenario('default')
    await favorite.click()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('live-region')).toContainText('Golden Signal #160 adicionado aos favoritos.')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toBeVisible()
  })
})
