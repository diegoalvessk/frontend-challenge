import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/contracts'
import { db, subscribe, type OrderRecord } from './db'
import { getScenario } from './scenarios'
import type { NftDetail } from '@/contracts'

/**
 * Servidor Socket.IO simulado. O `socket.io-client` da aplicação abre um
 * WebSocket real (transport "websocket"); o MSW intercepta a conexão e o
 * `@mswjs/socket.io-binding` codifica/decodifica o protocolo Engine.IO/Socket.IO.
 */

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

/** O servidor precisa enviar ping ("2") antes de pingInterval + pingTimeout (25 s + 5 s). */
const PING_INTERVAL_MS = 20_000

// O MSW remove o prefixo "/socket.io/" da URL do cliente antes de comparar.
const realtime = ws.link(`${SOCKET_URL}/*`)

type Connection = Parameters<Parameters<typeof realtime.addEventListener<'connection'>>[1]>[0]

interface ClientState {
  id: number
  userId: string | null
  io: ReturnType<typeof toSocketIo>
  connection: Connection
}

const clients = new Set<ClientState>()
let nextClientId = 0
/** Quando verdadeiro, novas conexões são recusadas (simula queda do servidor). */
let blocked = false

function userFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = db().sessions[token]
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null
  return session.userId
}

export function nftUpdatedEvent(nft: NftDetail): NftUpdatedEvent {
  return {
    // Identidade estável: o mesmo recurso/versão sempre gera o mesmo eventId.
    eventId: `nft:${nft.id}:v${nft.version}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      priceEth: nft.priceEth,
      previousPriceEth: nft.previousPriceEth,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, available: e.available, priceEth: e.priceEth })),
    },
  }
}

export function orderUpdatedEvent(order: OrderRecord): OrderUpdatedEvent {
  return {
    eventId: `order:${order.id}:v${order.version}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    data: {
      userId: order.userId,
      status: order.status,
      transactionHash: order.transactionHash,
      explorerUrl: order.explorerUrl,
      declineReason: order.declineReason,
    },
  }
}

/**
 * O MSW não emite "close" quando o cliente fecha o socket ainda conectando
 * (ex.: efeito desmontado pelo StrictMode). Conexões já fechadas são descartadas.
 */
function pruneClosed() {
  for (const client of clients) {
    // O tipo público do MSW não expõe `socket`, mas a conexão concreta o possui.
    const socket = (client.connection.client as unknown as { socket?: WebSocket }).socket
    if (socket && socket.readyState >= WebSocket.CLOSING) clients.delete(client)
  }
}

/** Publica um evento: `nft.updated` para todos; `order.updated` só para o dono. */
export function publish(event: RealtimeEvent) {
  pruneClosed()
  for (const client of clients) {
    if (event.type === 'order.updated' && client.userId !== event.data.userId) continue
    client.io.client.emit(event.type, event)
  }
}

/** Derruba as conexões abertas. Com `block`, recusa reconexões até `restoreConnections()`. */
export function dropConnections({ block = false } = {}) {
  blocked = block
  for (const client of [...clients]) client.connection.client.close()
}

export function restoreConnections() {
  blocked = false
}

export function connectedClients() {
  pruneClosed()
  return [...clients].map((c) => ({ id: c.id, userId: c.userId }))
}

subscribe((change) => {
  if (change.kind === 'nft') publish(nftUpdatedEvent(change.nft))
  if (change.kind === 'order') publish(orderUpdatedEvent(change.order))
})

export const realtimeHandler = realtime.addEventListener('connection', (connection) => {
  if (blocked || getScenario().offline) {
    connection.client.close()
    return
  }

  const state: ClientState = { id: ++nextClientId, userId: null, io: toSocketIo(connection), connection }
  clients.add(state)

  // O pacote CONNECT do Socket.IO ("40{...}") carrega o `auth` do cliente.
  connection.client.addEventListener('message', (event) => {
    if (typeof event.data === 'string' && event.data.startsWith('40')) {
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string }
        state.userId = userFromToken(auth.token)
      } catch {
        state.userId = null
      }
    }
  })

  const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)
  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    clients.delete(state)
  })
})
