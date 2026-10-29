import { Link, getRouteApi } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { CATALOG_SORTS, CATEGORIES, NETWORKS, type CatalogResponse, type CatalogSort } from '@/contracts'
import { ErrorState } from '@/components/layout/page'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { cn } from '@/lib/utils'
import { CATALOG_PAGE_SIZE, hasActiveFilters, selectedCategories, selectedNetworks } from '../search'
import type { useCatalog } from '../queries'

const route = getRouteApi('/')

const TABS = [
  { id: undefined, label: 'Todos os NFTs' },
  { id: 'novos', label: 'Novos lançamentos' },
  { id: 'em-alta', label: 'Em alta' },
] as const

export function CatalogToolbar() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <nav aria-label="Seções do catálogo" className="-mx-1 overflow-x-auto">
        <ul className="flex gap-5 px-1 whitespace-nowrap">
          {TABS.map((tab) => {
            const active = search.tab === tab.id
            return (
              <li key={tab.label}>
                <Link
                  to="/"
                  search={(prev) => ({ ...prev, tab: tab.id, page: undefined })}
                  resetScroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-block border-b-2 pb-1.5 text-[15px] leading-4 font-medium',
                    active ? 'border-primary text-amber' : 'border-transparent text-foreground hover:text-amber',
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="relative flex items-center gap-1 text-[15px]">
        <label htmlFor="catalog-sort">Ordenar por:</label>
        <select
          id="catalog-sort"
          value={search.sort ?? 'recentes'}
          onChange={(event) => {
            const value = event.target.value as CatalogSort
            void navigate({ search: (prev) => ({ ...prev, sort: value === 'recentes' ? undefined : value, page: undefined }), resetScroll: false })
          }}
          className="appearance-none bg-transparent pr-6 text-foreground focus-visible:outline-2"
        >
          {CATALOG_SORTS.map((s) => (
            <option key={s.id} value={s.id} className="bg-popover">
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 size-4" aria-hidden />
      </div>
    </div>
  )
}

/** Chips dos filtros ativos, com remoção individual e "limpar tudo". */
export function ActiveFilters() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  if (!hasActiveFilters(search)) return null

  const chips: Array<{ label: string; clear: Partial<typeof search> }> = []
  if (search.q) chips.push({ label: `Busca: “${search.q}”`, clear: { q: undefined } })
  for (const id of selectedCategories(search)) {
    chips.push({ label: CATEGORIES.find((c) => c.id === id)!.label, clear: { cat: search.cat!.split(',').filter((c) => c !== id).join(',') || undefined } })
  }
  for (const id of selectedNetworks(search)) {
    chips.push({ label: NETWORKS.find((n) => n.id === id)!.label, clear: { net: search.net!.split(',').filter((n) => n !== id).join(',') || undefined } })
  }
  if (search.min || search.max) chips.push({ label: `Preço: ${search.min ?? 'mín.'} – ${search.max ?? 'máx.'} ETH`, clear: { min: undefined, max: undefined } })

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => navigate({ search: (prev) => ({ ...prev, ...chip.clear, page: undefined }), resetScroll: false })}
          className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-xs text-sand hover:border-primary hover:text-amber"
          aria-label={`Remover filtro ${chip.label}`}
        >
          {chip.label}
          <X className="size-3" aria-hidden />
        </button>
      ))}
      {chips.length > 1 && (
        <Link to="/" search={{}} resetScroll={false} className="text-xs font-bold text-amber hover:underline">
          Limpar filtros
        </Link>
      )}
    </div>
  )
}

function pageWindow(current: number, total: number) {
  const size = 4
  let start = Math.max(1, current - 1)
  const end = Math.min(total, start + size - 1)
  start = Math.max(1, end - size + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  const pageLink = (target: number) => ({
    to: '/' as const,
    search: (prev: Record<string, unknown>) => ({ ...prev, page: target === 1 ? undefined : target }),
    hash: 'catalogo',
  })
  const box = 'grid size-[35px] place-items-center rounded-sm text-lg leading-4'

  return (
    <nav aria-label="Paginação do catálogo" className="flex justify-center md:justify-end">
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <Link {...pageLink(page - 1)} className={cn(box, 'border border-[#3f2319] hover:border-primary')} aria-label="Página anterior">
              <ChevronLeft className="size-[18px]" aria-hidden />
            </Link>
          </li>
        )}
        {pageWindow(page, totalPages).map((n) => (
          <li key={n}>
            <Link
              {...pageLink(n)}
              aria-current={n === page ? 'page' : undefined}
              aria-label={`Página ${n}`}
              className={cn(box, n === page ? 'bg-primary font-bold text-primary-foreground' : 'border border-[#3f2319] hover:border-primary')}
            >
              {n}
            </Link>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <Link {...pageLink(page + 1)} className={cn(box, 'border border-[#3f2319] hover:border-primary')} aria-label="Próxima página">
              <ChevronRight className="size-[18px]" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

/** Grid com estados de carregamento, atualização em segundo plano, vazio e erro. */
export function CatalogGrid({ query }: { query: ReturnType<typeof useCatalog> }) {
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData } = query

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Carregando NFTs" className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-8 md:gap-y-[72px] lg:grid-cols-3" data-testid="catalog-skeleton">
        {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
          <NftCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError && !data) {
    return <ErrorState title="Não foi possível carregar o catálogo" message={error.message} onRetry={() => refetch()} retrying={isFetching} />
  }

  return <Results data={data!} updating={isFetching && isPlaceholderData} failed={isError} onRetry={() => refetch()} />
}

function Results({ data, updating, failed, onRetry }: { data: CatalogResponse; updating: boolean; failed: boolean; onRetry: () => void }) {
  if (data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md bg-card px-6 py-16 text-center" role="status">
        <h2 className="text-lg font-bold">Nenhum NFT encontrado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver mais resultados.</p>
        <Link to="/" search={{}} resetScroll={false} className="mt-2 font-bold text-amber hover:underline">
          Limpar filtros
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only" role="status" aria-live="polite">
        {updating ? 'Atualizando resultados…' : `${data.total} NFTs encontrados. Página ${data.page} de ${data.totalPages}.`}
      </p>
      {failed && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-sm border border-coral/40 px-4 py-2 text-sm">
          Não foi possível atualizar os resultados.
          <button type="button" onClick={onRetry} className="font-bold text-amber hover:underline">
            Tentar novamente
          </button>
        </div>
      )}
      <ul
        className={cn(
          'grid grid-cols-2 items-start gap-x-4 gap-y-10 transition-opacity max-md:[&>li:nth-child(even)]:mt-8 md:gap-x-8 md:gap-y-[72px] lg:grid-cols-3',
          updating && 'opacity-60',
        )}
        aria-busy={updating}
        data-testid="catalog-grid"
      >
        {data.items.map((nft, index) => (
          <li key={nft.id}>
            <NftCard nft={nft} priority={index < 3} sizes="(min-width: 1024px) 258px, (min-width: 768px) 45vw, 50vw" />
          </li>
        ))}
      </ul>
    </div>
  )
}
