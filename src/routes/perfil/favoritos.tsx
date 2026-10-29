import { Link, createFileRoute } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { ErrorState } from '@/components/layout/page'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { nftQuery } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'

export const Route = createFileRoute('/perfil/favoritos')({
  component: FavoritesPage,
})

/** Lista de interesse: favoritos persistidos na API para o usuário autenticado. */
function FavoritesPage() {
  const favorites = useFavorites()
  const ids = [...(favorites.data ?? [])]
  const items = useQueries({ queries: ids.map((id) => nftQuery(id)) })

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-6">
      <h1 id="favorites-title" className="text-lg font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.isError ? (
        <ErrorState message={favorites.error.message} onRetry={() => favorites.refetch()} retrying={favorites.isFetching} />
      ) : ids.length === 0 ? (
        <p className="rounded-md bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Você ainda não favoritou nenhum NFT.{' '}
          <Link to="/" hash="catalogo" className="font-bold text-amber hover:underline">
            Explorar o mercado
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-8" data-testid="favorites-grid">
          {items.map((query, index) => (
            <li key={ids[index]}>{query.data ? <NftCard nft={query.data} sizes="(min-width: 1024px) 258px, 50vw" /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
