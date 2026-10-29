import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { guestCartId, sessionStore } from '@/features/auth/session-store'
import { apiReady } from '@/lib/api-ready'

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'UNKNOWN'

/** Erro normalizado: toda falha de transporte vira um `ApiError` tipado. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ClientErrorCode
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(params: { status: number; code: ClientErrorCode; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.fields = params.fields ?? {}
    this.details = params.details
  }

  /** Falhas transitórias: rede, timeout e 5xx podem ser repetidas com segurança em leituras. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const DEFAULT_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use(async (config) => {
  // Aguarda a API simulada ficar disponível (ver src/lib/api-ready.ts).
  await apiReady
  const token = sessionStore.token()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Cart-Id', guestCartId())
  return config
})

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isCancel(error)) return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' })
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder.' })
    }
    if (!error.response) {
      return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet.' })
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    if (body?.error) {
      return new ApiError({ status: error.response.status, ...body.error })
    }
    return new ApiError({ status: error.response.status, code: 'UNKNOWN', message: 'Erro inesperado.' })
  }
  return new ApiError({ status: 0, code: 'UNKNOWN', message: 'Erro inesperado.' })
}

http.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error)
  // Sessão expirada/inválida durante a navegação: encerra localmente.
  // A interface decide como retomar (ver `SessionWatcher`).
  const sentToken = error instanceof AxiosError && error.config?.headers?.Authorization
  if (sentToken && (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') && sessionStore.token()) {
    sessionStore.end('expired')
  }
  return Promise.reject(apiError)
})

export function isApiError(error: unknown, code?: ClientErrorCode): error is ApiError {
  return error instanceof ApiError && (!code || error.code === code)
}
