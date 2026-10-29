import Decimal from 'decimal.js'
import type {
  ArtworkId,
  CategoryId,
  EditionId,
  NftDetail,
  NftEdition,
  NftReview,
  Network,
  Wallet,
} from '@/contracts'
import { CATEGORIES } from '@/contracts'

/**
 * Fixtures determinísticas: o mesmo seed sempre gera o mesmo catálogo,
 * o que mantém estáveis os testes E2E e as baselines de regressão visual.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FAMILIES: Record<ArtworkId, { collection: string; names: string[]; attributes: string[] }> = {
  'emerald-ape': {
    collection: 'Kurio Apes',
    names: ['Emerald Ape', 'Jade Rider', 'Forest Crown', 'Mossy Monarch', 'Varsity Ape'],
    attributes: ['Óculos', 'Esmeralda', 'Jaqueta college'],
  },
  'sage-nomad': {
    collection: 'Nomad Club',
    names: ['Sage Nomad', 'Cosmic Bloom', 'Violet Nomad', 'Lilac Drifter', 'Dusk Wanderer'],
    attributes: ['Chapéu bucket', 'Moletom', 'Lilás'],
  },
  'ivory-baron': {
    collection: 'Baron Society',
    names: ['Ivory Baron', 'Neon Vessel', 'Onyx Duke', 'Midnight Envoy', 'Velvet Baron'],
    attributes: ['Gola alta', 'Blazer', 'Brinco'],
  },
  'golden-beat': {
    collection: 'Golden Frequencies',
    names: ['Golden Beat', 'Golden Signal', 'Golden Frequency', 'Amber Pulse', 'Sunset Echo'],
    attributes: ['Headphone', 'Dourado', 'Jaqueta bomber'],
  },
}

const CREATORS = ['Nova Sato', 'Lia Moreau', 'Kenji Arai', 'Duda Ramos', 'Theo Lindqvist']

/** Os 9 itens desenhados no Figma, na ordem em que aparecem na home. */
const FIGMA_ITEMS: Array<{
  name: string
  number: string
  artwork: ArtworkId
  price: string
  previous?: string
  rarity?: 'comum' | 'raro' | 'lendario'
}> = [
  { name: 'Emerald Ape', number: '042', artwork: 'emerald-ape', price: '1.19' },
  { name: 'Sage Nomad', number: '009', artwork: 'sage-nomad', price: '1.69' },
  { name: 'Neon Vessel', number: '552', artwork: 'ivory-baron', price: '1.99', previous: '2.29', rarity: 'raro' },
  { name: 'Cosmic Bloom', number: '118', artwork: 'sage-nomad', price: '1.29' },
  { name: 'Violet Nomad', number: '314', artwork: 'sage-nomad', price: '1.39' },
  { name: 'Ivory Baron', number: '088', artwork: 'ivory-baron', price: '1.79' },
  { name: 'Golden Beat', number: '207', artwork: 'golden-beat', price: '0.99' },
  { name: 'Golden Frequency', number: '071', artwork: 'golden-beat', price: '0.59' },
  { name: 'Golden Signal', number: '160', artwork: 'golden-beat', price: '0.39' },
]

const TOTAL_NFTS = 60
/** Data de referência fixa para `listedAt` (evita dependência do relógio). */
const BASE_DATE = Date.UTC(2026, 9, 20, 12, 0, 0)

const REVIEW_TEXTS = [
  'Arte impecável, os detalhes em alta resolução são incríveis.',
  'Transferência rápida e procedência clara. Recomendo.',
  'Uma das peças favoritas da minha coleção.',
  'Ótimo custo-benefício para uma edição limitada.',
  'Comunidade ativa e criador muito presente.',
]
const REVIEWERS = ['marina.eth', 'colecionador42', 'pixelhunter', 'ape.lover', 'rafa.nft']

function slug(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2).toFixed()
}

function buildEditions(basePrice: string, rand: () => number, index: number): NftEdition[] {
  // Algumas edições começam esgotadas para exercitar "edição indisponível".
  const soldOutOneOfOne = index % 4 === 1
  const lowStock = index % 7 === 3
  const editions: Array<[EditionId, string, number | null, number, Decimal.Value]> = [
    ['1-1', '1/1', 1, soldOutOneOfOne ? 0 : 1, new Decimal(basePrice).times(3)],
    ['1-10', '1/10', 10, lowStock ? 2 : 3 + Math.floor(rand() * 7), new Decimal(basePrice).times(1.5)],
    ['1-50', '1/50', 50, lowStock ? 3 : 12 + Math.floor(rand() * 30), basePrice],
    ['aberta', 'ABERTA', null, 999, new Decimal(basePrice).times(0.6)],
  ]
  return editions.map(([id, label, supply, available, price]) => ({
    id,
    label,
    supply,
    available,
    priceEth: money(price),
  }))
}

function buildReviews(rand: () => number, id: string): NftReview[] {
  const count = 3 + Math.floor(rand() * 3)
  return Array.from({ length: count }, (_, i) => ({
    id: `${id}-review-${i + 1}`,
    author: REVIEWERS[(i + Math.floor(rand() * 5)) % REVIEWERS.length],
    rating: rand() > 0.25 ? 5 : 4,
    comment: REVIEW_TEXTS[(i + Math.floor(rand() * 5)) % REVIEW_TEXTS.length],
    createdAt: new Date(BASE_DATE - (i + 1) * 86_400_000 * (1 + Math.floor(rand() * 9))).toISOString(),
  }))
}

export function createNftFixtures(): NftDetail[] {
  const rand = mulberry32(20261029)
  const artworks = Object.keys(FAMILIES) as ArtworkId[]
  const networks: Network[] = ['ethereum', 'ethereum', 'polygon', 'solana']
  const usedNames = new Set<string>()

  return Array.from({ length: TOTAL_NFTS }, (_, index) => {
    const figma = FIGMA_ITEMS[index]
    let artwork: ArtworkId
    let baseName: string
    let number: string
    let price: string
    if (figma) {
      ;({ artwork, name: baseName, number, price } = figma)
    } else {
      artwork = artworks[Math.floor(rand() * artworks.length)]
      const names = FAMILIES[artwork].names
      do {
        baseName = names[Math.floor(rand() * names.length)]
        number = String(1 + Math.floor(rand() * 899)).padStart(3, '0')
      } while (usedNames.has(`${baseName}#${number}`))
      price = money(0.02 + rand() * rand() * 12.28)
    }
    usedNames.add(`${baseName}#${number}`)

    const family = FAMILIES[artwork]
    const name = `${baseName} #${number}`
    const id = slug(`${baseName}-${number}`)
    const category = figma
      ? (['arte-digital', 'colecionaveis', 'arte-digital', 'generativa', 'arte-digital', 'colecionaveis', 'musica', 'musica', 'musica'] as CategoryId[])[index]
      : CATEGORIES[Math.floor(rand() * CATEGORIES.length)].id
    const network = figma ? 'ethereum' : networks[Math.floor(rand() * networks.length)]
    const creator = CREATORS[index % CREATORS.length]
    const editions = buildEditions(price, rand, index)
    const reviews = buildReviews(rand, id)
    const rarity = figma?.rarity ?? (rand() > 0.85 ? 'raro' : rand() > 0.97 ? 'lendario' : 'comum')
    const networkLabel = network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'

    return {
      id,
      name,
      tokenId: `#${number.padStart(4, '0')}`,
      artwork,
      collection: family.collection,
      category,
      network,
      priceEth: price,
      previousPriceEth: figma?.previous ?? (index > 9 && index % 11 === 0 ? money(new Decimal(price).times(1.15)) : null),
      rarity,
      // Itens do Figma são os mais recentes; os demais ficam espaçados no passado.
      listedAt: new Date(BASE_DATE - index * 3_600_000 * 13).toISOString(),
      popularity: Math.floor(rand() * 1000),
      soldOut: false,
      version: 1,
      description: `Um colecionável digital finalizado à mão da coleção ${family.collection}, verificado na ${networkLabel}, com arte desbloqueável e acesso para colecionadores.`,
      story: [
        `${name} é uma obra digital finalizada à mão da coleção ${family.collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${networkLabel}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
        `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator} recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
      ],
      creator,
      attributes: [...family.attributes.slice(0, 2), rarity === 'comum' ? 'Comum' : rarity === 'raro' ? 'Raro' : 'Lendário'],
      contractAddress: `0x7A42${id.length.toString(16).toUpperCase()}${number}…19E8`,
      royaltyPercent: 5,
      rating: Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10,
      reviewCount: 12 + Math.floor(rand() * 30),
      reviews,
      editions,
      maxPerOrder: 10,
    }
  })
}

export interface UserFixture {
  id: string
  username: string
  displayName: string
  email: string
  password: string
  ensName: string
  walletNickname: string
  favorites: string[]
  wallets: Array<Omit<Wallet, 'updatedAt'>>
}

/** Credenciais fictícias documentadas no README. */
export const USER_FIXTURES: UserFixture[] = [
  {
    id: 'usr_ana',
    username: 'ana.kurio',
    displayName: 'Ana Colecionadora',
    email: 'ana@kurio.dev',
    password: 'Kurio@2026',
    ensName: 'anakurio',
    walletNickname: 'Cofre principal',
    favorites: ['emerald-ape-042', 'golden-beat-207'],
    wallets: [
      {
        id: 'wal_ana_primary',
        slot: 'primary',
        displayName: 'Ana Colecionadora',
        nickname: 'Cofre principal',
        network: 'ethereum',
        profileName: 'ana-colecao',
        address: '0xA91F3c2B7d4E5f60718293aB4c5D6e7F8091E82C',
        altAddress: '',
        provider: 'metamask',
        referralCode: 'KURIO-ANA',
        email: 'ana@kurio.dev',
        ensName: 'anakurio',
      },
    ],
  },
  {
    id: 'usr_bruno',
    username: 'bruno.holder',
    displayName: 'Bruno Holder',
    email: 'bruno@kurio.dev',
    password: 'Kurio@2026',
    ensName: 'brunoholder',
    walletNickname: '',
    favorites: [],
    wallets: [],
  },
]

export interface CouponFixture {
  code: string
  description: string
  percent: number
  expiresAt: string
}

export const COUPON_FIXTURES: CouponFixture[] = [
  { code: 'KURIO10', description: '10% de desconto no lançamento', percent: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'GENESIS25', description: '25% de desconto para colecionadores gênesis', percent: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'VERAO2025', description: '15% de desconto de verão', percent: 15, expiresAt: '2025-03-20T23:59:59.000Z' },
]

/** Taxa de rede estimada por rede (em ETH). */
export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}
