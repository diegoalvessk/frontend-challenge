import type { ArtworkId, EditionId } from './catalog'
import type { EthAmount, IsoDateTime, Network, WalletProvider } from './common'

export interface CartLine {
  nftId: string
  editionId: EditionId
  editionLabel: string
  name: string
  tokenId: string
  artwork: ArtworkId
  quantity: number
  /** Preço unitário vigente no catálogo. */
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
  /** Unidades disponíveis da edição neste momento. */
  available: number
  maxPerOrder: number
  /** Preço quando o item foi adicionado/confirmado pela última vez pelo usuário. */
  acknowledgedPriceEth: EthAmount
  /** Sinaliza mudanças desde a última confirmação do usuário. */
  issues: Array<'price-changed' | 'quantity-reduced' | 'unavailable'>
  nftVersion: number
}

export interface CartSummary {
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
  network: Network
}

export interface AppliedCoupon {
  code: string
  description: string
}

export interface Cart {
  id: string
  lines: CartLine[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  itemCount: number
  updatedAt: IsoDateTime
}

export interface AddCartItemRequest {
  nftId: string
  editionId: EditionId
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export interface QuoteRequest {
  network: Network
}

/** Cotação congelada para o checkout: é a referência para criar o pedido. */
export interface Quote {
  id: string
  lines: Array<Pick<CartLine, 'nftId' | 'editionId' | 'editionLabel' | 'name' | 'tokenId' | 'artwork' | 'quantity' | 'unitPriceEth' | 'lineTotalEth'>>
  coupon: AppliedCoupon | null
  summary: CartSummary
  createdAt: IsoDateTime
  expiresAt: IsoDateTime
}

export interface CollectorDetails {
  displayName: string
  username: string
  profileName: string
  network: Network
  walletAddress: string
  altAddress: string
  walletProvider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  walletId: string
  collector: CollectorDetails
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

/** Snapshot imutável do pedido: o recibo nunca é recalculado a partir do catálogo. */
export interface Order {
  id: string
  status: OrderStatus
  /** Incrementada a cada transição; eventos com versão menor são ignorados. */
  version: number
  idempotencyKey: string
  quoteId: string
  lines: Quote['lines']
  coupon: AppliedCoupon | null
  summary: CartSummary
  wallet: { id: string; provider: WalletProvider; address: string; label: string }
  transactionHash: string | null
  explorerUrl: string | null
  declineReason: string | null
  createdAt: IsoDateTime
  settledAt: IsoDateTime | null
}

/** Detalhes do erro QUOTE_STALE: o que mudou desde a cotação. */
export interface QuoteStaleDetails {
  quote: Quote
  changes: Array<{
    nftId: string
    editionId: EditionId
    name: string
    kind: 'price' | 'availability' | 'coupon' | 'fee'
    before: string
    after: string
  }>
}
