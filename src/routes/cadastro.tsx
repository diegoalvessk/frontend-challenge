import { createFileRoute, redirect } from '@tanstack/react-router'
import { authSearchSchema } from '@/features/auth/auth-search'
import { AuthScreen } from '@/features/auth/auth-screen'
import { sessionStore } from '@/features/auth/session-store'

export const Route = createFileRoute('/cadastro')({
  validateSearch: authSearchSchema,
  // Já autenticado: segue direto para o destino.
  beforeLoad: ({ search }) => {
    if (sessionStore.token()) throw redirect({ to: search.redirect ?? '/', replace: true })
  },
  component: function Page() {
    return <AuthScreen mode="register" search={Route.useSearch()} />
  },
})
