import { useSyncExternalStore } from 'react'

/**
 * Região ARIA live global: mutations e alterações em tempo real são anunciadas
 * para leitores de tela, além do feedback visual (toasts/banners).
 */
let message = ''
let counter = 0
const listeners = new Set<() => void>()

export function announce(text: string) {
  // Alterna um sufixo invisível para que mensagens repetidas sejam relidas.
  counter += 1
  message = counter % 2 ? text : `${text}​`
  for (const l of listeners) l()
}

export function useAnnouncement() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => message,
  )
}
