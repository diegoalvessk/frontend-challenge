import { useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X, XCircle } from 'lucide-react'
import { isApiError } from '@/api/client'
import { ordersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import { Container, ErrorState } from '@/components/layout/page'
import { NftImage } from '@/components/nft/nft-image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts'
import { requireAuth } from '@/features/auth/require-auth'
import { useSession } from '@/features/auth/session-store'
import { attemptStore } from '@/features/checkout/attempt-store'
import { shortAddress } from '@/features/checkout/format'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/money'

export const Route = createFileRoute('/pedidos/$orderId')({
  beforeLoad: requireAuth,
  component: OrderPage,
})

/**
 * O estado chega por `order.updated` (Socket.IO). Enquanto pendente, há
 * também um polling leve como rede de segurança — e, após reconectar ou
 * recarregar, a consulta REST recupera o estado sem criar outro pedido.
 */
function useOrder(userId: string, orderId: string) {
  return useQuery({
    queryKey: queryKeys.order(userId, orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5_000 : false),
  })
}

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 66 80" className="h-20 w-[66px] text-copper" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M8 30v42a4 4 0 0 0 4 4h42a4 4 0 0 0 4-4V30" />
      <path d="M8 30l25 22 25-22" />
      <path d="M8 74l20-18M58 74 38 56" />
      <rect x="14" y="6" width="38" height="34" rx="3" />
      <path d="M28 6c0-3 2-4 5-4s5 1 5 4" />
      <text x="33" y="20" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">THANK</text>
      <text x="33" y="31" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">YOU</text>
    </svg>
  )
}

function Receipt({ order }: { order: Order }) {
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.settledAt ?? order.createdAt))
  return (
    <article className="relative mx-auto w-full max-w-[578px] border-b-[10px] border-primary bg-card" aria-labelledby="receipt-title" data-testid="receipt">
      <Link to="/" className="absolute top-4 right-4 grid size-8 place-items-center text-amber hover:text-foreground" aria-label="Fechar recibo e voltar ao início">
        <X className="size-5" aria-hidden />
      </Link>
      <header className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
        <ThankYouIcon />
        <h1 id="receipt-title" className="text-center text-base font-bold text-sand">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:px-3">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand" title={order.transactionHash ?? ''} data-testid="tx-id">
            {shortAddress(order.transactionHash ?? '')}
          </dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{date}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.summary.totalEth)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{order.wallet.label}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-4 px-6 py-6 sm:px-11">
        <h2 className="text-base font-bold">Detalhes da transação</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-primary/40 text-base">
              <th scope="col" className="pb-2 font-bold">NFTs</th>
              <th scope="col" className="pb-2 text-center font-bold">Edições</th>
              <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={`${line.nftId}-${line.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftImage artwork={line.artwork} alt="" sizes="66px" className="size-[66px] rounded-sm" />
                    <div>
                      <p className="font-bold">{line.name}</p>
                      <p className="text-sm text-sand">ID do token: {line.tokenId} · {line.editionLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-sm text-sand">(x {line.quantity})</td>
                <td className="text-right text-lg font-bold whitespace-nowrap text-amber">{formatEth(line.lineTotalEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto grid w-full max-w-[320px] grid-cols-2 gap-y-1 border-b border-primary/40 pb-3 text-base">
          {order.coupon && (
            <>
              <dt>Desconto ({order.coupon.code})</dt>
              <dd className="text-right">(-) {formatEth(order.summary.discountEth)}</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right text-lg">{formatEth(order.summary.networkFeeEth)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right text-lg font-bold text-amber" data-testid="receipt-total">
            {formatEth(order.summary.totalEth)}
          </dd>
        </dl>
        <p className="text-center text-sm leading-6 text-sand">
          Transação confirmada na rede (simulação). A propriedade foi transferida para sua carteira {shortAddress(order.wallet.address)} e registrada na rede.
        </p>
        {order.explorerUrl && (
          <Button asChild className="mx-auto h-12">
            <a href={order.explorerUrl}>Ver no Etherscan</a>
          </Button>
        )}
      </div>
    </article>
  )
}

function OrderPage() {
  const session = useSession()
  return session ? <OrderView userId={session.user.id} /> : null
}

function OrderView({ userId }: { userId: string }) {
  const { orderId } = Route.useParams()
  const { data: order, isPending, isError, error, refetch, isFetching } = useOrder(userId, orderId)

  // Estado terminal: encerra a tentativa de checkout e anuncia o resultado.
  useEffect(() => {
    if (!order || order.status === 'pending') return
    attemptStore.clear(userId)
    announce(order.status === 'confirmed' ? 'Pagamento confirmado. Seus NFTs estão na sua carteira.' : `Pagamento recusado. ${order.declineReason ?? ''}`)
  }, [order, userId])

  return (
    <Container className="flex min-h-[70vh] items-start justify-center py-10 md:py-24">
      {isPending ? (
        <div className="w-full max-w-[578px]" aria-busy="true" aria-label="Carregando pedido">
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : isError ? (
        isApiError(error, 'NOT_FOUND') || isApiError(error, 'FORBIDDEN') ? (
          <ErrorState title="Pedido não encontrado" message="Este pedido não existe ou pertence a outra conta." />
        ) : (
          <ErrorState title="Não foi possível carregar o pedido" message={error.message} onRetry={() => refetch()} retrying={isFetching} />
        )
      ) : order.status === 'confirmed' ? (
        <Receipt order={order} />
      ) : order.status === 'pending' ? (
        <section className="flex max-w-md flex-col items-center gap-4 rounded-md bg-card px-8 py-12 text-center" aria-live="polite" data-testid="order-pending">
          <Loader2 className="size-10 animate-spin text-amber motion-reduce:animate-none" aria-hidden />
          <h1 className="text-xl font-bold">Aguardando confirmação da rede</h1>
          <p className="text-sm text-muted-foreground">
            Seu pedido foi registrado e está sendo processado. Você pode recarregar ou fechar esta página: o status será recuperado sem criar outra compra.
          </p>
          <p className="text-xs text-khaki">Pedido {order.id}</p>
        </section>
      ) : (
        <section className="flex max-w-md flex-col items-center gap-4 rounded-md border border-coral/40 bg-card px-8 py-12 text-center" role="alert" data-testid="order-declined">
          <XCircle className="size-10 text-coral" aria-hidden />
          <h1 className="text-xl font-bold">Pagamento recusado</h1>
          <p className="text-sm text-muted-foreground">{order.declineReason}</p>
          <p className="text-sm">Os itens continuam no seu carrinho.</p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/carrinho">Voltar ao carrinho</Link>
            </Button>
          </div>
        </section>
      )}
    </Container>
  )
}
