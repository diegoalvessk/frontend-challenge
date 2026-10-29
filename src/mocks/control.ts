import type { EditionId, RealtimeEvent } from '@/contracts'
import { commit, db, findNft, resetDb } from './db'
import { resumePendingOrders, settleOrder, updateNftMarket } from './domain'
import { resetCommerceScenarioFlags } from './handlers/commerce'
import { resetReadAttempts } from './http'
import { connectedClients, dropConnections, nftUpdatedEvent, publish, restoreConnections } from './realtime'
import { SCENARIOS, getScenario, setScenario, type ScenarioId } from './scenarios'

/** Prefixo das chaves de armazenamento da aplicação (sessão, carrinho de visitante...). */
export const APP_STORAGE_PREFIX = 'kurio.app.'

/**
 * Superfície de controle da API simulada, usada pelo painel de mocks e pelos
 * testes Playwright. Ela altera o *estado do servidor simulado*; a interface
 * só percebe as mudanças pelas respostas REST e pelos eventos Socket.IO.
 */
export const mockControl = {
  scenarios: Object.values(SCENARIOS).map(({ id, label, description }) => ({ id, label, description })),

  getScenario: () => getScenario().id,

  setScenario(id: ScenarioId) {
    setScenario(id)
    resetReadAttempts()
    resetCommerceScenarioFlags()
    if (!getScenario().offline) restoreConnections()
  },

  /** Restaura o seed, limpa o armazenamento da aplicação e volta ao cenário padrão. */
  async reset({ scenario = 'default' as ScenarioId } = {}) {
    await resetDb()
    resetReadAttempts()
    resetCommerceScenarioFlags()
    resumePendingOrders()
    restoreConnections()
    setScenario(scenario)
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(APP_STORAGE_PREFIX)) localStorage.removeItem(key)
      }
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  },

  /** Multiplica o preço de todas as edições de um NFT (emite nft.updated). */
  changePrice(nftId: string, factor: number) {
    return updateNftMarket(nftId, { priceFactor: factor })?.version ?? null
  },

  /** Define a disponibilidade de uma edição (emite nft.updated). */
  setAvailability(nftId: string, editionId: EditionId, available: number) {
    return updateNftMarket(nftId, { editionId, available })?.version ?? null
  },

  /** Monta o evento `nft.updated` do estado atual (útil para reenviar duplicatas). */
  currentNftEvent(nftId: string) {
    const nft = findNft(nftId)
    return nft ? nftUpdatedEvent(nft) : null
  },

  /** Publica um evento arbitrário pelo socket (duplicatas, eventos antigos...). */
  emit(event: RealtimeEvent) {
    publish(event)
  },

  dropSocket(options?: { block?: boolean }) {
    dropConnections(options)
  },

  restoreSocket() {
    restoreConnections()
  },

  socketClients: connectedClients,

  /** Expira todas as sessões ativas (a próxima requisição recebe 401 SESSION_EXPIRED). */
  expireSessions() {
    for (const session of Object.values(db().sessions)) {
      session.expiresAt = new Date(Date.now() - 1000).toISOString()
    }
    commit()
  },

  /** Liquida imediatamente os pedidos pendentes. */
  settlePendingOrders() {
    for (const order of Object.values(db().orders)) {
      if (order.status === 'pending') settleOrder(order.id)
    }
  },

  pendingOrderIds: () => Object.values(db().orders).filter((o) => o.status === 'pending').map((o) => o.id),

  /** Pedidos registrados no servidor simulado (para verificar ausência de duplicidade). */
  orders: () => Object.values(db().orders).map(({ id, status, userId, idempotencyKey }) => ({ id, status, userId, idempotencyKey })),

  nft: (id: string) => findNft(id) ?? null,
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __KURIO_MOCK__?: MockControl
  }
}
