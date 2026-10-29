import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import type { CatalogQuery } from '@/contracts'

export const catalogQuery = (query: CatalogQuery) =>
  queryOptions({
    queryKey: queryKeys.catalog(query),
    // O `signal` cancela a requisição quando os parâmetros mudam: respostas
    // obsoletas nunca sobrescrevem a consulta atual (cada combinação tem sua chave).
    queryFn: ({ signal }) => catalogApi.list(query, { signal }),
    placeholderData: keepPreviousData,
  })

export const featuredQuery = () =>
  queryOptions({
    queryKey: queryKeys.featured,
    queryFn: ({ signal }) => catalogApi.featured({ signal }),
    staleTime: 5 * 60_000,
  })

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.nft(id),
    queryFn: ({ signal }) => catalogApi.detail(id, { signal }),
  })

export const relatedQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.related(id),
    queryFn: ({ signal }) => catalogApi.related(id, { signal }),
    staleTime: 5 * 60_000,
  })

export function useCatalog(query: CatalogQuery) {
  return useQuery(catalogQuery(query))
}
