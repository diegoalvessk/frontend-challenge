import Decimal from 'decimal.js'
import type { Cart, CartLine, Network, Order, Quote, QuoteStaleDetails } from '@/contracts'
import { eth } from '@/lib/money'
import { COUPON_FIXTURES, NETWORK_FEES } from './fixtures'
import { commit, db, findNft, randomId, touchNft, type CartRecord, type DbChange, type OrderRecord } from './db'
import { getScenario } from './scenarios'

const QUOTE_TTL_MS = 10 * 60_000

export function getCartRecord(ownerKey: string): CartRecord {
  const carts = db().carts
  carts[ownerKey] ??= { id: randomId('cart'), lines: [], couponCode: null, updatedAt: new Date().toISOString() }
  return carts[ownerKey]
}

export function findCoupon(code: string) {
  return COUPON_FIXTURES.find((c) => c.code === code.trim().toUpperCase())
}

export function isCouponExpired(coupon: { expiresAt: string }) {
  return new Date(coupon.expiresAt).getTime() < Date.now()
}

/** Projeta o carrinho persistido com preços/disponibilidade atuais do catálogo. */
export function computeCart(ownerKey: string, network: Network = 'ethereum'): Cart {
  const record = getCartRecord(ownerKey)
  const lines: CartLine[] = []
  for (const line of record.lines) {
    const nft = findNft(line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    const issues: CartLine['issues'] = []
    if (!eth.eq(edition.priceEth, line.acknowledgedPriceEth)) issues.push('price-changed')
    if (edition.available === 0) issues.push('unavailable')
    else if (line.quantity > edition.available) issues.push('quantity-reduced')
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      editionLabel: edition.label,
      name: nft.name,
      tokenId: nft.tokenId,
      artwork: nft.artwork,
      quantity: line.quantity,
      unitPriceEth: edition.priceEth,
      lineTotalEth: eth.mul(edition.priceEth, line.quantity),
      available: edition.available,
      maxPerOrder: nft.maxPerOrder,
      acknowledgedPriceEth: line.acknowledgedPriceEth,
      issues,
      nftVersion: nft.version,
    })
  }

  const subtotal = eth.add('0', ...lines.map((l) => l.lineTotalEth))
  const coupon = record.couponCode ? findCoupon(record.couponCode) : undefined
  const validCoupon = coupon && !isCouponExpired(coupon) ? coupon : undefined
  const discount = validCoupon ? eth.percent(subtotal, validCoupon.percent) : '0'
  const fee = lines.length > 0 ? NETWORK_FEES[network] : '0'

  return {
    id: record.id,
    lines,
    coupon: validCoupon ? { code: validCoupon.code, description: validCoupon.description } : null,
    summary: {
      subtotalEth: subtotal,
      discountEth: discount,
      networkFeeEth: fee,
      totalEth: eth.add(eth.sub(subtotal, discount), fee),
      network,
    },
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    updatedAt: record.updatedAt,
  }
}

export function buildQuote(cart: Cart): Quote {
  const now = Date.now()
  return {
    id: randomId('qt'),
    lines: cart.lines.map(({ nftId, editionId, editionLabel, name, tokenId, artwork, quantity, unitPriceEth, lineTotalEth }) => ({
      nftId,
      editionId,
      editionLabel,
      name,
      tokenId,
      artwork,
      quantity,
      unitPriceEth,
      lineTotalEth,
    })),
    coupon: cart.coupon,
    summary: cart.summary,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
}

/** Compara a cotação com o estado atual: preço, disponibilidade, cupom e taxa. */
export function diffQuote(quote: Quote, current: Cart): QuoteStaleDetails['changes'] {
  const changes: QuoteStaleDetails['changes'] = []
  for (const line of quote.lines) {
    const now = current.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    if (!now) {
      changes.push({ nftId: line.nftId, editionId: line.editionId, name: line.name, kind: 'availability', before: String(line.quantity), after: '0' })
      continue
    }
    if (!eth.eq(now.unitPriceEth, line.unitPriceEth)) {
      changes.push({ nftId: line.nftId, editionId: line.editionId, name: line.name, kind: 'price', before: line.unitPriceEth, after: now.unitPriceEth })
    }
    if (now.available < line.quantity || now.quantity !== line.quantity) {
      changes.push({
        nftId: line.nftId,
        editionId: line.editionId,
        name: line.name,
        kind: 'availability',
        before: String(line.quantity),
        after: String(Math.min(now.available, now.quantity)),
      })
    }
  }
  if (current.lines.length !== quote.lines.length) {
    for (const extra of current.lines.filter((l) => !quote.lines.some((q) => q.nftId === l.nftId && q.editionId === l.editionId))) {
      changes.push({ nftId: extra.nftId, editionId: extra.editionId, name: extra.name, kind: 'availability', before: '0', after: String(extra.quantity) })
    }
  }
  if ((quote.coupon?.code ?? null) !== (current.coupon?.code ?? null)) {
    changes.push({ nftId: '', editionId: '1-50', name: 'Cupom', kind: 'coupon', before: quote.coupon?.code ?? '—', after: current.coupon?.code ?? '—' })
  }
  if (!eth.eq(quote.summary.networkFeeEth, current.summary.networkFeeEth)) {
    changes.push({ nftId: '', editionId: '1-50', name: 'Taxa de rede', kind: 'fee', before: quote.summary.networkFeeEth, after: current.summary.networkFeeEth })
  }
  return changes
}

/** Altera preço/disponibilidade de um NFT e publica `nft.updated`. */
export function updateNftMarket(
  nftId: string,
  patch: { priceFactor?: number; editionId?: string; available?: number },
) {
  const nft = findNft(nftId)
  if (!nft) return null
  if (patch.priceFactor) {
    nft.previousPriceEth = nft.priceEth
    for (const edition of nft.editions) {
      edition.priceEth = new Decimal(edition.priceEth).times(patch.priceFactor).toDecimalPlaces(2).toFixed()
    }
  }
  if (patch.available !== undefined) {
    for (const edition of nft.editions) {
      if (!patch.editionId || edition.id === patch.editionId) edition.available = Math.max(0, patch.available)
    }
  }
  touchNft(nft)
  commit({ kind: 'nft', nft })
  return nft
}

const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Liquida um pedido pendente: confirma (baixando estoque e removendo do
 * carrinho apenas o que foi comprado) ou recusa (preservando o carrinho).
 */
export function settleOrder(orderId: string) {
  settleTimers.delete(orderId)
  const order = db().orders[orderId]
  if (!order || order.status !== 'pending') return

  const changes: DbChange[] = []
  const now = new Date().toISOString()
  const scenario = getScenario()

  const shortage = order.lines.find((line) => {
    const edition = findNft(line.nftId)?.editions.find((e) => e.id === line.editionId)
    return !edition || edition.available < line.quantity
  })

  if (scenario.paymentDeclined || shortage) {
    order.status = 'declined'
    order.declineReason = shortage
      ? `A edição ${shortage.editionLabel} de ${shortage.name} esgotou antes da confirmação.`
      : 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.'
  } else {
    order.status = 'confirmed'
    order.transactionHash = `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')}`
    order.explorerUrl = `/explorador/tx/${order.transactionHash}`

    for (const line of order.lines) {
      const nft = findNft(line.nftId)!
      const edition = nft.editions.find((e) => e.id === line.editionId)!
      if (edition.supply !== null) edition.available -= line.quantity
      touchNft(nft)
      changes.push({ kind: 'nft', nft })
    }

    const cart = getCartRecord(`user:${order.userId}`)
    cart.lines = cart.lines
      .map((cartLine) => {
        const bought = order.lines.find((l) => l.nftId === cartLine.nftId && l.editionId === cartLine.editionId)
        return bought ? { ...cartLine, quantity: cartLine.quantity - bought.quantity } : cartLine
      })
      .filter((cartLine) => cartLine.quantity > 0)
    if (cart.lines.length === 0) cart.couponCode = null
    cart.updatedAt = now
  }

  order.settledAt = now
  order.version += 1
  changes.push({ kind: 'order', order })
  commit(...changes)
}

export function scheduleSettlement(order: OrderRecord) {
  if (order.status !== 'pending' || settleTimers.has(order.id)) return
  const wait = Math.max(0, new Date(order.settleAt).getTime() - Date.now())
  settleTimers.set(order.id, setTimeout(() => settleOrder(order.id), wait))
}

/** Retoma a liquidação de pedidos pendentes após recarregar a página. */
export function resumePendingOrders() {
  for (const timer of settleTimers.values()) clearTimeout(timer)
  settleTimers.clear()
  for (const order of Object.values(db().orders)) scheduleSettlement(order)
}

/** Remove os campos internos do registro antes de responder ao cliente. */
export function toPublicOrder(record: OrderRecord): Order {
  const { userId: _userId, settleAt: _settleAt, bodyHash: _bodyHash, ...order } = record
  return order
}
