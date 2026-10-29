import type { EditionId, NftDetail, Order, Quote, Wallet, WalletConnection } from '@/contracts'
import { USER_FIXTURES, createNftFixtures } from './fixtures'

/**
 * "Banco de dados" da API simulada. Vive na thread principal (junto aos
 * handlers MSW) e é persistido em localStorage para sobreviver a refresh.
 * Toda mutação passa por `commit()`, que persiste e notifica os assinantes
 * (o servidor Socket.IO simulado transforma isso em eventos).
 */

export interface UserRecord {
  id: string
  username: string
  displayName: string
  email: string
  /** SHA-256(salt + senha) em hex: senhas nunca são armazenadas em claro. */
  passwordHash: string
  salt: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  updatedAt: string
}

export interface CartRecord {
  id: string
  lines: Array<{ nftId: string; editionId: EditionId; quantity: number; acknowledgedPriceEth: string }>
  couponCode: string | null
  updatedAt: string
}

export interface QuoteRecord {
  ownerKey: string
  userId: string
  quote: Quote
}

export interface OrderRecord extends Order {
  userId: string
  /** Momento em que o pedido pendente será liquidado (sobrevive a refresh). */
  settleAt: string
  bodyHash: string
}

export interface DbState {
  schema: 1
  nfts: NftDetail[]
  users: UserRecord[]
  sessions: Record<string, { userId: string; expiresAt: string }>
  favorites: Record<string, string[]>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  /** Chave: `user:<id>` ou `guest:<cartId>`. */
  carts: Record<string, CartRecord>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  /** Chave: `<userId>:<Idempotency-Key>`. */
  idempotency: Record<string, { orderId: string; bodyHash: string }>
  walletConnections: Record<string, WalletConnection | null>
  /** Chaves de idempotência cuja resposta já foi atrasada (cenário de timeout). */
  delayedOrderKeys: string[]
  seq: number
}

export type DbChange =
  | { kind: 'nft'; nft: NftDetail }
  | { kind: 'order'; order: OrderRecord }
  | { kind: 'reset' }

export const DB_STORAGE_KEY = 'kurio.mock.db.v1'

let state: DbState | null = null
const listeners = new Set<(change: DbChange) => void>()

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

async function createSeed(): Promise<DbState> {
  const now = new Date().toISOString()
  const users: UserRecord[] = []
  const favorites: DbState['favorites'] = {}
  const wallets: DbState['wallets'] = {}
  for (const fixture of USER_FIXTURES) {
    const salt = `seed-${fixture.id}`
    users.push({
      id: fixture.id,
      username: fixture.username,
      displayName: fixture.displayName,
      email: fixture.email,
      passwordHash: await sha256(salt + fixture.password),
      salt,
      ensName: fixture.ensName,
      walletNickname: fixture.walletNickname,
      avatarUrl: null,
      updatedAt: now,
    })
    favorites[fixture.id] = [...fixture.favorites]
    const primary = fixture.wallets.find((w) => w.slot === 'primary')
    const secondary = fixture.wallets.find((w) => w.slot === 'secondary')
    wallets[fixture.id] = {
      primary: primary ? { ...primary, updatedAt: now } : null,
      secondary: secondary ? { ...secondary, updatedAt: now } : null,
    }
  }
  return {
    schema: 1,
    nfts: createNftFixtures(),
    users,
    sessions: {},
    favorites,
    wallets,
    carts: {},
    quotes: {},
    orders: {},
    idempotency: {},
    walletConnections: {},
    delayedOrderKeys: [],
    seq: 0,
  }
}

export async function initDb() {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === 1) {
        state = parsed
        return
      }
    }
  } catch {
    /* dados corrompidos: recria a partir do seed */
  }
  state = await createSeed()
  persist()
}

/** Restaura integralmente o cenário conhecido (seed). */
export async function resetDb() {
  state = await createSeed()
  persist()
  emit({ kind: 'reset' })
}

export function db(): DbState {
  if (!state) throw new Error('Mock DB não inicializado')
  return state
}

function persist() {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota excedida ou storage bloqueado: segue em memória */
  }
}

function emit(change: DbChange) {
  for (const listener of listeners) listener(change)
}

/** Persiste o estado e notifica as mudanças (publicadas como eventos Socket.IO). */
export function commit(...changes: DbChange[]) {
  persist()
  for (const change of changes) emit(change)
}

export function subscribe(listener: (change: DbChange) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function nextSeq() {
  return ++db().seq
}

export function findNft(id: string) {
  return db().nfts.find((nft) => nft.id === id)
}

/** Recalcula os campos derivados do NFT e incrementa a versão. */
export function touchNft(nft: NftDetail) {
  nft.soldOut = nft.editions.every((e) => e.available === 0)
  nft.priceEth = nft.editions.find((e) => e.id === '1-50')?.priceEth ?? nft.priceEth
  nft.version += 1
}
