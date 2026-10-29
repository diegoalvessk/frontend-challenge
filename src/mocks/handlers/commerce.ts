import { HttpResponse, delay, http } from 'msw'
import {
  collectorSchema,
  fieldErrors,
  type AddCartItemRequest,
  type ApplyCouponRequest,
  type CreateOrderRequest,
  type EditionId,
  type Network,
  type Order,
  type QuoteRequest,
  type QuoteStaleDetails,
  type UpdateCartItemRequest,
  type WalletConnection,
} from '@/contracts'
import { commit, db, findNft, randomId, sha256, type OrderRecord } from '../db'
import {
  buildQuote,
  computeCart,
  diffQuote,
  findCoupon,
  getCartRecord,
  isCouponExpired,
  scheduleSettlement,
  toPublicOrder,
  updateNftMarket,
} from '../domain'
import { API, cartOwner, fail, handle, readJson, requireUser } from '../http'
import { getScenario } from '../scenarios'

const NETWORK_IDS: Network[] = ['ethereum', 'polygon', 'solana']

function networkParam(request: Request): Network {
  const value = new URL(request.url).searchParams.get('network') as Network | null
  return value && NETWORK_IDS.includes(value) ? value : 'ethereum'
}

function cartResponse(ownerKey: string, request: Request, status = 200) {
  return HttpResponse.json(computeCart(ownerKey, networkParam(request)), { status })
}

/** Valida quantidade contra disponibilidade da edição e limite por pedido. */
function assertQuantity(nftId: string, editionId: EditionId, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    fail(422, 'VALIDATION_ERROR', 'A quantidade deve ser um número inteiro maior que zero.', { fields: { quantity: 'Quantidade inválida.' } })
  }
  const nft = findNft(nftId)
  if (!nft) fail(404, 'NOT_FOUND', 'NFT não encontrado.')
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) fail(404, 'NOT_FOUND', 'Edição não encontrada.')
  if (edition.available === 0) fail(409, 'EDITION_UNAVAILABLE', `A edição ${edition.label} está esgotada.`)
  const max = Math.min(edition.available, nft.maxPerOrder)
  if (quantity > max) {
    fail(409, 'QUANTITY_LIMIT', `Você pode adquirir no máximo ${max} unidade(s) desta edição.`, { details: { max } })
  }
  return { nft, edition }
}

/** Dispara a mudança de preço do cenário "price-change" uma vez por ativação. */
let priceChangeFired = false
export function resetCommerceScenarioFlags() {
  priceChangeFired = false
}

export const commerceHandlers = [
  http.get(
    `${API}/cart`,
    handle(({ request }) => cartResponse(cartOwner(request).key, request)),
  ),

  http.post(
    `${API}/cart/items`,
    handle(async ({ request }) => {
      const owner = cartOwner(request)
      const body = await readJson<AddCartItemRequest>(request)
      const cart = getCartRecord(owner.key)
      const existing = cart.lines.find((l) => l.nftId === body.nftId && l.editionId === body.editionId)
      const { edition } = assertQuantity(body.nftId, body.editionId, (existing?.quantity ?? 0) + body.quantity)
      if (existing) {
        existing.quantity += body.quantity
        existing.acknowledgedPriceEth = edition.priceEth
      } else {
        cart.lines.push({ nftId: body.nftId, editionId: body.editionId, quantity: body.quantity, acknowledgedPriceEth: edition.priceEth })
      }
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request, 201)
    }),
  ),

  http.patch<{ nftId: string; editionId: string }>(
    `${API}/cart/items/:nftId/:editionId`,
    handle(async ({ request, params }) => {
      const owner = cartOwner(request)
      const { quantity } = await readJson<UpdateCartItemRequest>(request)
      const cart = getCartRecord(owner.key)
      const line = cart.lines.find((l) => l.nftId === params.nftId && l.editionId === params.editionId)
      if (!line) fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
      assertQuantity(line.nftId, line.editionId, quantity)
      line.quantity = quantity
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request)
    }),
  ),

  http.delete<{ nftId: string; editionId: string }>(
    `${API}/cart/items/:nftId/:editionId`,
    handle(({ request, params }) => {
      const owner = cartOwner(request)
      const cart = getCartRecord(owner.key)
      cart.lines = cart.lines.filter((l) => !(l.nftId === params.nftId && l.editionId === params.editionId))
      if (cart.lines.length === 0) cart.couponCode = null
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request)
    }),
  ),

  /** O usuário aceita os novos preços/disponibilidades sinalizados no carrinho. */
  http.post(
    `${API}/cart/acknowledge`,
    handle(({ request }) => {
      const owner = cartOwner(request)
      const cart = getCartRecord(owner.key)
      cart.lines = cart.lines.flatMap((line) => {
        const edition = findNft(line.nftId)?.editions.find((e) => e.id === line.editionId)
        if (!edition || edition.available === 0) return []
        return [{ ...line, quantity: Math.min(line.quantity, edition.available), acknowledgedPriceEth: edition.priceEth }]
      })
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request)
    }),
  ),

  http.post(
    `${API}/cart/coupon`,
    handle(async ({ request }) => {
      const owner = cartOwner(request)
      const { code = '' } = await readJson<Partial<ApplyCouponRequest>>(request)
      if (!code.trim()) fail(422, 'VALIDATION_ERROR', 'Informe o código promocional.', { fields: { code: 'Informe o código.' } })
      const coupon = findCoupon(code)
      if (!coupon) fail(422, 'COUPON_INVALID', 'Código promocional inválido.', { fields: { code: 'Código inválido.' } })
      if (isCouponExpired(coupon)) fail(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', { fields: { code: 'Código expirado.' } })
      const cart = getCartRecord(owner.key)
      cart.couponCode = coupon.code
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request)
    }),
  ),

  http.delete(
    `${API}/cart/coupon`,
    handle(({ request }) => {
      const owner = cartOwner(request)
      const cart = getCartRecord(owner.key)
      cart.couponCode = null
      cart.updatedAt = new Date().toISOString()
      commit()
      return cartResponse(owner.key, request)
    }),
  ),

  /** Ao autenticar, incorpora os itens do carrinho de visitante ao do usuário. */
  http.post(
    `${API}/cart/merge`,
    handle(({ request }) => {
      const user = requireUser(request)
      const guestId = request.headers.get('x-guest-cart-id')
      const userKey = `user:${user.id}`
      const guestKey = guestId ? `guest:${guestId}` : null
      const guest = guestKey ? db().carts[guestKey] : undefined
      if (guest && guestKey) {
        const target = getCartRecord(userKey)
        for (const line of guest.lines) {
          const nft = findNft(line.nftId)
          const edition = nft?.editions.find((e) => e.id === line.editionId)
          if (!nft || !edition || edition.available === 0) continue
          const max = Math.min(edition.available, nft.maxPerOrder)
          const existing = target.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
          if (existing) existing.quantity = Math.min(max, existing.quantity + line.quantity)
          else target.lines.push({ ...line, quantity: Math.min(max, line.quantity) })
        }
        target.couponCode ??= guest.couponCode
        target.updatedAt = new Date().toISOString()
        delete db().carts[guestKey]
        commit()
      }
      return cartResponse(userKey, request)
    }),
  ),

  http.post(
    `${API}/checkout/quote`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const { network = 'ethereum' } = await readJson<Partial<QuoteRequest>>(request)
      const ownerKey = `user:${user.id}`
      const cart = computeCart(ownerKey, NETWORK_IDS.includes(network) ? network : 'ethereum')
      if (cart.lines.length === 0) fail(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
      if (cart.lines.some((l) => l.issues.length > 0)) {
        fail(409, 'AVAILABILITY_CONFLICT', 'Há itens com preço ou disponibilidade alterados. Revise o carrinho.')
      }
      const quote = buildQuote(cart)
      db().quotes[quote.id] = { ownerKey, userId: user.id, quote }
      commit()

      const scenario = getScenario()
      if (scenario.priceChangeAfterQuoteMs && !priceChangeFired) {
        priceChangeFired = true
        const target = quote.lines[0]
        setTimeout(() => updateNftMarket(target.nftId, { priceFactor: 1.1 }), scenario.priceChangeAfterQuoteMs)
      }
      return HttpResponse.json(quote, { status: 201 })
    }),
  ),

  http.post(
    `${API}/wallets/connect`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const { walletId, network } = await readJson<{ walletId: string; network: Network }>(request)
      const wallets = db().wallets[user.id]
      const wallet = [wallets?.primary, wallets?.secondary].find((w) => w?.id === walletId)
      if (!wallet) fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
      // Simula o tempo de aprovação na extensão da carteira.
      await delay(600)
      if (getScenario().walletReject) {
        db().walletConnections[user.id] = null
        commit()
        fail(422, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      }
      const connection: WalletConnection = { walletId, network, status: 'connected', connectedAt: new Date().toISOString() }
      db().walletConnections[user.id] = connection
      commit()
      return HttpResponse.json(connection)
    }),
  ),

  http.delete(
    `${API}/wallets/connection`,
    handle(({ request }) => {
      const user = requireUser(request)
      db().walletConnections[user.id] = null
      commit()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(
    `${API}/orders`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) fail(400, 'VALIDATION_ERROR', 'Header Idempotency-Key ausente ou inválido.')
      const raw = await request.text()
      const body = JSON.parse(raw || '{}') as CreateOrderRequest
      const bodyHash = await sha256(raw)
      const scope = `${user.id}:${key}`
      const scenario = getScenario()

      // Mesma chave: mesma tentativa -> mesmo pedido; conteúdo diferente -> conflito.
      const previous = db().idempotency[scope]
      if (previous) {
        if (previous.bodyHash !== bodyHash) {
          fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        return HttpResponse.json<Order>(toPublicOrder(db().orders[previous.orderId]), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }

      const parsed = collectorSchema.safeParse(body.collector)
      if (!parsed.success) {
        fail(422, 'VALIDATION_ERROR', 'Revise os dados do colecionador.', { fields: fieldErrors(parsed.error) })
      }

      const record = db().quotes[body.quoteId]
      if (!record || record.userId !== user.id) fail(404, 'NOT_FOUND', 'Cotação não encontrada.')

      const wallets = db().wallets[user.id]
      const wallet = [wallets?.primary, wallets?.secondary].find((w) => w?.id === body.walletId)
      if (!wallet) fail(422, 'VALIDATION_ERROR', 'Selecione uma carteira cadastrada.', { fields: { walletId: 'Carteira inválida.' } })
      const connection = db().walletConnections[user.id]
      if (!connection || connection.walletId !== wallet.id) {
        fail(409, 'WALLET_REJECTED', 'Conecte a carteira selecionada antes de confirmar a compra.')
      }

      if (scenario.soldOutOnOrder) {
        const first = record.quote.lines[0]
        updateNftMarket(first.nftId, { editionId: first.editionId, available: 0 })
      }

      // Revalida preço, disponibilidade, cupom e taxa contra a cotação aceita.
      const current = computeCart(record.ownerKey, record.quote.summary.network)
      const changes = diffQuote(record.quote, current)
      const expired = new Date(record.quote.expiresAt).getTime() < Date.now()
      if (changes.length > 0 || expired) {
        const quote = buildQuote(current)
        db().quotes[quote.id] = { ownerKey: record.ownerKey, userId: user.id, quote }
        commit()
        const details: QuoteStaleDetails = { quote, changes }
        fail(409, 'QUOTE_STALE', expired ? 'A cotação expirou. Revise os valores atualizados.' : 'Os valores mudaram desde a revisão. Confirme novamente.', { details })
      }

      const now = Date.now()
      const order: OrderRecord = {
        id: randomId('ord'),
        status: 'pending',
        version: 1,
        idempotencyKey: key,
        quoteId: record.quote.id,
        lines: record.quote.lines,
        coupon: record.quote.coupon,
        summary: record.quote.summary,
        wallet: {
          id: wallet.id,
          provider: wallet.provider,
          address: wallet.address,
          label: wallet.provider === 'metamask' ? 'MetaMask' : wallet.provider === 'coinbase' ? 'Coinbase Wallet' : 'WalletConnect',
        },
        transactionHash: null,
        explorerUrl: null,
        declineReason: null,
        createdAt: new Date(now).toISOString(),
        settledAt: null,
        userId: user.id,
        settleAt: new Date(now + scenario.settleDelayMs).toISOString(),
        bodyHash,
      }
      db().orders[order.id] = order
      db().idempotency[scope] = { orderId: order.id, bodyHash }
      // A cotação é consumida: não pode originar outro pedido.
      delete db().quotes[record.quote.id]
      commit({ kind: 'order', order })
      scheduleSettlement(order)

      if (scenario.orderResponseDelayMs && !db().delayedOrderKeys.includes(scope)) {
        db().delayedOrderKeys.push(scope)
        commit()
        await delay(scenario.orderResponseDelayMs)
      }

      return HttpResponse.json<Order>(toPublicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders`,
    handle(({ request }) => {
      const user = requireUser(request)
      const status = new URL(request.url).searchParams.get('status')
      const orders = Object.values(db().orders)
        .filter((o) => o.userId === user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toPublicOrder)
      return HttpResponse.json<Order[]>(orders)
    }),
  ),

  http.get<{ id: string }>(
    `${API}/orders/:id`,
    handle(({ request, params }) => {
      const user = requireUser(request)
      const order = db().orders[params.id]
      if (!order) fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== user.id) fail(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
      return HttpResponse.json<Order>(toPublicOrder(order))
    }),
  ),
]
