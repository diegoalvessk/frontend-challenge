import { USERS, expect, loginViaUi, mock, open, signIn, test } from './support'

test.describe('Conta e sessão', () => {
  test('cadastro valida campos, trata conflito e autentica @mobile', async ({ page, isMobileProject }) => {
    await open(page, '/cadastro')
    const dialog = page.getByRole('dialog')
    // O Figma mobile chama o botão de "Criar perfil"; o desktop, de "Criar conta".
    const submit = dialog.getByRole('button', { name: isMobileProject ? 'Criar perfil' : 'Criar conta' })
    await submit.click()
    await expect(dialog.getByText('Use ao menos 3 caracteres.')).toBeVisible()
    await expect(dialog.getByText('Informe o e-mail.')).toBeVisible()

    // Conflito retornado pela API (e-mail do seed)
    await dialog.getByPlaceholder('Nome de usuário').fill('novo.colecionador')
    await dialog.getByPlaceholder('Digite seu e-mail').fill(USERS.ana.email)
    await dialog.getByPlaceholder('Senha', { exact: true }).fill('Segura123')
    await dialog.getByPlaceholder('Confirmar senha').fill('Segura123')
    await submit.click()
    await expect(dialog.getByText('Este e-mail já está cadastrado.')).toBeVisible()
    await expect(dialog.getByPlaceholder('Digite seu e-mail')).toHaveAttribute('aria-invalid', 'true')

    await dialog.getByPlaceholder('Digite seu e-mail').fill('novo@kurio.dev')
    await submit.click()
    await expect(page).toHaveURL(/\/perfil/)
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('novo.colecionador')
  })

  test('login inválido mostra erro e login válido retorna ao fluxo anterior', async ({ page }) => {
    await open(page, '/carrinho')
    await page.goto('/entrar?redirect=%2Fcarrinho')
    await loginViaUi(page, { email: USERS.ana.email, password: 'errada123' })
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await loginViaUi(page, USERS.ana)
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(page.getByRole('button', { name: `Conta de ${USERS.ana.name}` })).toBeVisible()
  })

  test('rota privada redireciona ao login e retoma o destino', async ({ page }) => {
    await open(page, '/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
    await expect(page.getByText('Entre na sua conta para acessar esta página.')).toBeVisible()
    await loginViaUi(page, USERS.ana)
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('sessão é recuperada após refresh', async ({ page }) => {
    await signIn(page)
    await page.reload()
    await expect(page.getByRole('button', { name: `Conta de ${USERS.ana.name}` })).toBeVisible()
  })

  test('expiração durante a navegação leva ao login preservando o contexto', async ({ page }) => {
    await signIn(page, USERS.ana, '/perfil')
    await mock(page).expireSessions()
    // A próxima requisição autenticada recebe 401 SESSION_EXPIRED.
    await page.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras.*motivo=expirada/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.').first()).toBeVisible()
    await loginViaUi(page, USERS.ana)
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
  })

  test('expiração por tempo (relógio controlado) é detectada', async ({ page }) => {
    await page.clock.install()
    await open(page, '/entrar?redirect=%2Fperfil', 'session-short')
    await loginViaUi(page, USERS.ana)
    await expect(page).toHaveURL(/\/perfil$/)
    // A sessão do cenário dura 45 s; o app revalida a cada 60 s.
    await page.clock.fastForward('01:05')
    await expect(page).toHaveURL(/motivo=expirada/, { timeout: 15_000 })
  })

  test('logout e troca de usuário limpam dados privados da sessão anterior', async ({ page }) => {
    await signIn(page, USERS.ana, '/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').locator('> li')).toHaveCount(2)
    expect((await mock(page).socketClients()).some((c) => c.userId === 'usr_ana')).toBe(true)

    await page.getByRole('button', { name: `Conta de ${USERS.ana.name}` }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    // O socket autenticado da Ana foi encerrado.
    await expect.poll(async () => (await mock(page).socketClients()).some((c) => c.userId === 'usr_ana')).toBe(false)

    await page.goto('/entrar?redirect=%2Fperfil%2Ffavoritos')
    await loginViaUi(page, USERS.bruno)
    await expect(page).toHaveURL(/\/perfil\/favoritos$/)
    await expect(page.getByText('Você ainda não favoritou nenhum NFT.')).toBeVisible()
    await expect(page.getByLabel('Nome de exibição')).toHaveCount(0)
    await page.getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue(USERS.bruno.name)
  })
})
