import { Link, createFileRoute } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { Container } from '@/components/layout/page'

const TITLES: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  colecao: 'Minha coleção',
  atividade: 'Atividade',
  estudio: 'Estúdio do criador',
  interesse: 'Lista de interesse',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  suporte: 'Suporte',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  seguranca: 'Carteira e segurança',
  politica: 'Política do mercado',
  denuncia: 'Denunciar item',
  diario: 'Diário da Cunhagem',
  'redes-sociais': 'Redes sociais',
}

export const Route = createFileRoute('/em-breve/$secao')({
  component: ComingSoon,
})

/**
 * Seções fora do escopo da entrega (editorial, suporte, atividade, ofertas,
 * downloads): a navegação é coerente, mas não simula sucesso funcional.
 */
function ComingSoon() {
  const { secao } = Route.useParams()
  const title = TITLES[secao] ?? 'Esta seção'
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <Construction className="size-10 text-amber" aria-hidden />
      <h1 className="text-2xl font-bold">{title} em breve</h1>
      <p className="max-w-md text-sm text-muted-foreground">Esta área não faz parte desta versão do marketplace. Enquanto isso, explore os NFTs disponíveis.</p>
      <Link to="/" hash="catalogo" className="font-bold text-amber hover:underline">
        Voltar ao mercado
      </Link>
    </Container>
  )
}
