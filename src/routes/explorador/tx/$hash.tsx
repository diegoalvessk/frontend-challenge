import { createFileRoute, useCanGoBack, useRouter } from '@tanstack/react-router'
import { Container } from '@/components/layout/page'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/explorador/tx/$hash')({
  component: ExplorerPage,
})

/** Explorador simulado: as referências de transação não existem numa rede real. */
function ExplorerPage() {
  const { hash } = Route.useParams()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="rounded-full border border-primary/50 px-3 py-1 text-xs font-bold text-amber uppercase">Simulação</p>
      <h1 className="text-2xl font-bold">Explorador de transações</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        Esta transação foi gerada pela API simulada e não está registrada em uma blockchain real. Em produção, este link abriria o Etherscan.
      </p>
      <code className="max-w-full rounded-sm bg-card px-3 py-2 text-xs break-all">{hash}</code>
      <Button variant="outline" onClick={() => (canGoBack ? router.history.back() : router.navigate({ to: '/' }))}>
        Voltar
      </Button>
    </Container>
  )
}
