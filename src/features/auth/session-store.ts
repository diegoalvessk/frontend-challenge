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

let state: SessionState = { session: storage.get<Session>(SESSION_KEY), endedBy: null }
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
    const previous = state.session
    if (previous && previous.user.id !== session.user.id) {
      for (const listener of endListeners) listener('switch', previous)
    }
    storage.set(SESSION_KEY, session)
    setState({ session, endedBy: null })
  },

  update(session: Session) {
    storage.set(SESSION_KEY, session)
    setState({ ...state, session })
  },

  end(reason: SessionEndReason) {
    const previous = state.session
    storage.remove(SESSION_KEY)
    setState({ session: null, endedBy: reason })
    if (previous) for (const listener of endListeners) listener(reason, previous)
  },

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
