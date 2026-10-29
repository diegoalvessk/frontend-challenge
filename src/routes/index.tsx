import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Container } from '@/components/layout/page'
import { MobileBottomNav } from '@/components/layout/mobile'
import { SearchDialog } from '@/components/layout/site-header'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ActiveFilters, CatalogGrid, CatalogPagination, CatalogToolbar } from '@/features/catalog/components/catalog-results'
import { Journal, Promos, SpotlightBanner } from '@/features/catalog/components/editorial'
import { CatalogFilters } from '@/features/catalog/components/filters'
import { Hero } from '@/features/catalog/components/hero'
import { catalogQuery, featuredQuery, useCatalog } from '@/features/catalog/queries'
import { catalogSearchSchema, toCatalogQuery } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => toCatalogQuery(search),
  // Pré-carrega (sem bloquear a navegação) a página de catálogo pedida na URL.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogQuery(deps))
    void context.queryClient.prefetchQuery(featuredQuery())
  },
  component: HomePage,
})

/** Busca do mobile: digita e atualiza a URL com debounce (sem empilhar histórico). */
function MobileSearch() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [value, setValue] = useState(search.q ?? '')

  useEffect(() => setValue(search.q ?? ''), [search.q])
  useEffect(() => {
    if ((search.q ?? '') === value.trim()) return
    const timer = setTimeout(() => {
      void navigate({ search: (prev) => ({ ...prev, q: value.trim() || undefined, page: undefined }), replace: true, resetScroll: false })
    }, 350)
    return () => clearTimeout(timer)
  }, [value, search.q, navigate])

  return (
    <form role="search" className="relative flex-1" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="mobile-search" className="sr-only">
        Explorar coleções
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-sand" aria-hidden />
      <input
        id="mobile-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Explorar coleções"
        className="h-12 w-full rounded-xl bg-card pr-4 pl-12 text-sm font-bold text-foreground placeholder:text-sand"
      />
    </form>
  )
}

function HomePage() {
  const search = Route.useSearch()
  const query = toCatalogQuery(search)
  const catalog = useCatalog(query)
  const [searchOpen, setSearchOpen] = useState(false)
  const facets = catalog.data?.facets

  return (
    <div className="pb-28 md:pb-0">
      <Container className="flex flex-col gap-6 pt-6 md:gap-24 md:pt-8">
        <div className="flex items-center gap-3 md:hidden">
          <MobileSearch />
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber to-copper text-primary-foreground"
                aria-label="Abrir filtros"
              >
                <SlidersHorizontal className="size-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-border bg-card">
              <SheetTitle className="px-5 pt-5">Filtros</SheetTitle>
              <SheetDescription className="px-5">Os filtros são aplicados imediatamente.</SheetDescription>
              <CatalogFilters facets={facets} />
            </SheetContent>
          </Sheet>
        </div>

        <Hero />

        <section id="catalogo" aria-labelledby="catalog-title" className="scroll-mt-6">
          <h2 id="catalog-title" className="sr-only">
            Catálogo de NFTs
          </h2>
          <div className="flex gap-12">
            <aside className="hidden w-[310px] shrink-0 flex-col gap-6 lg:flex" aria-label="Filtros do catálogo">
              <CatalogFilters facets={facets} />
              <SpotlightBanner />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <CatalogToolbar />
              <div className="hidden md:block lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-bold text-amber">
                      <SlidersHorizontal className="size-4" aria-hidden /> Filtros
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="overflow-y-auto border-border bg-card">
                    <SheetTitle className="px-5 pt-5">Filtros</SheetTitle>
                    <SheetDescription className="px-5">Os filtros são aplicados imediatamente.</SheetDescription>
                    <CatalogFilters facets={facets} />
                  </SheetContent>
                </Sheet>
              </div>
              <ActiveFilters />
              <CatalogGrid query={catalog} />
              {catalog.data && <CatalogPagination page={catalog.data.page} totalPages={catalog.data.totalPages} />}
            </div>
          </div>
        </section>

        <div className="hidden md:block">
          <Promos />
        </div>
        <div className="hidden md:block">
          <Journal />
        </div>
      </Container>
      <MobileBottomNav onSearch={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
