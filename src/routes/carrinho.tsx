import { useEffect, useRef } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { MobileTopBar } from '@/components/layout/mobile'
import { Breadcrumbs, Container, ErrorState } from '@/components/layout/page'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { CartLineRow, CartLinesSkeleton, CouponForm, SummaryRows, SummarySkeleton } from '@/features/cart/components'
import { useCart, useCartMutations } from '@/features/cart/use-cart'
import { catalogQuery } from '@/features/catalog/queries'
import { announce } from '@/lib/announcer'

export const Route = createFileRoute('/carrinho')({
  component: CartPage,
})

function AlsoViewed() {
  const { data, isPending } = useQuery(catalogQuery({ sort: 'populares', page: 1, pageSize: 5 }))
  return (
    <section aria-labelledby="also-viewed" className="mt-20 hidden flex-col gap-8 md:flex">
      <h2 id="also-viewed" className="border-b border-primary/30 pb-3 text-[17px] font-bold text-amber">
        Colecionadores também viram
      </h2>
      <ul className="grid grid-cols-3 gap-6 lg:grid-cols-5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : data?.items.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} sizes="220px" />
              </li>
            ))}
      </ul>
    </section>
  )
}

function CartPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { data: cart, isPending, isError, error, refetch, isFetching } = useCart()
  const { acknowledge } = useCartMutations()
  const hasIssues = cart?.lines.some((l) => l.issues.length > 0) ?? false
  const previousIssues = useRef(false)

  // Mudanças recebidas em tempo real são anunciadas assim que aparecem.
  useEffect(() => {
    if (hasIssues && !previousIssues.current) {
      const message = 'Preço ou disponibilidade de itens do seu carrinho mudou. Revise os novos valores.'
      toast.warning(message)
      announce(message)
    }
    previousIssues.current = hasIssues
  }, [hasIssues])

  const checkout = () => {
    if (!session) {
      void navigate({ to: '/entrar', search: { redirect: '/pagamento', motivo: 'protegida' } })
      return
    }
    void navigate({ to: '/pagamento' })
  }

  const empty = cart && cart.lines.length === 0

  return (
    <div className="pb-72 md:pb-0">
      <MobileTopBar title="Carrinho de NFTs" />
      <Container className="md:pt-8">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Carrinho' }]} className="mb-1" />
        <h1 className="sr-only">Carrinho de NFTs</h1>

        {isError && !cart ? (
          <ErrorState title="Não foi possível carregar o carrinho" message={error.message} onRetry={() => refetch()} retrying={isFetching} />
        ) : empty ? (
          <div className="flex flex-col items-center gap-4 rounded-md bg-card px-6 py-16 text-center">
            <ShoppingCart className="size-10 text-amber" aria-hidden />
            <h2 className="text-xl font-bold">Seu carrinho está vazio</h2>
            <p className="text-sm text-muted-foreground">Explore o mercado e adicione NFTs para continuar.</p>
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
            <section aria-label="Itens do carrinho" className="flex flex-col gap-3">
              <div className="hidden grid-cols-[70px_1fr_138px_136px_118px_40px] gap-x-4 border-b border-primary/30 pb-3 text-base font-bold md:grid" aria-hidden>
                <span className="col-span-2">NFTs</span>
                <span>Preço</span>
                <span>Edições</span>
                <span>Total</span>
              </div>
              {hasIssues && (
                <div role="alert" className="flex flex-col gap-3 rounded-sm border border-coral/50 bg-coral/10 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="cart-changes-banner">
                  <p className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="size-5 shrink-0 text-coral" aria-hidden />
                    Alguns itens mudaram de preço ou disponibilidade. Confirme os novos valores para continuar.
                  </p>
                  <Button size="sm" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                    Aceitar novos valores
                  </Button>
                </div>
              )}
              {isPending ? (
                <CartLinesSkeleton />
              ) : (
                <ul className="flex flex-col gap-3 md:gap-3" aria-busy={isFetching}>
                  {cart!.lines.map((line) => (
                    <CartLineRow key={`${line.nftId}-${line.editionId}`} line={line} />
                  ))}
                </ul>
              )}
            </section>

            <aside
              aria-labelledby="summary-title"
              className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-5 rounded-t-[32px] bg-ink-900 px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:static md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
            >
              <h2 id="summary-title" className="hidden border-b border-primary/30 pb-3 text-lg font-bold md:block">
                Resumo da carteira
              </h2>
              {isPending ? (
                <SummarySkeleton />
              ) : (
                <>
                  <CouponForm cart={cart!} />
                  <SummaryRows summary={cart!.summary} />
                </>
              )}
              <Button size="lg" className="h-[60px] rounded-full bg-gradient-to-r from-amber to-copper md:h-10 md:rounded-md" onClick={checkout} disabled={isPending || hasIssues}>
                Conectar e finalizar
              </Button>
              {hasIssues && <p className="text-center text-xs text-coral">Aceite os novos valores para finalizar.</p>}
              <Link to="/" hash="catalogo" className="hidden text-center text-amber hover:underline md:block">
                Continuar explorando
              </Link>
            </aside>
          </div>
        )}
        <AlsoViewed />
      </Container>
    </div>
  )
}
