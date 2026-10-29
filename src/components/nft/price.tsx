import type { EthAmount } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Preço em ETH com o preço anterior riscado (com texto alternativo para leitores de tela). */
export function Price({
  value,
  previous,
  className,
}: {
  value: EthAmount
  previous?: EthAmount | null
  className?: string
}) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 text-lg leading-4 font-bold text-amber', className)}>
      <span>
        {previous && <span className="sr-only">Preço atual: </span>}
        {formatEth(value)}
      </span>
      {previous && (
        <span className="font-normal text-khaki">
          <span className="sr-only">Preço anterior: </span>
          <s>{formatEth(previous)}</s>
        </span>
      )}
    </p>
  )
}
