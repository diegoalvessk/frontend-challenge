import type { CreateOrderRequest } from '@/contracts'
import { randomKey, storage } from '@/lib/storage'

/**
 * Tentativa de compra persistida (por usuário). Guarda a chave de
 * idempotência e o corpo enviado: após timeout, queda de conexão ou refresh,
 * o reenvio usa exatamente a mesma chave e o servidor devolve o MESMO pedido.
 */
export interface CheckoutAttempt {
  idempotencyKey: string
  body: CreateOrderRequest
  orderId: string | null
  createdAt: string
}

const key = (userId: string) => `checkout-attempt.${userId}`

export const attemptStore = {
  get: (userId: string) => storage.get<CheckoutAttempt>(key(userId)),

  /** Reaproveita a tentativa se o corpo for idêntico; senão cria uma nova chave. */
  begin(userId: string, body: CreateOrderRequest): CheckoutAttempt {
    const current = attemptStore.get(userId)
    if (current && !current.orderId && JSON.stringify(current.body) === JSON.stringify(body)) return current
    const attempt: CheckoutAttempt = { idempotencyKey: randomKey('idem_'), body, orderId: null, createdAt: new Date().toISOString() }
    storage.set(key(userId), attempt)
    return attempt
  },

  setOrder(userId: string, orderId: string) {
    const current = attemptStore.get(userId)
    if (current) storage.set(key(userId), { ...current, orderId })
  },

  clear(userId: string) {
    storage.remove(key(userId))
  },
}

/** Rascunho do formulário de pagamento (retomada após expiração de sessão). */
export const draftStore = {
  get: <T>(userId: string) => storage.get<T>(`checkout-draft.${userId}`, sessionStorage),
  set: (userId: string, value: unknown) => storage.set(`checkout-draft.${userId}`, value, sessionStorage),
  clear: (userId: string) => storage.remove(`checkout-draft.${userId}`, sessionStorage),
}
