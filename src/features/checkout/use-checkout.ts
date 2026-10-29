import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, isApiError } from '@/api/client'
import { cartApi, checkoutApi, ordersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import type { CreateOrderRequest, Network, Order, Quote, QuoteStaleDetails } from '@/contracts'
import { announce } from '@/lib/announcer'
import { eth, formatEth } from '@/lib/money'
import { realtimeBus } from '@/realtime/realtime-client'
import { attemptStore } from './attempt-store'

export type QuoteChange = QuoteStaleDetails['changes'][number]

export function describeChange(change: QuoteChange) {
  switch (change.kind) {
    case 'price':
      return `${change.name}: preço de ${formatEth(change.before)} para ${formatEth(change.after)}`
    case 'availability':
      return change.after === '0' ? `${change.name}: edição esgotada` : `${change.name}: disponibilidade alterada (${change.before} → ${change.after})`
    case 'coupon':
      return `Cupom: ${change.before} → ${change.after}`
    case 'fee':
      return `Taxa de rede: ${formatEth(change.before)} → ${formatEth(change.after)}`
  }
}

/**
 * Cotação do checkout. É a referência para confirmar a compra: qualquer
 * mudança de preço/disponibilidade (via Socket.IO ou 409 do servidor)
 * marca a cotação como desatualizada e exige nova confirmação.
 */
export function useQuote(network: Network, enabled: boolean) {
  const queryClient = useQueryClient()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [changes, setChanges] = useState<QuoteChange[]>([])
  const [expired, setExpired] = useState(false)
  const quoteRef = useRef<Quote | null>(null)

  useEffect(() => {
    quoteRef.current = quote
    if (!quote) return
    // A cotação tem validade: ao expirar, exige nova revisão.
    const timer = setTimeout(() => setExpired(true), Math.max(0, new Date(quote.expiresAt).getTime() - Date.now()))
    return () => clearTimeout(timer)
  }, [quote])

  const create = useMutation({
    mutationFn: (net: Network) => checkoutApi.quote(net),
    onSuccess: (data) => {
      setQuote(data)
      setChanges([])
      setExpired(false)
    },
  })

  const { mutate } = create
  useEffect(() => {
    if (enabled) mutate(network)
  }, [enabled, network, mutate])

  // Eventos em tempo real: compara com a cotação vigente.
  useEffect(
    () =>
      realtimeBus.onNft((event) => {
        const current = quoteRef.current
        if (!current) return
        const found: QuoteChange[] = []
        for (const line of current.lines.filter((l) => l.nftId === event.resource.id)) {
          const edition = event.data.editions.find((e) => e.id === line.editionId)
          if (!edition) continue
          if (!eth.eq(edition.priceEth, line.unitPriceEth)) {
            found.push({ nftId: line.nftId, editionId: line.editionId, name: line.name, kind: 'price', before: line.unitPriceEth, after: edition.priceEth })
          }
          if (edition.available < line.quantity) {
            found.push({ nftId: line.nftId, editionId: line.editionId, name: line.name, kind: 'availability', before: String(line.quantity), after: String(edition.available) })
          }
        }
        if (found.length > 0) {
          setChanges((prev) => [...prev.filter((p) => p.nftId !== event.resource.id), ...found])
          announce(`Os valores da compra mudaram: ${found.map(describeChange).join('; ')}. Revise antes de confirmar.`)
        }
      }),
    [],
  )

  /** Aceita os novos valores: atualiza o carrinho e gera uma cotação nova. */
  const refresh = useCallback(async () => {
    const cart = await cartApi.acknowledge()
    void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
    if (cart.lines.length === 0) {
      setQuote(null)
      return
    }
    mutate(network)
  }, [mutate, network, queryClient])

  const markStale = useCallback((details: QuoteStaleDetails) => {
    setChanges(details.changes)
    if (details.changes.length === 0) setExpired(true)
  }, [])

  return {
    quote,
    changes,
    stale: changes.length > 0 || expired,
    loading: create.isPending,
    error: create.error,
    retry: () => mutate(network),
    refresh,
    markStale,
  }
}

const RETRYABLE: Array<ApiError['code']> = ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR']
const MAX_AUTO_RETRIES = 3

/**
 * Envio do pedido com idempotência:
 * - cliques repetidos são ignorados enquanto há envio em andamento;
 * - timeout/queda: reenvia automaticamente com a MESMA chave (até 3x);
 * - 409 QUOTE_STALE: devolve os detalhes para nova confirmação.
 */
export function usePlaceOrder(userId: string) {
  const inFlight = useRef(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'recovering' | 'failed'>('idle')

  const place = useCallback(
    async (body: CreateOrderRequest): Promise<{ order?: Order; error?: ApiError }> => {
      if (inFlight.current) return {}
      inFlight.current = true
      const attempt = attemptStore.begin(userId, body)
      setStatus('sending')
      try {
        for (let tryNumber = 0; ; tryNumber++) {
          try {
            const order = await ordersApi.create(attempt.body, attempt.idempotencyKey)
            attemptStore.setOrder(userId, order.id)
            setStatus('idle')
            return { order }
          } catch (error) {
            const apiError = error instanceof ApiError ? error : new ApiError({ status: 0, code: 'UNKNOWN', message: 'Erro inesperado.' })
            if (RETRYABLE.includes(apiError.code) && tryNumber < MAX_AUTO_RETRIES) {
              setStatus('recovering')
              announce('O servidor demorou a responder. Verificando seu pedido sem criar uma nova compra…')
              await new Promise((r) => setTimeout(r, 800 * 2 ** tryNumber))
              continue
            }
            setStatus(RETRYABLE.includes(apiError.code) ? 'failed' : 'idle')
            // Conflitos de conteúdo encerram a tentativa (a próxima terá nova chave).
            if (!RETRYABLE.includes(apiError.code)) attemptStore.clear(userId)
            return { error: apiError }
          }
        }
      } finally {
        inFlight.current = false
      }
    },
    [userId],
  )

  return { place, status, isBusy: status === 'sending' || status === 'recovering' }
}

export function isQuoteStale(error: unknown): error is ApiError & { details: QuoteStaleDetails } {
  return isApiError(error, 'QUOTE_STALE')
}
