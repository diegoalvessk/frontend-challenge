import { test as base, expect, type Page } from '@playwright/test'
import type { EditionId, RealtimeEvent } from '../../src/contracts'
import type { ScenarioId } from '../../src/mocks/scenarios'

/** Credenciais fictícias do seed (documentadas no README). */
export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@2026', name: 'Ana Colecionadora' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Holder' },
} as const

/**
 * Acesso à superfície de controle da API simulada. Os testes alteram o
 * estado do *servidor simulado*; a interface só percebe as mudanças pelas
 * respostas REST (handlers MSW) e pelos eventos do socket.io-client.
 */
export function mock(page: Page) {
  const call = async <T>(fn: string, ...args: unknown[]) => {
    await waitForApp(page)
    return page.evaluate(([name, params]) => {
      const control = window.__KURIO_MOCK__ as unknown as Record<string, (...a: unknown[]) => unknown>
      return control[name as string](...(params as unknown[]))
    }, [fn, args] as const) as Promise<T>
  }

  return {
    setScenario: (id: ScenarioId) => call<void>('setScenario', id),
    changePrice: (nftId: string, factor: number) => call<number>('changePrice', nftId, factor),
    setAvailability: (nftId: string, editionId: EditionId, available: number) => call<number>('setAvailability', nftId, editionId, available),
    currentNftEvent: (nftId: string) => call<RealtimeEvent>('currentNftEvent', nftId),
    emit: (event: RealtimeEvent) => call<void>('emit', event),
    dropSocket: (block = true) => call<void>('dropSocket', { block }),
    restoreSocket: () => call<void>('restoreSocket'),
    socketClients: () => call<Array<{ id: number; userId: string | null }>>('socketClients'),
    expireSessions: () => call<void>('expireSessions'),
    settlePendingOrders: () => call<void>('settlePendingOrders'),
    orders: () => call<Array<{ id: string; status: string; userId: string; idempotencyKey: string }>>('orders'),
    nft: (id: string) => call<{ priceEth: string; editions: Array<{ id: string; available: number; priceEth: string }> }>('nft', id),
  }
}

export async function waitForApp(page: Page) {
  // Mocks prontos e aplicação renderizada.
  await page.waitForFunction(() => !!window.__KURIO_MOCK__ && !!document.getElementById('conteudo'))
}

/** Abre a aplicação já com um cenário de mocks selecionado (antes do primeiro request). */
export async function open(page: Page, path: string, scenario: ScenarioId = 'default') {
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('e2e.scenario-set')) {
      localStorage.setItem('kurio.mock.scenario', id)
      sessionStorage.setItem('e2e.scenario-set', '1')
    }
  }, scenario)
  await page.goto(path)
  await waitForApp(page)
}

export async function loginViaUi(page: Page, user: { email: string; password: string }) {
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.getByPlaceholder('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Login rápido pela tela de login (usado como pré-condição de outros fluxos). */
export async function signIn(page: Page, user: { email: string; password: string } = USERS.ana, redirect = '/') {
  await open(page, `/entrar?redirect=${encodeURIComponent(redirect)}`)
  await loginViaUi(page, user)
  await page.waitForURL((url) => url.pathname === redirect.split('?')[0])
}

/** Adiciona itens ao carrinho pela API (como o botão da interface faria). */
export async function addToCartViaApi(page: Page, items: Array<{ nftId: string; editionId: EditionId; quantity: number }>) {
  await waitForApp(page)
  // O id do carrinho de visitante nasce na primeira requisição da aplicação.
  await page.waitForFunction(() => !!localStorage.getItem('kurio.app.session') || !!localStorage.getItem('kurio.app.guest-cart-id'))
  await page.evaluate(async (list) => {
    const session = JSON.parse(localStorage.getItem('kurio.app.session') ?? 'null')
    const guest = JSON.parse(localStorage.getItem('kurio.app.guest-cart-id') ?? 'null')
    for (const item of list) {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(session ? { authorization: `Bearer ${session.token}` } : {}),
          ...(guest ? { 'x-guest-cart-id': guest } : {}),
        },
        body: JSON.stringify(item),
      })
      if (!res.ok) throw new Error(`add to cart failed: ${res.status}`)
    }
  }, items)
}

export const test = base.extend<{ isMobileProject: boolean }>({
  // A API de fixtures do Playwright exige o padrão de desestruturação (vazio aqui).
  // oxlint-disable-next-line no-empty-pattern
  isMobileProject: async ({}, use, info) => {
    await use(info.project.name === 'mobile')
  },
})

export { expect }
