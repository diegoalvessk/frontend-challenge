import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authApi, cartApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import type { LoginRequest, RegisterRequest, Session } from '@/contracts'
import { announce } from '@/lib/announcer'
import { sessionStore, useSession, useSessionState } from './session-store'

/** Rotas que exigem autenticação (usadas para decidir o redirecionamento na expiração). */
const PRIVATE_PATHS = [/^\/pagamento/, /^\/pedidos/, /^\/perfil/]

/**
 * Após autenticar: incorpora o carrinho do visitante ao do usuário e
 * descarta o cache do carrinho anônimo.
 */
async function afterAuthenticated(session: Session, queryClient: ReturnType<typeof useQueryClient>) {
  sessionStore.start(session)
  try {
    const cart = await cartApi.merge()
    queryClient.setQueryData(queryKeys.cart(`user:${session.user.id}`, cart.summary.network), cart)
  } catch {
    // O carrinho será recarregado normalmente; a sessão já está ativa.
  }
  queryClient.removeQueries({ queryKey: queryKeys.cartAll, predicate: (q) => String(q.queryKey[1]).startsWith('guest:') })
  void queryClient.invalidateQueries({ queryKey: queryKeys.cartAll })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: async (session) => {
      await afterAuthenticated(session, queryClient)
      announce(`Bem-vindo de volta, ${session.user.displayName}.`)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: async (session) => {
      await afterAuthenticated(session, queryClient)
      announce('Conta criada com sucesso.')
    },
  })
}

export function useLogout() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        // Mesmo com falha de rede a sessão local é encerrada.
      }
    },
    onSettled: () => {
      sessionStore.end('logout')
      toast.success('Você saiu da sua conta.')
      announce('Você saiu da sua conta.')
      void navigate({ to: '/' })
    },
  })
}

/**
 * Ciclo de vida da sessão (montado uma vez na raiz):
 * - valida a sessão persistida ao carregar (recuperação após refresh);
 * - ao encerrar (logout/expiração/troca), descarta o cache privado do usuário;
 * - na expiração, leva ao login preservando a rota para retomada.
 */
export function useSessionLifecycle() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const session = useSession()
  const { endedBy } = useSessionState()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useQuery({
    queryKey: [...queryKeys.session, session?.token],
    queryFn: async ({ signal }) => {
      const fresh = await authApi.session({ signal })
      sessionStore.update(fresh)
      return fresh
    },
    enabled: !!session,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  })

  useEffect(
    () =>
      sessionStore.onEnd((_reason, previous) => {
        queryClient.removeQueries({ queryKey: queryKeys.user(previous.user.id) })
        queryClient.removeQueries({ queryKey: ['cart', `user:${previous.user.id}`] })
        queryClient.removeQueries({ queryKey: queryKeys.session })
      }),
    [queryClient],
  )

  useEffect(() => {
    if (endedBy !== 'expired') return
    sessionStore.clearEndReason()
    const message = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
    toast.warning(message)
    announce(message)
    if (PRIVATE_PATHS.some((re) => re.test(pathname))) {
      const current = router.state.location
      void router.navigate({ to: '/entrar', search: { redirect: current.href, motivo: 'expirada' } })
    }
  }, [endedBy, pathname, router])
}
