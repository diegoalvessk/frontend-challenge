import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCart } from '@/features/cart/use-cart'

/**
 * Painel de demonstração da API simulada. Ele só conversa com a camada de
 * mocks (`window.__KURIO_MOCK__`): as mudanças chegam à interface pelas
 * respostas REST e pelos eventos Socket.IO, nunca por atalhos na UI.
 */
export function MockPanel() {
  const control = typeof window !== 'undefined' ? window.__KURIO_MOCK__ : undefined
  const [open, setOpen] = useState(false)
  const [scenario, setScenario] = useState(() => control?.getScenario() ?? 'default')
  const [feedback, setFeedback] = useState<string | null>(null)
  const { data: cart } = useCart()

  if (!control) return null
  const firstLine = cart?.lines[0]

  const run = (message: string, action: () => unknown) => {
    action()
    setFeedback(message)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed top-24 left-0 z-40 flex items-center gap-2 rounded-r-full border border-l-0 border-primary/60 bg-popover px-3 py-2 text-xs font-bold text-amber shadow-lg md:top-auto md:bottom-4 md:left-4 md:rounded-full md:border-l"
          aria-label="Abrir painel de cenários da API simulada"
        >
          <FlaskConical className="size-4" aria-hidden />
          Mocks
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[340px] overflow-y-auto border-border bg-card sm:max-w-sm">
        <div className="flex flex-col gap-6 p-5">
          <div>
            <SheetTitle>API simulada (MSW)</SheetTitle>
            <SheetDescription>Cenários determinísticos, reset e eventos Socket.IO.</SheetDescription>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">Cenário</legend>
            {control.scenarios.map((s) => (
              <label key={s.id} className="flex cursor-pointer gap-3 rounded-sm border border-border p-2 text-sm has-checked:border-primary">
                <input
                  type="radio"
                  name="mock-scenario"
                  value={s.id}
                  checked={scenario === s.id}
                  onChange={() => {
                    control.setScenario(s.id)
                    setScenario(s.id)
                    setFeedback(`Cenário "${s.label}" ativo.`)
                  }}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block font-bold">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Eventos em tempo real</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={!firstLine}
              onClick={() => run(`Preço de ${firstLine?.name} alterado (+10%).`, () => control.changePrice(firstLine!.nftId, 1.1))}
            >
              Subir preço do 1º item do carrinho
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!firstLine}
              onClick={() =>
                run(`Edição ${firstLine?.editionLabel} de ${firstLine?.name} esgotada.`, () =>
                  control.setAvailability(firstLine!.nftId, firstLine!.editionId, 0),
                )
              }
            >
              Esgotar a edição do 1º item
            </Button>
            <Button variant="outline" size="sm" onClick={() => run('Conexão em tempo real derrubada.', () => control.dropSocket({ block: true }))}>
              Derrubar socket
            </Button>
            <Button variant="outline" size="sm" onClick={() => run('Reconexão liberada.', () => control.restoreSocket())}>
              Restaurar socket
            </Button>
            <Button variant="outline" size="sm" onClick={() => run('Pedidos pendentes liquidados.', () => control.settlePendingOrders())}>
              Liquidar pedidos pendentes
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Sessão e dados</h3>
            <Button variant="outline" size="sm" onClick={() => run('Sessões expiradas no servidor.', () => control.expireSessions())}>
              Expirar sessão agora
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await control.reset()
                window.location.assign('/')
              }}
            >
              Resetar todos os dados
            </Button>
          </div>

          <p role="status" className="min-h-5 text-xs text-amber">
            {feedback}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
