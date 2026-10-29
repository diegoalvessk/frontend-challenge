import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pedidos/$orderId')({
  component: () => <div className="p-10">Pedido (em construção)</div>,
})
