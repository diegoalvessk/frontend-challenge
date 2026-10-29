import { useEffect } from 'react'
import { toast } from 'sonner'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/money'
import { realtimeBus } from '@/realtime/realtime-client'

/** Avisa (visual + leitor de tela) quando o NFT aberto muda via `nft.updated`. */
export function useLivePriceNotice(nftId: string, name: string | undefined) {
  useEffect(
    () =>
      realtimeBus.onNft((event) => {
        if (event.resource.id !== nftId || !name) return
        const message = event.data.soldOut
          ? `${name} esgotou.`
          : `Atualização em tempo real: ${name} agora custa ${formatEth(event.data.priceEth)}.`
        toast.info(message)
        announce(message)
      }),
    [nftId, name],
  )
}
