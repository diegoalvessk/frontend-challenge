import type { EditionId } from './catalog'
import type { EthAmount, IsoDateTime } from './common'
import type { OrderStatus } from './commerce'

/**
 * Envelope de todos os eventos Socket.IO.
 * - `eventId`: identidade estável (deduplicação).
 * - `resource`: recurso afetado.
 * - `version`: versão do recurso após a mudança (eventos antigos são descartados).
 */
export interface RealtimeEnvelope<TType extends string, TResource extends string, TData> {
  eventId: string
  type: TType
  resource: { type: TResource; id: string }
  version: number
  occurredAt: IsoDateTime
  data: TData
}

export type NftUpdatedEvent = RealtimeEnvelope<
  'nft.updated',
  'nft',
  {
    priceEth: EthAmount
    previousPriceEth: EthAmount | null
    soldOut: boolean
    editions: Array<{ id: EditionId; available: number; priceEth: EthAmount }>
  }
>

export type OrderUpdatedEvent = RealtimeEnvelope<
  'order.updated',
  'order',
  {
    userId: string
    status: OrderStatus
    transactionHash: string | null
    explorerUrl: string | null
    declineReason: string | null
  }
>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

/** Mapa de eventos servidor -> cliente, usado para tipar o socket.io-client. */
export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

/** Eventos cliente -> servidor. */
export interface ClientToServerEvents {
  'order.watch': (orderId: string) => void
}

export interface SocketAuth {
  token: string | null
}
