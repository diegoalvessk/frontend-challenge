import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { favoritesApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import { useSession } from '@/features/auth/session-store'
import { announce } from '@/lib/announcer'

export function useFavorites() {
  const session = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: queryKeys.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: !!userId,
    select: (data) => new Set(data.nftIds),
  })
}

/**
 * Favoritar com atualização otimista: a interface muda na hora e, se a API
 * falhar, o estado anterior é restaurado (rollback) e o usuário é avisado.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = session?.user.id

  const mutation = useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      const key = queryKeys.favorites(userId!)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<{ nftIds: string[] }>(key)
      queryClient.setQueryData<{ nftIds: string[] }>(key, (data) => {
        const ids = new Set(data?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous, key }
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous)
      // Clique antes de a lista carregar: não há estado anterior (setQueryData com undefined é ignorado
      // e o onMutate cancelou a carga). Reseta a consulta para buscar a lista real do servidor.
      else if (context) void queryClient.resetQueries({ queryKey: context.key })
      const message = `Não foi possível ${variables.favorite ? 'favoritar' : 'remover dos favoritos'} ${variables.name}. ${error.message}`
      toast.error(message)
      announce(message)
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(context.key, data)
      announce(variables.favorite ? `${variables.name} adicionado aos favoritos.` : `${variables.name} removido dos favoritos.`)
    },
  })

  return {
    isPending: mutation.isPending,
    toggle(nftId: string, name: string, favorite: boolean) {
      if (!userId) {
        toast.info('Entre na sua conta para salvar favoritos.')
        void navigate({ to: '/entrar', search: { redirect: location.href } })
        return
      }
      mutation.mutate({ nftId, name, favorite })
    },
  }
}
