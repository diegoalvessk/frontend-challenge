import { redirect, type ParsedLocation } from '@tanstack/react-router'
import { sessionStore } from './session-store'

/**
 * Guarda das rotas privadas (checkout, pedidos, perfil, carteiras).
 * Sem sessão, leva ao login preservando o destino para retomada.
 */
export function requireAuth({ location }: { location: ParsedLocation }) {
  if (!sessionStore.token()) {
    throw redirect({ to: '/entrar', search: { redirect: location.href, motivo: 'protegida' } })
  }
}
