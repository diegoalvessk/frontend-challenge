import { HttpResponse, http } from 'msw'
import {
  CATEGORIES,
  NETWORKS,
  type CatalogResponse,
  type CatalogSort,
  type CatalogTab,
  type CategoryId,
  type FeaturedResponse,
  type NftDetail,
  type NftSummary,
  type Network,
} from '@/contracts'
import { eth } from '@/lib/money'
import { commit, db, findNft } from '../db'
import { API, fail, handle, requireUser } from '../http'
import { getScenario } from '../scenarios'

const DEFAULT_PAGE_SIZE = 9
const MAX_PAGE_SIZE = 24
const NEW_WINDOW_MS = 10 * 86_400_000
const TRENDING_POPULARITY = 600

export function toSummary(nft: NftDetail): NftSummary {
  const { id, name, tokenId, artwork, collection, category, network, priceEth, previousPriceEth, rarity, listedAt, popularity, soldOut, version } = nft
  return { id, name, tokenId, artwork, collection, category, network, priceEth, previousPriceEth, rarity, listedAt, popularity, soldOut, version }
}

function matchesTab(nft: NftDetail, tab: CatalogTab, newestListing: number) {
  if (tab === 'novos') return newestListing - new Date(nft.listedAt).getTime() <= NEW_WINDOW_MS
  if (tab === 'em-alta') return nft.popularity >= TRENDING_POPULARITY
  return true
}

const SORTERS: Record<CatalogSort, (a: NftDetail, b: NftDetail) => number> = {
  recentes: (a, b) => b.listedAt.localeCompare(a.listedAt) || a.id.localeCompare(b.id),
  'preco-asc': (a, b) => eth.cmp(a.priceEth, b.priceEth) || a.id.localeCompare(b.id),
  'preco-desc': (a, b) => eth.cmp(b.priceEth, a.priceEth) || a.id.localeCompare(b.id),
  populares: (a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id),
}

function parseList<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  return params
    .getAll(key)
    .flatMap((v) => v.split(','))
    .filter((v): v is T => (allowed as readonly string[]).includes(v))
}

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    handle(({ request }) => {
      const params = new URL(request.url).searchParams
      const q = params.get('q')?.trim().toLowerCase() ?? ''
      const tab = (params.get('tab') as CatalogTab) || 'todos'
      const categories = parseList<CategoryId>(params, 'categories', CATEGORIES.map((c) => c.id))
      const networks = parseList<Network>(params, 'networks', NETWORKS.map((n) => n.id))
      const minPrice = params.get('minPrice')
      const maxPrice = params.get('maxPrice')
      const sort = (params.get('sort') as CatalogSort) in SORTERS ? (params.get('sort') as CatalogSort) : 'recentes'
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('pageSize')) || DEFAULT_PAGE_SIZE))
      const page = Math.max(1, Math.floor(Number(params.get('page')) || 1))

      for (const value of [minPrice, maxPrice]) {
        if (value && !eth.isValid(value)) fail(400, 'VALIDATION_ERROR', 'Faixa de preço inválida.')
      }

      const all = getScenario().emptyCatalog ? [] : db().nfts
      const newest = Math.max(0, ...all.map((n) => new Date(n.listedAt).getTime()))

      // Base para facetas: busca + aba (as contagens não zeram o próprio grupo).
      const base = all.filter(
        (nft) =>
          matchesTab(nft, tab, newest) &&
          (!q || `${nft.name} ${nft.collection} ${nft.creator}`.toLowerCase().includes(q)),
      )
      const inPrice = (nft: NftDetail) =>
        (!minPrice || eth.cmp(nft.priceEth, minPrice) >= 0) && (!maxPrice || eth.cmp(nft.priceEth, maxPrice) <= 0)

      const filtered = base
        .filter(
          (nft) =>
            (categories.length === 0 || categories.includes(nft.category)) &&
            (networks.length === 0 || networks.includes(nft.network)) &&
            inPrice(nft),
        )
        .sort(SORTERS[sort])

      const total = filtered.length
      const prices = all.map((n) => n.priceEth)
      const body: CatalogResponse = {
        items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        facets: {
          categories: CATEGORIES.map((c) => ({
            ...c,
            count: base.filter((n) => n.category === c.id && (networks.length === 0 || networks.includes(n.network)) && inPrice(n)).length,
          })),
          networks: NETWORKS.map((nw) => ({
            ...nw,
            count: base.filter((n) => n.network === nw.id && (categories.length === 0 || categories.includes(n.category)) && inPrice(n)).length,
          })),
          priceRange: {
            min: prices.length ? prices.reduce((a, b) => eth.min(a, b)) : '0',
            max: prices.length ? prices.reduce((a, b) => eth.max(a, b)) : '0',
          },
        },
      }
      return HttpResponse.json(body)
    }),
  ),

  http.get(
    `${API}/nfts/featured`,
    handle(() => {
      const ids = ['emerald-ape-042', 'ivory-baron-088', 'golden-beat-207']
      const hero = ids.map((id) => findNft(id)).filter((n): n is NftDetail => !!n)
      const spotlight = findNft('sage-nomad-009')
      if (!spotlight) fail(404, 'NOT_FOUND', 'Destaque indisponível.')
      const body: FeaturedResponse = { hero: hero.map(toSummary), spotlight: toSummary(spotlight) }
      return HttpResponse.json(body)
    }),
  ),

  http.get<{ id: string }>(
    `${API}/nfts/:id`,
    handle(({ params }) => {
      const nft = findNft(params.id)
      if (!nft) fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json<NftDetail>(nft)
    }),
  ),

  http.get<{ id: string }>(
    `${API}/nfts/:id/related`,
    handle(({ params }) => {
      const nft = findNft(params.id)
      if (!nft) fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const related = db()
        .nfts.filter((n) => n.id !== nft.id)
        .sort((a, b) => Number(b.collection === nft.collection) - Number(a.collection === nft.collection) || SORTERS.recentes(a, b))
        .slice(0, 8)
        .map(toSummary)
      return HttpResponse.json(related)
    }),
  ),

  http.get(
    `${API}/me/favorites`,
    handle(({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ nftIds: db().favorites[user.id] ?? [] })
    }),
  ),

  http.put<{ id: string }>(
    `${API}/me/favorites/:id`,
    handle(({ request, params }) => {
      const user = requireUser(request)
      if (getScenario().favoritesFail) fail(500, 'INTERNAL_ERROR', 'Não foi possível salvar o favorito.')
      if (!findNft(params.id)) fail(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (db().favorites[user.id] ??= [])
      if (!list.includes(params.id)) list.push(params.id)
      commit()
      return HttpResponse.json({ nftIds: list })
    }),
  ),

  http.delete<{ id: string }>(
    `${API}/me/favorites/:id`,
    handle(({ request, params }) => {
      const user = requireUser(request)
      if (getScenario().favoritesFail) fail(500, 'INTERNAL_ERROR', 'Não foi possível remover o favorito.')
      const list = (db().favorites[user.id] ??= [])
      db().favorites[user.id] = list.filter((id) => id !== params.id)
      commit()
      return HttpResponse.json({ nftIds: db().favorites[user.id] })
    }),
  ),
]
