import type { RefObject } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** Diálogo de busca global; devolve o foco a quem o abriu (`opener`). */
export function SearchDialog({ open, onOpenChange, opener }: { open: boolean; onOpenChange: (open: boolean) => void; opener: RefObject<HTMLElement | null> }) {
  const navigate = useNavigate()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-24 translate-y-0 border-border bg-card sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault()
            opener.current.focus()
          }
        }}
      >
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Procure por nome, coleção ou criador.</DialogDescription>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            const q = String(new FormData(event.currentTarget).get('q') ?? '').trim()
            onOpenChange(false)
            void navigate({ to: '/', search: (prev) => ({ ...prev, q: q || undefined, page: undefined }), hash: 'catalogo' })
          }}
          className="flex gap-2"
        >
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="global-search" name="q" type="search" placeholder="Ex.: Emerald Ape" autoComplete="off" autoFocus />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
