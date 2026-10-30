import { createFileRoute } from '@tanstack/react-router'
import { ComingSoon } from '@/components/layout/coming-soon'
import { Container } from '@/components/layout/page'

export const Route = createFileRoute('/em-breve/$secao')({
  component: ComingSoonPage,
})

function ComingSoonPage() {
  const { secao } = Route.useParams()
  return (
    <Container className="py-24">
      <ComingSoon secao={secao} />
    </Container>
  )
}
