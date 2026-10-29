import type {
  AddCartItemRequest,
  Cart,
  CatalogQuery,
  CatalogResponse,
  CreateOrderRequest,
  EditionId,
  FeaturedResponse,
  LoginRequest,
  Network,
  NftDetail,
  NftSummary,
  Order,
  PasswordChange,
  Profile,
  ProfileUpdate,
  Quote,
  RegisterRequest,
  Session,
  Wallet,
  WalletConnection,
  WalletInput,
  WalletSlot,
  WalletsResponse,
} from '@/contracts'
import { http } from './client'

/**
 * Funções de acesso à API REST, uma por operação dos contratos.
 * Leituras aceitam `AbortSignal` para que o TanStack Query cancele
 * requisições obsoletas (ex.: digitação rápida na busca).
 */

type Signal = { signal?: AbortSignal }

export function catalogParams(query: CatalogQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.tab && query.tab !== 'todos') params.set('tab', query.tab)
  if (query.categories?.length) params.set('categories', query.categories.join(','))
  if (query.networks?.length) params.set('networks', query.networks.join(','))
  if (query.minPrice) params.set('minPrice', query.minPrice)
  if (query.maxPrice) params.set('maxPrice', query.maxPrice)
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  return params
}

export const authApi = {
  login: (body: LoginRequest) => http.post<Session>('/auth/login', body).then((r) => r.data),
  register: (body: RegisterRequest) => http.post<Session>('/auth/register', body).then((r) => r.data),
  session: ({ signal }: Signal = {}) => http.get<Session>('/auth/session', { signal }).then((r) => r.data),
  logout: () => http.post('/auth/logout').then(() => undefined),
}

export const catalogApi = {
  list: (query: CatalogQuery, { signal }: Signal = {}) =>
    http.get<CatalogResponse>('/nfts', { params: catalogParams(query), signal }).then((r) => r.data),
  featured: ({ signal }: Signal = {}) => http.get<FeaturedResponse>('/nfts/featured', { signal }).then((r) => r.data),
  detail: (id: string, { signal }: Signal = {}) =>
    http.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
  related: (id: string, { signal }: Signal = {}) =>
    http.get<NftSummary[]>(`/nfts/${encodeURIComponent(id)}/related`, { signal }).then((r) => r.data),
}

export const favoritesApi = {
  list: ({ signal }: Signal = {}) => http.get<{ nftIds: string[] }>('/me/favorites', { signal }).then((r) => r.data),
  add: (nftId: string) => http.put<{ nftIds: string[] }>(`/me/favorites/${encodeURIComponent(nftId)}`).then((r) => r.data),
  remove: (nftId: string) => http.delete<{ nftIds: string[] }>(`/me/favorites/${encodeURIComponent(nftId)}`).then((r) => r.data),
}

const itemPath = (nftId: string, editionId: EditionId) => `/cart/items/${encodeURIComponent(nftId)}/${editionId}`

export const cartApi = {
  get: (network: Network | undefined, { signal }: Signal = {}) =>
    http.get<Cart>('/cart', { params: network ? { network } : undefined, signal }).then((r) => r.data),
  add: (body: AddCartItemRequest) => http.post<Cart>('/cart/items', body).then((r) => r.data),
  update: (nftId: string, editionId: EditionId, quantity: number) =>
    http.patch<Cart>(itemPath(nftId, editionId), { quantity }).then((r) => r.data),
  remove: (nftId: string, editionId: EditionId) => http.delete<Cart>(itemPath(nftId, editionId)).then((r) => r.data),
  acknowledge: () => http.post<Cart>('/cart/acknowledge').then((r) => r.data),
  applyCoupon: (code: string) => http.post<Cart>('/cart/coupon', { code }).then((r) => r.data),
  removeCoupon: () => http.delete<Cart>('/cart/coupon').then((r) => r.data),
  merge: () => http.post<Cart>('/cart/merge').then((r) => r.data),
}

/** Tempo máximo de espera pela criação do pedido antes de tratar como timeout. */
export const ORDER_TIMEOUT_MS = 8_000

export const checkoutApi = {
  quote: (network: Network) => http.post<Quote>('/checkout/quote', { network }).then((r) => r.data),
  connectWallet: (walletId: string, network: Network) =>
    http.post<WalletConnection>('/wallets/connect', { walletId, network }).then((r) => r.data),
  disconnectWallet: () => http.delete('/wallets/connection').then(() => undefined),
}

export const ordersApi = {
  /** Criação idempotente: reenviar a mesma chave com o mesmo corpo recupera o mesmo pedido. */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    http
      .post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: ORDER_TIMEOUT_MS })
      .then((r) => r.data),
  get: (id: string, { signal }: Signal = {}) => http.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.data),
  list: (status: Order['status'] | undefined, { signal }: Signal = {}) =>
    http.get<Order[]>('/orders', { params: status ? { status } : undefined, signal }).then((r) => r.data),
}

export const profileApi = {
  get: ({ signal }: Signal = {}) => http.get<Profile>('/me/profile', { signal }).then((r) => r.data),
  update: (body: ProfileUpdate) => http.patch<Profile>('/me/profile', body).then((r) => r.data),
  setAvatar: (dataUrl: string) => http.put<Profile>('/me/avatar', { dataUrl }).then((r) => r.data),
  removeAvatar: () => http.delete<Profile>('/me/avatar').then((r) => r.data),
  changePassword: (body: PasswordChange) => http.post('/me/password', body).then(() => undefined),
}

export const walletsApi = {
  list: ({ signal }: Signal = {}) => http.get<WalletsResponse>('/me/wallets', { signal }).then((r) => r.data),
  save: (slot: WalletSlot, body: WalletInput) => http.put<Wallet>(`/me/wallets/${slot}`, body).then((r) => r.data),
  removeSecondary: () => http.delete('/me/wallets/secondary').then(() => undefined),
}
