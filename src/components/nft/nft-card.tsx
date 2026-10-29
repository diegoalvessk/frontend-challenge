import { Link } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { EditionId, NftSummary } from '@/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { useCartMutations } from '@/features/cart/use-cart'
import { useFavorites, useToggleFavorite } from '@/features/favorites/use-favorites'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'
import { Price } from './price'

const DEFAULT_EDITION: EditionId = '1-50'

interface NftCardProps {
  nft: NftSummary
  /** Atributo `sizes` da imagem conforme o grid onde o card aparece. */
  sizes?: string
  priority?: boolean
  /** Exibe os atalhos de carrinho/favorito/detalhe sobre a imagem. */
  actions?: boolean
}

/**
 * Card do catálogo. O título é o link principal (estendido sobre o card via
 * ::after) e os atalhos são botões independentes, sem interativos aninhados.
 */
export function NftCard({ nft, sizes = '(min-width: 1024px) 258px, 50vw', priority, actions = true }: NftCardProps) {
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const { add } = useCartMutations()
  const isFavorite = favorites.data?.has(nft.id) ?? false

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative bg-card px-1 pt-6 pb-5">
        {nft.rarity !== 'comum' && (
          <span className="absolute top-0 left-0 z-10 bg-primary px-3 py-1 text-[15px] font-medium text-primary-foreground uppercase">
            {nft.rarity === 'raro' ? 'Raro' : 'Lendário'}
          </span>
        )}
        <NftImage
          artwork={nft.artwork}
          alt={`Arte do NFT ${nft.name}`}
          sizes={sizes}
          priority={priority}
          className={cn('rounded-2xl transition-transform duration-300 motion-safe:group-hover:scale-[1.02]', nft.soldOut && 'opacity-60')}
        />
        {nft.soldOut && (
          <span className="absolute top-8 right-3 z-10 rounded-sm bg-background/90 px-2 py-1 text-xs font-bold text-coral uppercase">
            Esgotado
          </span>
        )}
        {actions && (
          <div className="absolute top-7 right-2 z-20 flex justify-center gap-3 transition-opacity lg:inset-x-0 lg:top-auto lg:right-auto lg:bottom-1 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
            <button
              type="button"
              className="hidden size-9 place-items-center rounded-sm bg-card text-foreground hover:text-amber disabled:opacity-50 lg:grid"
              onClick={() => add.mutate({ nftId: nft.id, editionId: DEFAULT_EDITION, quantity: 1 })}
              disabled={nft.soldOut || add.isPending}
              aria-label={`Adicionar ${nft.name} (edição 1/50) ao carrinho`}
            >
              <ShoppingCart className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              className={cn('grid size-9 place-items-center rounded-full bg-card/90 hover:text-amber lg:rounded-sm lg:bg-card', isFavorite ? 'text-amber' : 'text-foreground')}
              onClick={() => toggleFavorite.toggle(nft.id, nft.name, !isFavorite)}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
            >
              <Heart className={cn('size-5', isFavorite && 'fill-current')} aria-hidden />
            </button>
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              className="hidden size-9 place-items-center rounded-sm bg-card text-foreground hover:text-amber lg:grid"
              aria-label={`Ver detalhes de ${nft.name}`}
              tabIndex={-1}
            >
              <Search className="size-5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
      <h3 className="text-base leading-4 font-normal">
        <Link
          to="/nft/$nftId"
          params={{ nftId: nft.id }}
          className="outline-none after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:underline focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {nft.name}
        </Link>
      </h3>
      <Price value={nft.priceEth} previous={nft.previousPriceEth} />
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="bg-card px-1 pt-6 pb-5">
        <Skeleton className="aspect-square w-full rounded-2xl" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
