/**
 * Acesso seguro ao Web Storage: falhas (modo privado, quota, bloqueio) nunca
 * quebram a aplicação. Todas as chaves usam o prefixo `kurio.app.`, que o
 * reset dos mocks limpa por completo.
 */
const PREFIX = 'kurio.app.'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const storage = {
  get<T>(key: string, area: Storage = localStorage): T | null {
    return safe(() => {
      const raw = area.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : null
    }, null)
  },
  set(key: string, value: unknown, area: Storage = localStorage) {
    safe(() => area.setItem(PREFIX + key, JSON.stringify(value)), undefined)
  },
  remove(key: string, area: Storage = localStorage) {
    safe(() => area.removeItem(PREFIX + key), undefined)
  },
}

export function randomKey(prefix = '') {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return prefix + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
