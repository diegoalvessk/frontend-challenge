import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cartApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import type { ApiError } from '@/api/client'
import type { Cart, EditionId, Network } from '@/contracts'
import { guestCartId, useSession } from '@/features/auth/session-store'
import { announce } from '@/lib/announcer'

/** Dono do carrinho: o usuário autenticado ou o visitante deste navegador. */
export function useCartOwner() {
  const session = useSession()
  return session ? `user:${session.user.id}` : `guest:${guestCartId()}`
}

export function useCart(network: Network = 'ethereum') {
  const owner = useCartOwner()
  return useQuery({
    queryKey: queryKeys.cart(owner, network),
    queryFn: ({ signal }) => cartApi.get(network, { signal }),
    staleTime: 10_000,
  })
}

/**
 * Mutations do carrinho. O servidor devolve o carrinho recalculado
 * (preços vigentes, desconto, taxa e total), que substitui o cache:
 * os valores exibidos são sempre os da API.
 */
export function useCartMutations() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()

  const onSuccess = (cart: Cart) => {
    queryClient.setQueryData(queryKeys.cart(owner, cart.summary.network), cart)
    // Variantes por rede (checkout) são recalculadas na próxima leitura.
    void queryClient.invalidateQueries({ queryKey: ['cart', owner], predicate: (q) => q.queryKey[2] !== cart.summary.network })
  }
  const onError = (error: ApiError) => {
    toast.error(error.message)
    announce(error.message)
  }

  const add = useMutation({
    mutationFn: cartApi.add,
    onSuccess: (cart, variables) => {
      onSuccess(cart)
      const line = cart.lines.find((l) => l.nftId === variables.nftId && l.editionId === variables.editionId)
      const message = `${line?.name ?? 'NFT'} (edição ${line?.editionLabel ?? ''}) adicionado ao carrinho.`
      toast.success(message)
      announce(message)
    },
    onError,
  })

  const update = useMutation({
    mutationFn: ({ nftId, editionId, quantity }: { nftId: string; editionId: EditionId; quantity: number }) =>
      cartApi.update(nftId, editionId, quantity),
    onSuccess: (cart, variables) => {
      onSuccess(cart)
      announce(`Quantidade atualizada para ${variables.quantity}.`)
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: ({ nftId, editionId }: { nftId: string; editionId: EditionId; name: string }) => cartApi.remove(nftId, editionId),
    onSuccess: (cart, variables) => {
      onSuccess(cart)
      const message = `${variables.name} removido do carrinho.`
      toast.success(message)
      announce(message)
    },
    onError,
  })

  const acknowledge = useMutation({
    mutationFn: cartApi.acknowledge,
    onSuccess: (cart) => {
      onSuccess(cart)
      announce('Valores do carrinho atualizados.')
    },
    onError,
  })

  const applyCoupon = useMutation({
    mutationFn: cartApi.applyCoupon,
    onSuccess: (cart) => {
      onSuccess(cart)
      const message = `Cupom ${cart.coupon?.code} aplicado: ${cart.coupon?.description}.`
      toast.success(message)
      announce(message)
    },
    // Erros de cupom são exibidos junto ao campo (ver CouponForm).
  })

  const removeCoupon = useMutation({
    mutationFn: cartApi.removeCoupon,
    onSuccess: (cart) => {
      onSuccess(cart)
      announce('Cupom removido.')
    },
    onError,
  })

  return { add, update, remove, acknowledge, applyCoupon, removeCoupon }
}
