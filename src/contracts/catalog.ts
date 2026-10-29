import type { EthAmount, IsoDateTime, Network, Paginated } from './common'

export type CategoryId =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
]

/** Identificador da arte (arquivo em /public/nfts). */
export type ArtworkId = 'emerald-ape' | 'sage-nomad' | 'ivory-baron' | 'golden-beat'

export type EditionId = '1-1' | '1-10' | '1-50' | 'aberta'

export interface NftEdition {
  id: EditionId
  label: string
  /** Tiragem total; `null` para edição aberta. */
  supply: number | null
  /** Unidades ainda disponíveis para compra. */
  available: number
  priceEth: EthAmount
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  artwork: ArtworkId
  collection: string
  category: CategoryId
  network: Network
  /** Preço da edição padrão (menor preço disponível). */
  priceEth: EthAmount
  /** Preço anterior, exibido riscado quando houver redução. */
  previousPriceEth: EthAmount | null
  rarity: 'comum' | 'raro' | 'lendario'
  listedAt: IsoDateTime
  popularity: number
  /** `true` quando nenhuma edição tem unidades disponíveis. */
  soldOut: boolean
  /** Versão do recurso; incrementada a cada alteração (usada pelos eventos). */
  version: number
}

export interface NftReview {
  id: string
  author: string
  rating: number
  comment: string
  createdAt: IsoDateTime
}

export interface NftDetail extends NftSummary {
  description: string
  story: string[]
  creator: string
  attributes: string[]
  contractAddress: string
  royaltyPercent: number
  rating: number
  reviewCount: number
  reviews: NftReview[]
  editions: NftEdition[]
  /** Limite de unidades por pedido, independente da disponibilidade. */
  maxPerOrder: number
}

export type CatalogTab = 'todos' | 'novos' | 'em-alta'

export type CatalogSort = 'recentes' | 'preco-asc' | 'preco-desc' | 'populares'

export const CATALOG_SORTS: ReadonlyArray<{ id: CatalogSort; label: string }> = [
  { id: 'recentes', label: 'Listados recentemente' },
  { id: 'preco-asc', label: 'Menor preço' },
  { id: 'preco-desc', label: 'Maior preço' },
  { id: 'populares', label: 'Mais populares' },
]

/** Parâmetros aceitos por `GET /api/nfts` (todos opcionais). */
export interface CatalogQuery {
  q?: string
  tab?: CatalogTab
  categories?: CategoryId[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface FacetCount<T extends string> {
  id: T
  label: string
  count: number
}

export interface CatalogResponse extends Paginated<NftSummary> {
  facets: {
    categories: FacetCount<CategoryId>[]
    networks: FacetCount<Network>[]
    priceRange: { min: EthAmount; max: EthAmount }
  }
}

/** Destaques exibidos no topo da home. */
export interface FeaturedResponse {
  hero: NftSummary[]
  spotlight: NftSummary
}
