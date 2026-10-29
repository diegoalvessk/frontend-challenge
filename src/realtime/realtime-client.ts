import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import type {
  CatalogResponse,
  ClientToServerEvents,
  FeaturedResponse,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  ServerToClientEvents,
} from '@/contracts'
import { queryKeys } from '@/api/query-client'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'
export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>

type Listener<T> = (payload: T) => void

/**
 * Barramento interno: componentes reagem a eventos já validados
 * (deduplicados, ordenados e do usuário correto) sem tocar no socket.
 */
class RealtimeBus {
  private nft = new Set<Listener<NftUpdatedEvent>>()
  private order = new Set<Listener<OrderUpdatedEvent>>()
  private status = new Set<Listener<ConnectionStatus>>()
  current: ConnectionStatus = 'connecting'

  onNft(l: Listener<NftUpdatedEvent>) {
    this.nft.add(l)
    return () => void this.nft.delete(l)
  }
  onOrder(l: Listener<OrderUpdatedEvent>) {
    this.order.add(l)
    return () => void this.order.delete(l)
  }
  onStatus(l: Listener<ConnectionStatus>) {
    this.status.add(l)
    return () => void this.status.delete(l)
  }
  emitNft(e: NftUpdatedEvent) {
    for (const l of this.nft) l(e)
  }
  emitOrder(e: OrderUpdatedEvent) {
    for (const l of this.order) l(e)
  }
  setStatus(s: ConnectionStatus) {
    this.current = s
    for (const l of this.status) l(s)
  }
}

export const realtimeBus = new RealtimeBus()

/**
 * Guarda as identidades já processadas e a maior versão vista por recurso.
 * - mesmo `eventId` => duplicata, ignorada;
 * - versão <= última aplicada => evento antigo, ignorado (sem regressão).
 */
export class EventLedger {
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private readonly capacity = 1000

  accept(event: { eventId: string; resource: { type: string; id: string }; version: number }) {
    if (this.seen.has(event.eventId)) return false
    const key = `${event.resource.type}:${event.resource.id}`
    const last = this.versions.get(key) ?? 0
    if (event.version <= last) return false
    this.seen.add(event.eventId)
    if (this.seen.size > this.capacity) this.seen.delete(this.seen.values().next().value!)
    this.versions.set(key, event.version)
    return true
  }

  /** Registra a versão conhecida via REST (para descartar eventos anteriores a ela). */
  observe(type: string, id: string, version: number) {
    const key = `${type}:${id}`
    if ((this.versions.get(key) ?? 0) < version) this.versions.set(key, version)
  }
}

function patchSummary<T extends NftSummary>(item: T, event: NftUpdatedEvent): T {
  if (item.id !== event.resource.id || item.version >= event.version) return item
  return {
    ...item,
    priceEth: event.data.priceEth,
    previousPriceEth: event.data.previousPriceEth,
    soldOut: event.data.soldOut,
    version: event.version,
  }
}

/** Aplica `nft.updated` em catálogo, destaques, relacionados e detalhe. */
export function applyNftEvent(queryClient: QueryClient, event: NftUpdatedEvent) {
  const id = event.resource.id
  queryClient.setQueryData<NftDetail>(queryKeys.nft(id), (detail) => {
    if (!detail || detail.version >= event.version) return detail
    return {
      ...patchSummary(detail, event),
      editions: detail.editions.map((edition) => {
        const next = event.data.editions.find((e) => e.id === edition.id)
        return next ? { ...edition, available: next.available, priceEth: next.priceEth } : edition
      }),
    }
  })
  queryClient.setQueriesData<CatalogResponse>({ queryKey: ['catalog', 'list'] }, (data) =>
    data ? { ...data, items: data.items.map((item) => patchSummary(item, event)) } : data,
  )
  queryClient.setQueryData<FeaturedResponse>(queryKeys.featured, (data) =>
    data ? { hero: data.hero.map((i) => patchSummary(i, event)), spotlight: patchSummary(data.spotlight, event) } : data,
  )
  queryClient.setQueriesData<NftSummary[]>({ queryKey: ['nft'], predicate: (q) => q.queryKey[2] === 'related' }, (data) =>
    Array.isArray(data) ? data.map((i) => patchSummary(i, event)) : data,
  )
  // O carrinho é recalculado pelo servidor (preço vigente, avisos e resumo).
  void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
}

export function applyOrderEvent(queryClient: QueryClient, userId: string, event: OrderUpdatedEvent) {
  queryClient.setQueryData<Order>(queryKeys.order(userId, event.resource.id), (order) => {
    if (!order || order.version >= event.version) return order
    return {
      ...order,
      status: event.data.status,
      version: event.version,
      transactionHash: event.data.transactionHash,
      declineReason: event.data.declineReason,
    }
  })
  // Garante o snapshot completo do recibo (explorer, datas) direto da API.
  void queryClient.invalidateQueries({ queryKey: queryKeys.order(userId, event.resource.id) })
  if (event.data.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
  }
}

export function createSocket(token: string | null): RealtimeSocket {
  return io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5_000,
    timeout: 8_000,
  })
}
