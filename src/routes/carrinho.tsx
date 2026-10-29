import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/carrinho')({
  component: () => <div className="p-10">Carrinho (em construção)</div>,
})
