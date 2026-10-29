import { HttpResponse, delay, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { db, type UserRecord } from './db'
import { getScenario, latencyFor } from './scenarios'

export const API = '/api'

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: { fields?: Record<string, string>; details?: unknown } = {},
) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

/** Lança uma resposta de erro (MSW devolve respostas lançadas pelo resolver). */
export function fail(...args: Parameters<typeof apiError>): never {
  throw apiError(...args)
}

const readAttempts = new Map<string, number>()

/** Zera os contadores de falhas transitórias (usado no reset e na troca de cenário). */
export function resetReadAttempts() {
  readAttempts.clear()
}

/**
 * Envolve um resolver aplicando as condições de rede do cenário ativo:
 * indisponibilidade, latência (determinística por URL) e falhas HTTP transitórias.
 */
export function handle<Params extends PathParams, Body extends DefaultBodyType>(
  resolver: HttpResponseResolver<Params, Body>,
): HttpResponseResolver<Params, Body> {
  return async (info) => {
    const scenario = getScenario()
    const url = new URL(info.request.url)
    const key = `${info.request.method} ${url.pathname}${url.search}`

    if (scenario.offline) {
      await delay(300)
      return HttpResponse.error()
    }

    await delay(latencyFor(key))

    const failures = scenario.readFailures
    if (failures && info.request.method === 'GET' && failures.paths.test(url.pathname)) {
      const attempt = (readAttempts.get(key) ?? 0) + 1
      readAttempts.set(key, attempt)
      if (attempt <= failures.attempts) {
        return apiError(
          failures.status,
          failures.status === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR',
          failures.status === 503 ? 'Serviço temporariamente indisponível.' : 'Erro interno no servidor.',
        )
      }
    }

    try {
      return await resolver(info)
    } catch (error) {
      if (error instanceof Response) return error
      console.error('[mock] erro inesperado no handler', error)
      return apiError(500, 'INTERNAL_ERROR', 'Erro interno no servidor.')
    }
  }
}

function bearer(request: Request) {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/**
 * Resolve o usuário da sessão. Token ausente -> `null`;
 * token expirado ou desconhecido -> 401 (a expiração é sinalizada explicitamente).
 */
export function optionalUser(request: Request): UserRecord | null {
  const token = bearer(request)
  if (!token) return null
  const session = db().sessions[token]
  if (!session) fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    delete db().sessions[token]
    fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db().users.find((u) => u.id === session.userId)
  if (!user) fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  return user
}

export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) fail(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  return user
}

export function currentToken(request: Request) {
  return bearer(request)
}

/** Dono do carrinho: usuário autenticado ou visitante identificado pelo header. */
export function cartOwner(request: Request): { key: string; userId: string | null } {
  const user = optionalUser(request)
  if (user) return { key: `user:${user.id}`, userId: user.id }
  const guestId = request.headers.get('x-guest-cart-id')
  if (!guestId || !/^[a-zA-Z0-9_-]{8,64}$/.test(guestId)) {
    fail(400, 'VALIDATION_ERROR', 'Identificador de carrinho de visitante ausente.')
  }
  return { key: `guest:${guestId}`, userId: null }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    fail(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}
