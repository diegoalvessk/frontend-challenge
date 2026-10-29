import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto max-w-[1310px] px-4 py-16">
      <p className="text-sm text-muted-foreground">Bem-vindo à Kurio</p>
      <h1 className="mt-4 text-4xl font-bold uppercase">Seja dono do futuro da arte digital</h1>
    </main>
  )
}
