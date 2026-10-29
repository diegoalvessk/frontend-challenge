import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-store'
import { EventLedger, applyNftEvent, applyOrderEvent, createSocket, realtimeBus, type ConnectionStatus } from './realtime-client'

/**
 * Mantém uma conexão Socket.IO por sessão. Trocar de usuário (ou sair)
 * encerra o socket anterior e seus listeners: eventos de uma sessão antiga
 * nunca alcançam os dados do novo usuário.
 */
export function useRealtimeConnection() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session?.token ?? null
  const userId = session?.user.id ?? null

  useEffect(() => {
    const socket = createSocket(token)
    const ledger = new EventLedger()
    let disconnectedOnce = false
    realtimeBus.setStatus('connecting')

    socket.on('connect', () => {
      realtimeBus.setStatus('connected')
      if (disconnectedOnce) {
        // Reconciliação: eventos perdidos durante a queda são recuperados via REST.
        void queryClient.invalidateQueries({ refetchType: 'active' })
      }
    })
    socket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') return
      disconnectedOnce = true
      realtimeBus.setStatus('reconnecting')
    })
    socket.on('connect_error', () => {
      realtimeBus.setStatus(navigator.onLine ? 'reconnecting' : 'offline')
    })

    socket.on('nft.updated', (event) => {
      if (!ledger.accept(event)) return
      applyNftEvent(queryClient, event)
      realtimeBus.emitNft(event)
    })

    socket.on('order.updated', (event) => {
      // Defesa extra: o servidor já filtra por usuário, o cliente confere de novo.
      if (!userId || event.data.userId !== userId) return
      if (!ledger.accept(event)) return
      applyOrderEvent(queryClient, userId, event)
      realtimeBus.emitOrder(event)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient, token, userId])
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (l) => realtimeBus.onStatus(l),
    () => realtimeBus.current,
  )
}
