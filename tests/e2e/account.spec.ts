import { USERS, expect, signIn, test } from './support'

import path from 'node:path'

const AVATAR = path.join(import.meta.dirname, 'fixtures', 'avatar.png')

test.describe('Perfil do colecionador', () => {
  test('edita dados com validação, conflito da API e persistência após refresh @mobile', async ({ page }) => {
    await signIn(page, USERS.ana, '/perfil')
    const displayName = page.getByLabel('Nome de exibição')
    await expect(displayName).toHaveValue(USERS.ana.name)

    await displayName.fill('')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Informe o nome de exibição.')).toBeVisible()

    // Conflito: nome de usuário de outra conta
    await displayName.fill('Ana K.')
    await page.getByLabel('Nome de usuário').fill('bruno.holder')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('ana.k')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana K.')
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.k')
  })

  test('altera e remove o avatar, rejeitando formato inválido', async ({ page }) => {
    await signIn(page, USERS.ana, '/perfil')
    const input = page.locator('#avatar-input')
    await input.setInputFiles({ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(page.getByText('Use uma imagem PNG, JPEG ou WebP.')).toBeVisible()

    await input.setInputFiles(AVATAR)
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-image')).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByTestId('avatar-image')).toHaveCount(0)
  })

  test('altera a senha com validação e erro de senha atual', async ({ page }) => {
    await signIn(page, USERS.ana, '/perfil')
    const form = page.getByRole('form', { name: 'Alterar senha' })
    await form.getByLabel('Senha atual').fill('errada000')
    await form.getByLabel('Nova senha', { exact: true }).fill('curta')
    await form.getByLabel('Confirmar nova senha').fill('diferente')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(form.getByText('A senha precisa ter ao menos 8 caracteres.')).toBeVisible()
    await expect(form.getByText('As senhas não conferem.')).toBeVisible()

    await form.getByLabel('Nova senha', { exact: true }).fill('NovaSenha9')
    await form.getByLabel('Confirmar nova senha').fill('NovaSenha9')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(form.getByText('Senha atual incorreta.')).toBeVisible()

    await form.getByLabel('Senha atual').fill(USERS.ana.password)
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.').first()).toBeVisible()

    // A nova senha passa a valer no login.
    await page.getByRole('button', { name: /Conta de/ }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await page.goto('/entrar')
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha').fill('NovaSenha9')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('button', { name: /Conta de/ })).toBeVisible()
  })
})

test.describe('Carteiras', () => {
  test('cadastra carteira principal e secundária com validação', async ({ page }) => {
    // Bruno não possui carteiras no seed.
    await signIn(page, USERS.bruno, '/perfil/carteiras')
    const primary = page.getByTestId('wallet-primary')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Informe o nome de exibição.')).toBeVisible()
    await expect(primary.getByText('Informe um endereço 0x com 40 caracteres hexadecimais.')).toBeVisible()

    await primary.getByLabel('Nome de exibição').fill('Bruno Holder')
    await primary.getByLabel('Apelido da carteira').fill('Principal')
    await primary.getByLabel('Rede').selectOption('polygon')
    await primary.getByLabel('Nome do perfil').fill('bruno')
    await primary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await primary.getByLabel('Tipo de carteira').selectOption('coinbase')
    await primary.getByLabel('Código de indicação').fill('KURIO-BRUNO')
    await primary.getByLabel('E-mail').fill('bruno@kurio.dev')
    await primary.getByLabel('Nome ENS (sem .eth)').fill('brunoholder')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('Polygon')

    // Secundária copiando a principal e alterando o endereço
    await page.getByLabel('Igual à carteira principal').check()
    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByTestId('wallet-secondary')
    await expect(secondary.getByLabel('Nome do perfil')).toHaveValue('bruno')
    await secondary.getByLabel('Endereço da carteira').fill('0x2222222222222222222222222222222222222222')
    await secondary.getByLabel('ENS ou carteira secundária (opcional)').fill('invalido')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Informe um ENS (nome.eth) ou endereço 0x válido.')).toBeVisible()
    await secondary.getByLabel('ENS ou carteira secundária (opcional)').fill('reserva.eth')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('wallet-summary-secondary')).toContainText('0x2222222222222222222222222222222222222222')

    await page.reload()
    await expect(page.getByTestId('wallet-summary-primary')).toContainText('0x1111111111111111111111111111111111111111')
    await expect(page.getByTestId('wallet-summary-secondary')).toBeVisible()
  })
})
