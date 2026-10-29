import { queryOptions, useQuery } from '@tanstack/react-query'
import { profileApi, walletsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import { useSession } from '@/features/auth/session-store'

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
  })

export const walletsQuery = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.wallets(userId),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
  })

/** Hooks restritos ao usuário logado (chaves isoladas por userId). */
export function useProfile() {
  const session = useSession()
  return useQuery({ ...profileQuery(session?.user.id ?? 'anonymous'), enabled: !!session })
}

export function useWallets() {
  const session = useSession()
  return useQuery({ ...walletsQuery(session?.user.id ?? 'anonymous'), enabled: !!session })
}
