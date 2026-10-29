import { useSyncExternalStore } from 'react'
import type { Session } from '@/contracts'
import { randomKey, storage } from '@/lib/storage'

/**
 * Fonte única da sessão no cliente. O token fica em localStorage para que a
 * sessão sobreviva a refresh; a validade é sempre confirmada pela API
 * (`GET /auth/session`) e qualquer 401 encerra a sessão local.
 */

export type SessionEndReason = 'logout' | 'expired' | 'switch'

interface SessionState {
  session: Session | null
  /** Motivo do último encerramento (para avisar o usuário). */
  endedBy: SessionEndReason | null
}

const SESSION_KEY = 'session'
const GUEST_CART_KEY = 'guest-cart-id'
/** Motivo do último encerramento, mantido na aba para sobreviver a um reload. */
const ENDED_KEY = 'session-ended'

/** Confere o formato antes de confiar em dados persistidos ou recebidos. */
function isSession(value: unknown): value is Session {
  const s = value as Session | null
  return !!s && typeof s === 'object' && typeof s.token === 'string' && typeof s.expiresAt === 'string' && !!s.user && typeof s.user.id === 'string'
}

function readStoredSession(): Session | null {
  const stored = storage.get<unknown>(SESSION_KEY)
  if (stored !== null && !isSession(stored)) {
    // Dado corrompido (ex.: versão antiga): descarta e segue como visitante.
    storage.remove(SESSION_KEY)
    return null
  }
  return stored
}

let state: SessionState = { session: readStoredSession(), endedBy: null }
const listeners = new Set<() => void>()
const endListeners = new Set<(reason: SessionEndReason, previous: Session) => void>()

function setState(next: SessionState) {
  state = next
  for (const listener of listeners) listener()
}

export const sessionStore = {
  get: () => state,
  token: () => state.session?.token ?? null,
  userId: () => state.session?.user.id ?? null,

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  /** Notificado sempre que uma sessão termina (limpeza de cache e sockets). */
  onEnd(listener: (reason: SessionEndReason, previous: Session) => void) {
    endListeners.add(listener)
    return () => {
      endListeners.delete(listener)
    }
  },

  start(session: Session) {
    if (!isSession(session)) return
    const previous = state.session
    if (previous && previous.user.id !== session.user.id) {
      for (const listener of endListeners) listener('switch', previous)
    }
    storage.set(SESSION_KEY, session)
    storage.remove(ENDED_KEY, sessionStorage)
    setState({ session, endedBy: null })
  },

  update(session: Session) {
    if (!isSession(session)) return
    storage.set(SESSION_KEY, session)
    setState({ ...state, session })
  },

  end(reason: SessionEndReason) {
    const previous = state.session
    storage.remove(SESSION_KEY)
    storage.set(ENDED_KEY, reason, sessionStorage)
    setState({ session: null, endedBy: reason })
    if (previous) for (const listener of endListeners) listener(reason, previous)
  },

  /** Motivo do último encerramento nesta aba (inclusive antes de um reload). */
  lastEndReason: () => state.endedBy ?? storage.get<SessionEndReason>(ENDED_KEY, sessionStorage),

  clearEndReason() {
    if (state.endedBy) setState({ ...state, endedBy: null })
  },
}

/** Identificador do carrinho do visitante (enviado no header X-Guest-Cart-Id). */
export function guestCartId() {
  let id = storage.get<string>(GUEST_CART_KEY)
  if (!id) {
    id = randomKey('guest_')
    storage.set(GUEST_CART_KEY, id)
  }
  return id
}

export function resetGuestCartId() {
  storage.remove(GUEST_CART_KEY)
}

export function useSessionState() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

export function useSession() {
  return useSessionState().session
}
