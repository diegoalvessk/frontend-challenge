/**
 * Cenários determinísticos da API simulada. Selecionáveis por:
 *  - URL: `?scenario=<id>` (persistido para os próximos carregamentos);
 *  - painel de mocks (botão flutuante no app);
 *  - testes: `localStorage['kurio.mock.scenario']` ou `window.__KURIO_MOCK__.setScenario()`.
 */

export type ScenarioId =
  | 'default'
  | 'slow'
  | 'variable-latency'
  | 'offline'
  | 'server-error'
  | 'flaky'
  | 'empty'
  | 'favorites-fail'
  | 'session-short'
  | 'wallet-reject'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'

export interface ScenarioConfig {
  id: ScenarioId
  label: string
  description: string
  /** Latência das respostas REST; com min != max o valor é derivado da URL (determinístico). */
  latency: { min: number; max: number }
  /** Todas as requisições falham na camada de rede e o socket não conecta. */
  offline?: boolean
  /** Falha (HTTP status) nas N primeiras tentativas de cada URL de leitura. */
  readFailures?: { status: 500 | 503; attempts: number; paths: RegExp }
  emptyCatalog?: boolean
  favoritesFail?: boolean
  sessionTtlSeconds?: number
  walletReject?: boolean
  /** Após criar a cotação do checkout, o preço do 1º item muda via evento. */
  priceChangeAfterQuoteMs?: number
  /** Ao confirmar a compra, a edição do 1º item esgota antes da validação. */
  soldOutOnOrder?: boolean
  /** A 1ª tentativa de criar pedido cria o pedido mas a resposta excede o timeout do cliente. */
  orderResponseDelayMs?: number
  paymentDeclined?: boolean
  /** Tempo até o pedido pendente ser liquidado. */
  settleDelayMs: number
}

const base = { latency: { min: 120, max: 120 }, settleDelayMs: 3000 }

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  default: {
    ...base,
    id: 'default',
    label: 'Padrão',
    description: 'Respostas de sucesso com latência curta.',
  },
  slow: {
    ...base,
    id: 'slow',
    label: 'Rede lenta',
    description: 'Todas as respostas levam ~2,5 s (exibe skeletons).',
    latency: { min: 2500, max: 2500 },
  },
  'variable-latency': {
    ...base,
    id: 'variable-latency',
    label: 'Latência variável',
    description: 'Latência entre 100 ms e 2,5 s derivada da URL: respostas chegam fora de ordem.',
    latency: { min: 100, max: 2500 },
  },
  offline: {
    ...base,
    id: 'offline',
    label: 'Sem conexão',
    description: 'Requisições falham na camada de rede e o socket não conecta.',
    offline: true,
  },
  'server-error': {
    ...base,
    id: 'server-error',
    label: 'Erro 500 no catálogo',
    description: 'Catálogo e detalhe falham 3 vezes por URL (esgotando os retries) e depois se recuperam.',
    readFailures: { status: 500, attempts: 3, paths: /^\/api\/nfts/ },
  },
  flaky: {
    ...base,
    id: 'flaky',
    label: 'Falha transitória',
    description: 'A 1ª leitura de cada URL retorna 503; o retry automático recupera.',
    readFailures: { status: 503, attempts: 1, paths: /^\/api\// },
  },
  empty: {
    ...base,
    id: 'empty',
    label: 'Catálogo vazio',
    description: 'A listagem de NFTs retorna zero resultados.',
    emptyCatalog: true,
  },
  'favorites-fail': {
    ...base,
    id: 'favorites-fail',
    label: 'Falha ao favoritar',
    description: 'Incluir/remover favorito retorna 500 (rollback otimista).',
    favoritesFail: true,
  },
  'session-short': {
    ...base,
    id: 'session-short',
    label: 'Sessão curta',
    description: 'Sessões expiram 45 s após o login.',
    sessionTtlSeconds: 45,
  },
  'wallet-reject': {
    ...base,
    id: 'wallet-reject',
    label: 'Carteira recusa conexão',
    description: 'A conexão da carteira no checkout é recusada pelo usuário.',
    walletReject: true,
  },
  'price-change': {
    ...base,
    id: 'price-change',
    label: 'Preço muda no checkout',
    description: '4 s após abrir o pagamento, o preço do 1º item sobe via nft.updated.',
    priceChangeAfterQuoteMs: 4000,
  },
  'sold-out': {
    ...base,
    id: 'sold-out',
    label: 'Edição esgota na compra',
    description: 'Ao confirmar, a edição do 1º item esgota e o pedido é rejeitado por conflito.',
    soldOutOnOrder: true,
  },
  'order-timeout': {
    ...base,
    id: 'order-timeout',
    label: 'Timeout no pedido',
    description: 'O pedido é criado, mas a 1ª resposta excede o timeout; o reenvio recupera o mesmo pedido.',
    orderResponseDelayMs: 12_000,
  },
  'payment-declined': {
    ...base,
    id: 'payment-declined',
    label: 'Pagamento recusado',
    description: 'O pedido fica pendente e depois é recusado.',
    paymentDeclined: true,
  },
}

export const SCENARIO_STORAGE_KEY = 'kurio.mock.scenario'

let current: ScenarioConfig = SCENARIOS.default

export function getScenario(): ScenarioConfig {
  return current
}

export function setScenario(id: ScenarioId) {
  current = SCENARIOS[id] ?? SCENARIOS.default
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, current.id)
  } catch {
    /* armazenamento indisponível: mantém só em memória */
  }
}

/** Lê o cenário da URL (prioridade) ou do armazenamento local. */
export function initScenario() {
  const fromUrl = new URLSearchParams(location.search).get('scenario') as ScenarioId | null
  let stored: ScenarioId | null = null
  try {
    stored = localStorage.getItem(SCENARIO_STORAGE_KEY) as ScenarioId | null
  } catch {
    /* ignore */
  }
  const id = fromUrl && fromUrl in SCENARIOS ? fromUrl : stored && stored in SCENARIOS ? stored : 'default'
  setScenario(id)
}

/** Hash FNV-1a: latência "aleatória" porém reproduzível para a mesma URL. */
function hash(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function latencyFor(key: string): number {
  const { min, max } = current.latency
  if (min === max) return min
  return min + (hash(key) % (max - min + 1))
}
