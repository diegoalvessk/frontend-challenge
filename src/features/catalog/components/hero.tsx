import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ArtworkId } from '@/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { cn } from '@/lib/utils'

/** Slides do banner: conteúdo editorial estático (não depende da API, preservando o LCP). */
const SLIDES: Array<{ artwork: ArtworkId; nftId: string; name: string }> = [
  { artwork: 'emerald-ape', nftId: 'emerald-ape-042', name: 'Emerald Ape #042' },
  { artwork: 'ivory-baron', nftId: 'ivory-baron-088', name: 'Ivory Baron #088' },
  { artwork: 'golden-beat', nftId: 'golden-beat-207', name: 'Golden Beat #207' },
]

function Dots({ active, onSelect, className }: { active: number; onSelect: (index: number) => void; className?: string }) {
  return (
    <div className={cn('flex gap-2', className)} role="group" aria-label="Escolher destaque">
      {SLIDES.map((slide, index) => (
        <button
          key={slide.nftId}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Destaque ${index + 1} de ${SLIDES.length}: ${slide.name}`}
          aria-pressed={index === active}
          className="grid size-6 place-items-center"
        >
          <span className={cn('size-2 rounded-full bg-primary transition-opacity', index === active ? 'opacity-100' : 'opacity-50')} />
        </button>
      ))}
    </div>
  )
}

export function Hero() {
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]

  return (
    <section aria-labelledby="hero-title">
      {/* Desktop/tablet */}
      <div className="hidden min-h-[450px] items-center gap-10 py-8 md:flex lg:gap-[110px] lg:py-0 lg:pl-10">
        <div className="flex max-w-[600px] flex-1 flex-col gap-11">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium tracking-[0.1em]">Bem-vindo à Kurio</p>
              <h1 id="hero-title" className="text-[32px] leading-[52px] font-bold tracking-wide uppercase lg:text-[43px] lg:leading-[70px]">
                Seja dono do futuro da arte digital
              </h1>
            </div>
            <p className="max-w-[557px] text-sm leading-6 text-muted-foreground">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma
              parte da cultura da internet.
            </p>
            <Link
              to="/"
              hash="catalogo"
              className="inline-flex h-10 w-fit items-center rounded-md bg-primary pr-9 pl-7 text-base font-bold text-primary-foreground hover:bg-amber"
            >
              EXPLORAR
            </Link>
          </div>
          <Dots active={active} onSelect={setActive} className="self-end" />
        </div>
        <Link
          to="/nft/$nftId"
          params={{ nftId: slide.nftId }}
          className="block w-[clamp(280px,32vw,450px)] shrink-0 overflow-hidden rounded-3xl"
          aria-label={`Ver ${slide.name}`}
        >
          <NftImage artwork={slide.artwork} alt={`Arte do NFT ${slide.name}`} sizes="(min-width: 1024px) 450px, 32vw" priority />
        </Link>
      </div>

      {/* Mobile */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 p-4 md:hidden">
        <div className="pointer-events-none absolute -top-16 -left-10 size-56 rounded-full bg-copper/15" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs font-bold">Bem-vindo à Kurio</p>
            <h1 className="text-lg leading-7 font-bold tracking-wide uppercase">Seja dono da cultura digital</h1>
            <p className="text-xs leading-5 text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <Link to="/" hash="catalogo" className="inline-flex items-center gap-2 text-xs font-bold text-amber">
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Link to="/nft/$nftId" params={{ nftId: slide.nftId }} className="block w-[38%] shrink-0 overflow-hidden rounded-2xl" aria-label={`Ver ${slide.name}`}>
            <NftImage artwork={slide.artwork} alt={`Arte do NFT ${slide.name}`} sizes="140px" priority />
          </Link>
        </div>
        <Dots active={active} onSelect={setActive} className="relative mt-1 justify-center" />
      </div>
    </section>
  )
}
