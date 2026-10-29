import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/em-breve/$secao')({
  component: () => <div className="p-10">Em breve (em construção)</div>,
})
