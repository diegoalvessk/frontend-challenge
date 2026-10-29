import type { CartLine } from '@/contracts'
import { formatEth } from '@/lib/money'

/** Mensagens para os avisos calculados pela API em cada linha do carrinho. */
export function issueText(line: Pick<CartLine, 'issues' | 'available' | 'acknowledgedPriceEth' | 'unitPriceEth' | 'quantity'>) {
  return line.issues.map((issue) => {
    if (issue === 'price-changed') return `Preço alterado de ${formatEth(line.acknowledgedPriceEth)} para ${formatEth(line.unitPriceEth)}.`
    if (issue === 'unavailable') return 'Edição esgotada. Será removida ao aceitar os novos valores.'
    return `Apenas ${line.available} disponível(is); a quantidade será ajustada.`
  })
}
