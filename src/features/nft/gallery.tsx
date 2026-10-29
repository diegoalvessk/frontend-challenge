import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import type { ArtworkId } from '@/contracts'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Galeria com 4 vistas da mesma arte (inteira e recortes de detalhe), já que
 * o Figma usa uma única imagem por NFT. A ampliação abre em diálogo modal.
 */
const VIEWS = [
  { label: 'Obra completa', style: {} },
  { label: 'Detalhe do rosto', style: { transform: 'scale(1.6)', transformOrigin: '50% 30%' } },
  { label: 'Detalhe dos acessórios', style: { transform: 'scale(1.9)', transformOrigin: '50% 55%' } },
  { label: 'Detalhe do figurino', style: { transform: 'scale(1.7)', transformOrigin: '50% 95%' } },
] as const

function Art({ artwork, alt, view, sizes, priority }: { artwork: ArtworkId; alt: string; view: number; sizes: string; priority?: boolean }) {
  return (
    <div className="overflow-hidden">
      <img
        src={`/nfts/${artwork}-800.webp`}
        srcSet={`/nfts/${artwork}-400.webp 400w, /nfts/${artwork}-800.webp 800w`}
        sizes={sizes}
        alt={alt}
        width={800}
        height={800}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="aspect-square h-auto w-full object-cover"
        style={VIEWS[view].style}
      />
    </div>
  )
}

export function NftGallery({ artwork, name }: { artwork: ArtworkId; name: string }) {
  const [view, setView] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-7">
      <div className="hidden flex-col gap-4 md:flex" role="group" aria-label="Vistas da obra">
        {VIEWS.map((v, index) => (
          <button
            key={v.label}
            type="button"
            onClick={() => setView(index)}
            aria-label={v.label}
            aria-pressed={view === index}
            className={cn('w-[100px] overflow-hidden rounded-lg border transition-colors', view === index ? 'border-primary' : 'border-transparent hover:border-primary/50')}
          >
            <Art artwork={artwork} alt="" view={index} sizes="100px" />
          </button>
        ))}
      </div>
      <div className="relative flex-1 self-start rounded-md md:max-w-[444px] md:bg-card md:p-4">
        <div className="overflow-hidden rounded-[28px] md:rounded-3xl">
          <Art artwork={artwork} alt={`${name} — ${VIEWS[view].label.toLowerCase()}`} view={view} sizes="(min-width: 768px) 404px, 100vw" priority />
        </div>
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="absolute top-2 right-2 grid size-10 place-items-center rounded-full bg-card/90 text-foreground hover:text-amber"
          aria-label="Ampliar imagem"
        >
          <ZoomIn className="size-5" aria-hidden />
        </button>
      </div>
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[min(90vw,720px)] border-border bg-card p-4">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{VIEWS[view].label}</DialogDescription>
          <div className="overflow-hidden rounded-xl">
            <Art artwork={artwork} alt={`${name} ampliado`} view={view} sizes="720px" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
