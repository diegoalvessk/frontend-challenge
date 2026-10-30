import { createFileRoute } from '@tanstack/react-router'
import { ComingSoon } from '@/components/layout/coming-soon'

export const Route = createFileRoute('/perfil/em-breve/$secao')({
  component: ProfileComingSoon,
})

/** Seções do menu "Meu perfil" fora do escopo: exibidas dentro do layout do perfil, com o menu ainda visível. */
function ProfileComingSoon() {
  const { secao } = Route.useParams()
  return <ComingSoon secao={secao} className="rounded-md bg-card px-6 py-16" />
}
