/**
 * Contratos compartilhados entre a camada de transporte (Axios), os mocks (MSW)
 * e a interface. Valores em ETH sempre trafegam como strings decimais.
 */

/** Valor decimal em ETH serializado como string, ex.: "1.19". */
export type EthAmount = string

/** Data/hora ISO-8601. */
export type IsoDateTime = string

export type Network = 'ethereum' | 'polygon' | 'solana'

export const NETWORKS: ReadonlyArray<{ id: Network; label: string }> = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'

export const WALLET_PROVIDERS: ReadonlyArray<{ id: WalletProvider; label: string }> = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
]

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AVAILABILITY_CONFLICT'
  | 'EDITION_UNAVAILABLE'
  | 'QUANTITY_LIMIT'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'QUOTE_STALE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'WALLET_REJECTED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

/** Corpo padrão de toda resposta de erro da API. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo, usados nos formulários (chave = nome do campo). */
    fields?: Record<string, string>
    details?: unknown
  }
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
