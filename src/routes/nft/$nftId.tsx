import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Heart, Mail, ShoppingCart, Star } from 'lucide-react'
import { isApiError } from '@/api/client'
import { LinkedinIcon, TwitterIcon } from '@/components/icons'
import { MobileTopBar } from '@/components/layout/mobile'
import { Breadcrumbs, Container, ErrorState } from '@/components/layout/page'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NETWORKS, type EditionId, type NftDetail } from '@/contracts'
import { useCart, useCartMutations } from '@/features/cart/use-cart'
import { nftQuery, relatedQuery } from '@/features/catalog/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/use-favorites'
import { NftGallery } from '@/features/nft/gallery'
import { useLivePriceNotice } from '@/features/nft/use-live-price-notice'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { NotFound } from '../__root'

export const Route = createFileRoute('/nft/$nftId')({
  // Prefetch sem bloquear: a página mostra o skeleton imediatamente.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQuery(params.nftId))
    void context.queryClient.prefetchQuery(relatedQuery(params.nftId))
  },
  component: NftDetailPage,
})

function Rating({ value, count }: { value: number; count: number }) {
  return (
    <p className="flex items-center gap-2 text-[15px]">
      <span className="flex gap-0.5 text-amber" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn('size-4', i < Math.round(value) && 'fill-current')} />
        ))}
      </span>
      <span>
        <span className="sr-only">Nota {value.toString().replace('.', ',')} de 5, </span>
        {count} avaliações de colecionadores
      </span>
    </p>
  )
}

function EditionPicker({ nft, value, onChange }: { nft: NftDetail; value: EditionId; onChange: (id: EditionId) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[15px] leading-4 font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Edição">
        {nft.editions.map((edition) => {
          const unavailable = edition.available === 0
          const selected = edition.id === value
          return (
            <button
              key={edition.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={unavailable}
              onClick={() => !unavailable && onChange(edition.id)}
              className={cn(
                'h-7 rounded-full border px-2.5 text-sm transition-colors',
                selected ? 'border-primary font-medium text-amber' : 'border-border text-sand hover:border-primary/60',
                unavailable && 'cursor-not-allowed line-through opacity-50',
              )}
              aria-label={`Edição ${edition.label}${unavailable ? ', esgotada' : `, ${formatEth(edition.priceEth)}`}`}
            >
              {edition.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[573px_1fr]" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <div className="flex gap-7">
        <div className="hidden flex-col gap-4 md:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="aspect-square flex-1 rounded-3xl" />
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-2/3" />
      </div>
    </div>
  )
}

function Related({ nftId }: { nftId: string }) {
  const { data, isPending, isError } = useQuery(relatedQuery(nftId))
  const [page, setPage] = useState(0)
  if (isError) return null
  const perPage = 5
  const pages = data ? Math.max(1, Math.ceil(data.length / perPage)) : 1
  const items = data?.slice(page * perPage, page * perPage + perPage)

  return (
    <section aria-labelledby="related-title" className="mt-16 flex flex-col gap-8 md:mt-24">
      <h2 id="related-title" className="border-b border-primary/30 pb-3 text-[17px] font-bold text-amber">
        Mais desta coleção
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
        {isPending
          ? Array.from({ length: perPage }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))
          : items!.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} sizes="(min-width: 1024px) 220px, 50vw" />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="flex justify-center gap-2" role="group" aria-label="Páginas de itens relacionados">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Página ${i + 1}`} aria-pressed={i === page} className="grid size-6 place-items-center">
              <span className={cn('size-3 rounded-full border border-primary', i === page && 'bg-primary')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const navigate = useNavigate()
  const { data: nft, isPending, isError, error, refetch, isFetching } = useQuery(nftQuery(nftId))
  const { data: cart } = useCart()
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const { add } = useCartMutations()
  const [selectedEdition, setEditionId] = useState<EditionId>('1-50')
  const [requestedQuantity, setQuantity] = useState(1)
  useLivePriceNotice(nftId, nft?.name)

  // Se a edição escolhida esgotar (ou vier esgotada), usa a próxima disponível.
  const preferred = nft?.editions.find((e) => e.id === selectedEdition)
  const edition = preferred && preferred.available > 0 ? preferred : (nft?.editions.find((e) => e.available > 0) ?? preferred)
  const editionId = edition?.id ?? selectedEdition
  // Já no carrinho conta para o limite (disponibilidade e máximo por pedido).
  const inCart = cart?.lines.find((l) => l.nftId === nftId && l.editionId === editionId)?.quantity ?? 0
  const max = edition && nft ? Math.max(0, Math.min(edition.available, nft.maxPerOrder) - inCart) : 0
  const quantity = Math.max(1, Math.min(requestedQuantity, max || 1))

  if (isError && isApiError(error, 'NOT_FOUND')) return <NotFound />

  const isFavorite = favorites.data?.has(nftId) ?? false
  const unavailable = !edition || edition.available === 0
  const limitReached = !unavailable && max === 0

  const addToCart = async (goToCart: boolean) => {
    if (!nft || unavailable || limitReached) return
    try {
      await add.mutateAsync({ nftId, editionId, quantity })
      setQuantity(1)
      if (goToCart) await navigate({ to: '/carrinho' })
    } catch {
      /* feedback exibido pela mutation */
    }
  }

  return (
    <div className="pb-48 md:pb-0">
      <MobileTopBar
        title=""
        action={
          nft && (
            <button
              type="button"
              onClick={() => toggleFavorite.toggle(nft.id, nft.name, !isFavorite)}
              className={cn('grid size-10 place-items-center rounded-full bg-secondary', isFavorite ? 'text-amber' : 'text-foreground')}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            >
              <Heart className={cn('size-5', isFavorite && 'fill-current')} aria-hidden />
            </button>
          )
        }
      />
      {/* Altura mínima da tela: o rodapé não aparece (e depois salta) enquanto o NFT carrega. */}
      <Container className="md:min-h-[calc(100dvh-69px)] md:pt-8">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, ...(nft ? [{ label: nft.name }] : [])]} className="mb-3" />

        {isPending ? (
          <DetailSkeleton />
        ) : isError ? (
          <ErrorState title="Não foi possível carregar este NFT" message={error.message} onRetry={() => refetch()} retrying={isFetching} />
        ) : (
          <>
            <article className="grid gap-8 md:grid-cols-[minmax(0,573px)_1fr]">
              <NftGallery artwork={nft.artwork} name={nft.name} />

              <div className="flex flex-col gap-5 rounded-t-[32px] bg-card px-6 pt-6 md:rounded-none md:bg-transparent md:p-0">
                <header className="flex flex-col gap-3 border-b border-primary/30 pb-3">
                  <h1 className="text-[22px] leading-[37px] font-bold md:text-[28px]">{nft.name}</h1>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="hidden text-[22px] leading-4 font-bold text-amber md:block" data-testid="detail-price">
                      {formatEth(edition?.priceEth ?? nft.priceEth)}
                    </p>
                    <Rating value={nft.rating} count={nft.reviewCount} />
                  </div>
                </header>

                <section className="flex flex-col gap-3">
                  <h2 className="text-[15px] leading-4 font-bold">Sobre este NFT:</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{nft.description}</p>
                </section>

                <EditionPicker nft={nft} value={editionId} onChange={(id) => { setEditionId(id); setQuantity(1) }} />

                <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="availability">
                  {unavailable
                    ? 'Esta edição está esgotada.'
                    : limitReached
                      ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
                      : `${edition.supply === null ? 'Edição aberta' : `${edition.available} de ${edition.supply} disponíveis`} · máximo de ${nft.maxPerOrder} por pedido${inCart ? ` · ${inCart} no carrinho` : ''}.`}
                </p>

                <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
                  <QuantityStepper value={quantity} max={max} onChange={setQuantity} label="Quantidade" disabled={unavailable || limitReached} />
                  <div className="flex gap-2">
                    <Button className="w-[115px] text-sm" onClick={() => addToCart(true)} disabled={unavailable || limitReached || add.isPending}>
                      {add.isPending ? 'Adicionando…' : 'COMPRAR'}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-sm font-medium"
                      onClick={() => toggleFavorite.toggle(nft.id, nft.name, !isFavorite)}
                      aria-pressed={isFavorite}
                    >
                      <Heart className={cn('size-5', isFavorite && 'fill-current')} aria-hidden />
                      {isFavorite ? 'Favoritado' : 'Favoritar'}
                    </Button>
                  </div>
                </div>

                <dl className="flex flex-col gap-3 text-[15px] text-khaki">
                  <div className="flex gap-1">
                    <dt>ID do token:</dt>
                    <dd>{nft.tokenId}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Coleção:</dt>
                    <dd>{nft.collection}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Atributos:</dt>
                    <dd>{nft.attributes.join(', ')}</dd>
                  </div>
                </dl>

                <div className="hidden items-center gap-3 md:flex">
                  <p className="text-[15px] font-bold">Compartilhar este NFT:</p>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Compartilhar no LinkedIn (abre em nova aba)"
                    className="hover:text-amber"
                  >
                    <LinkedinIcon className="size-4" />
                  </a>
                  <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(location.href)}`} aria-label="Compartilhar por e-mail" className="hover:text-amber">
                    <Mail className="size-4" aria-hidden />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(nft.name)}&url=${encodeURIComponent(location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Compartilhar no Twitter (abre em nova aba)"
                    className="hover:text-amber"
                  >
                    <TwitterIcon className="size-4" />
                  </a>
                </div>
              </div>
            </article>

            <Tabs defaultValue="detalhes" className="mt-16 hidden md:flex md:mt-24">
              <TabsList variant="line" className="h-auto w-full justify-start gap-8 rounded-none border-b border-primary/30 bg-transparent p-0">
                <TabsTrigger value="detalhes" className="flex-none rounded-none px-0 pb-3 text-[17px] data-[state=active]:font-bold data-[state=active]:text-amber">
                  Detalhes do NFT
                </TabsTrigger>
                <TabsTrigger value="avaliacoes" className="flex-none rounded-none px-0 pb-3 text-[17px] data-[state=active]:font-bold data-[state=active]:text-amber">
                  Avaliações de colecionadores ({nft.reviewCount})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="detalhes" className="flex flex-col gap-3 pt-4 text-sm leading-6 text-muted-foreground">
                {nft.story.map((paragraph) => (
                  <p key={paragraph.slice(0, 20)} className="mb-3">
                    {paragraph}
                  </p>
                ))}
                <dl>
                  <dt className="font-bold text-foreground">Rede:</dt>
                  <dd className="mb-3">Cunhado na {NETWORKS.find((n) => n.id === nft.network)?.label} com procedência imutável e metadados armazenados no IPFS.</dd>
                  <dt className="font-bold text-foreground">Contrato:</dt>
                  <dd className="mb-3">Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
                  <dt className="font-bold text-foreground">Direitos autorais:</dt>
                  <dd>{nft.contractAddress} • Contrato inteligente ERC-721 verificado.</dd>
                </dl>
              </TabsContent>
              <TabsContent value="avaliacoes" className="pt-4">
                <ul className="flex flex-col gap-4">
                  {nft.reviews.map((review) => (
                    <li key={review.id} className="rounded-md bg-card p-4">
                      <p className="flex items-center justify-between text-sm font-bold">
                        {review.author}
                        <span className="flex items-center gap-1 text-amber">
                          <Star className="size-4 fill-current" aria-hidden /> {review.rating}
                          <span className="sr-only"> de 5</span>
                        </span>
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>

            {/* Relacionados só após o conteúdo principal, evitando deslocamento de layout (CLS). */}
            <Related nftId={nftId} />

            {/* Barra de compra fixa do mobile */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-4 rounded-t-[32px] bg-ink-900 px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold">Qtd.</span>
                  <QuantityStepper value={quantity} max={max} onChange={setQuantity} label="Quantidade" size="sm" disabled={unavailable || limitReached} />
                </div>
                <p className="text-xl font-bold text-amber">{formatEth(edition?.priceEth ?? nft.priceEth)}</p>
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="h-[60px] flex-1 rounded-full bg-gradient-to-r from-amber to-copper" onClick={() => addToCart(true)} disabled={unavailable || limitReached || add.isPending}>
                  Comprar NFT
                </Button>
                <button
                  type="button"
                  onClick={() => addToCart(false)}
                  disabled={unavailable || limitReached || add.isPending}
                  className="grid size-[60px] place-items-center rounded-full bg-card text-amber disabled:opacity-50"
                  aria-label="Adicionar ao carrinho"
                >
                  <ShoppingCart className="size-5" aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}

      </Container>
    </div>
  )
}
