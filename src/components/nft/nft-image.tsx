import type { ArtworkId } from '@/contracts'
import { cn } from '@/lib/utils'

interface NftImageProps {
  artwork: ArtworkId
  alt: string
  /** Valor do atributo `sizes` (largura exibida) para o navegador escolher a variante. */
  sizes: string
  className?: string
  /** Imagens acima da dobra (LCP) não usam lazy loading. */
  priority?: boolean
}

/** Arte do NFT em WebP responsivo (400w/800w), com dimensões reservadas para evitar CLS. */
export function NftImage({ artwork, alt, sizes, className, priority = false }: NftImageProps) {
  return (
    <img
      src={`/nfts/${artwork}-400.webp`}
      srcSet={`/nfts/${artwork}-400.webp 400w, /nfts/${artwork}-800.webp 800w`}
      sizes={sizes}
      alt={alt}
      width={400}
      height={400}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('aspect-square h-auto w-full object-cover', className)}
    />
  )
}
