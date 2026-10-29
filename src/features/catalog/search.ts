import { z } from 'zod'
import { CATALOG_SORTS, CATEGORIES, NETWORKS, type CatalogQuery, type CategoryId, type Network } from '@/contracts'

export const CATALOG_PAGE_SIZE = 9

/**
 * Estado do catálogo na URL. Valores inválidos são descartados (`catch`) em
 * vez de quebrar a página, e valores padrão são omitidos para manter a URL limpa.
 * Listas usam vírgula: `?cat=musica,arte-3d&net=polygon`.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tab: z.enum(['novos', 'em-alta']).optional().catch(undefined),
  cat: z.string().optional().catch(undefined),
  net: z.string().optional().catch(undefined),
  min: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  max: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  sort: z.enum(['preco-asc', 'preco-desc', 'populares']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
})

export type CatalogSearch = z.infer<typeof catalogSearchSchema>

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id))
const NETWORK_IDS = new Set<string>(NETWORKS.map((n) => n.id))
const SORT_IDS = new Set<string>(CATALOG_SORTS.map((s) => s.id))

export function parseList<T extends string>(value: string | undefined, allowed: Set<string>): T[] {
  return (value ?? '').split(',').filter((v): v is T => allowed.has(v))
}

export function selectedCategories(search: CatalogSearch) {
  return parseList<CategoryId>(search.cat, CATEGORY_IDS)
}

export function selectedNetworks(search: CatalogSearch) {
  return parseList<Network>(search.net, NETWORK_IDS)
}

/** Converte o estado da URL nos parâmetros enviados à API. */
export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q || undefined,
    tab: search.tab ?? 'todos',
    categories: selectedCategories(search),
    networks: selectedNetworks(search),
    minPrice: search.min,
    maxPrice: search.max,
    sort: search.sort && SORT_IDS.has(search.sort) ? search.sort : 'recentes',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

/** Alterna um valor numa lista separada por vírgula (undefined quando vazia). */
export function toggleInList(value: string | undefined, item: string) {
  const items = new Set((value ?? '').split(',').filter(Boolean))
  if (items.has(item)) items.delete(item)
  else items.add(item)
  return items.size ? [...items].join(',') : undefined
}

export function hasActiveFilters(search: CatalogSearch) {
  return Boolean(search.q || search.cat || search.net || search.min || search.max || search.tab)
}
