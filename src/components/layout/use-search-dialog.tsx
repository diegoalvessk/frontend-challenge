import { useRef, useState } from 'react'
import { SearchDialog } from './search-dialog'

/**
 * Diálogo de busca aberto por estado (sem DialogTrigger). O elemento que o
 * abriu é registrado no clique para receber o foco de volta ao fechar.
 */
export function useSearchDialog() {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  return {
    openFrom(element: HTMLElement) {
      opener.current = element
      setOpen(true)
    },
    dialog: <SearchDialog open={open} onOpenChange={setOpen} opener={opener} />,
  }
}
