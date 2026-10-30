import { Link } from '@tanstack/react-router'
import { Construction } from 'lucide-react'
import { cn } from '@/lib/utils'

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

/**
 * Seções fora do escopo da entrega (editorial, suporte, atividade, ofertas,
 * downloads): a navegação é coerente, mas não simula sucesso funcional.
 */
export function ComingSoon({ secao, className }: { secao: string; className?: string }) {
  const title = TITLES[secao] ?? 'Esta seção'
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', className)}>
      <Construction className="size-10 text-amber" aria-hidden />
      <h1 className="text-2xl font-bold">{title} em breve</h1>
      <p className="max-w-md text-sm text-muted-foreground">Esta área não faz parte desta versão do marketplace. Enquanto isso, explore os NFTs disponíveis.</p>
      <Link to="/" hash="catalogo" className="font-bold text-amber hover:underline">
        Voltar ao mercado
      </Link>
    </div>
  )
}
