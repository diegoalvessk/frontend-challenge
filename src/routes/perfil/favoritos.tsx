import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/perfil/favoritos')({
  component: () => <div className="p-10">Favoritos (em construção)</div>,
})
