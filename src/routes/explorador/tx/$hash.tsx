import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/explorador/tx/$hash')({
  component: () => <div className="p-10">Explorador (em construção)</div>,
})
