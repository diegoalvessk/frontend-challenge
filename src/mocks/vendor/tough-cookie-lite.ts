/**
 * Substituto mínimo do `tough-cookie` para o bundle do navegador.
 *
 * O MSW usa o tough-cookie apenas para guardar cookies definidos pelas
 * respostas simuladas. Esta API não usa cookies (a sessão trafega no header
 * Authorization), e o pacote original embute a Public Suffix List inteira
 * (~290 KB; ~120 KB comprimidos), que pesava no carregamento. Mantém a mesma interface usada em
 * `msw/lib/core/utils/cookieStore`: um jar em memória que não retém cookies.
 */
export type SerializedCookie = Record<string, unknown>
export type MemoryCookieStoreIndex = Record<string, Record<string, Record<string, Cookie>>>

export class Cookie {
  static fromJSON(): Cookie | null {
    return null
  }
  toJSON(): SerializedCookie {
    return {}
  }
}

export class MemoryCookieStore {
  idx: MemoryCookieStoreIndex = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {}
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}
