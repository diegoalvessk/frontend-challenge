import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import type { CatalogResponse } from '@/contracts'
import { CATEGORIES, NETWORKS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { selectedCategories, selectedNetworks, toggleInList } from '../search'

const route = getRouteApi('/')

const formatPt = (value: number) => value.toFixed(2).replace('.', ',')

function PriceRange({ facets }: { facets: CatalogResponse['facets'] | undefined }) {
  const search = route.useSearch()
  const bounds: [number, number] = facets ? [Number(facets.priceRange.min), Number(facets.priceRange.max)] : [0, 13]
  const committed: [number, number] = [search.min ? Number(search.min) : bounds[0], search.max ? Number(search.max) : bounds[1]]
  // A key reinicia o controle quando a URL muda (voltar/avançar no histórico).
  return <PriceRangeControl key={committed.join('-')} bounds={bounds} committed={committed} />
}

function PriceRangeControl({ bounds, committed }: { bounds: [number, number]; committed: [number, number] }) {
  const navigate = route.useNavigate()
  const [value, setValue] = useState<[number, number]>(committed)

  return (
    <div className="flex flex-col gap-3 pl-3">
      <Slider
        min={bounds[0]}
        max={bounds[1]}
        step={0.01}
        minStepsBetweenThumbs={1}
        value={value}
        onValueChange={(v) => setValue([v[0], v[1]])}
        aria-label="Faixa de preço em ETH"
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        className="mt-2"
      />
      <p className="text-[15px] leading-5" aria-live="polite">
        Preço: {formatPt(value[0])} - {formatPt(value[1])} ETH
      </p>
      <Button
        size="sm"
        className="w-fit"
        onClick={() =>
          navigate({
            search: (prev) => ({
              ...prev,
              min: value[0] > bounds[0] ? value[0].toFixed(2) : undefined,
              max: value[1] < bounds[1] ? value[1].toFixed(2) : undefined,
              page: undefined,
            }),
            resetScroll: false,
          })
        }
      >
        Aplicar
      </Button>
    </div>
  )
}

function FilterToggle({ label, count, active, onToggle, boldCount }: { label: string; count?: number; active: boolean; onToggle: () => void; boldCount?: boolean }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-sm px-3 text-left text-[15px] transition-colors hover:bg-secondary',
          active ? 'text-amber' : 'text-muted-foreground',
        )}
      >
        <span className={cn(active && 'underline decoration-primary underline-offset-4')}>{label}</span>
        {count === undefined ? (
          <Skeleton className="h-4 w-8" />
        ) : (
          <span className={cn(boldCount && 'font-bold')}>
            <span className="sr-only">, </span>({count})<span className="sr-only"> itens</span>
          </span>
        )}
      </button>
    </li>
  )
}

/** Filtros combináveis; qualquer mudança volta para a página 1. */
export function CatalogFilters({ facets, className }: { facets: CatalogResponse['facets'] | undefined; className?: string }) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const categories = selectedCategories(search)
  const networks = selectedNetworks(search)

  return (
    <div className={cn('flex flex-col gap-10 bg-card p-5', className)}>
      <section aria-labelledby="filter-collections" className="flex flex-col gap-3">
        <h2 id="filter-collections" className="text-lg leading-4 font-bold">
          Coleções
        </h2>
        <ul>
          {CATEGORIES.map((c) => (
            <FilterToggle
              key={c.id}
              label={c.label}
              boldCount
              count={facets?.categories.find((f) => f.id === c.id)?.count}
              active={categories.includes(c.id)}
              onToggle={() =>
                navigate({ search: (prev) => ({ ...prev, cat: toggleInList(prev.cat, c.id), page: undefined }), resetScroll: false })
              }
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="filter-price" className="flex flex-col gap-3">
        <h2 id="filter-price" className="text-lg leading-4 font-bold">
          Faixa de preço
        </h2>
        <PriceRange facets={facets} />
      </section>

      <section aria-labelledby="filter-network" className="flex flex-col gap-3">
        <h2 id="filter-network" className="text-lg leading-4 font-bold">
          Rede
        </h2>
        <ul>
          {NETWORKS.map((n) => (
            <FilterToggle
              key={n.id}
              label={n.label}
              count={facets?.networks.find((f) => f.id === n.id)?.count}
              active={networks.includes(n.id)}
              onToggle={() =>
                navigate({ search: (prev) => ({ ...prev, net: toggleInList(prev.net, n.id), page: undefined }), resetScroll: false })
              }
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
