import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/session-store'
import { EventLedger, applyNftEvent, applyOrderEvent, createSocket, realtimeBus, type ConnectionStatus, type RealtimeSocket } from './realtime-client'

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
    let socket: RealtimeSocket | null = null
    let disposed = false
    const ledger = new EventLedger()
    let disconnectedOnce = false
    realtimeBus.setStatus('connecting')

    void createSocket(token).then((created) => {
      // Sessão trocada antes de o socket ficar pronto: descarta sem conectar listeners.
      if (disposed) {
        created.disconnect()
        return
      }
      socket = created

      created.on('connect', () => {
        realtimeBus.setStatus('connected')
        if (disconnectedOnce) {
          // Reconciliação: eventos perdidos durante a queda são recuperados via REST.
          void queryClient.invalidateQueries({ refetchType: 'active' })
        }
      })
      created.on('disconnect', (reason) => {
        if (reason === 'io client disconnect') return
        disconnectedOnce = true
        realtimeBus.setStatus('reconnecting')
      })
      created.on('connect_error', () => {
        realtimeBus.setStatus(navigator.onLine ? 'reconnecting' : 'offline')
      })

      created.on('nft.updated', (event) => {
        if (!ledger.accept(event)) return
        applyNftEvent(queryClient, event)
        realtimeBus.emitNft(event)
      })

      created.on('order.updated', (event) => {
        // Defesa extra: o servidor já filtra por usuário, o cliente confere de novo.
        if (!userId || event.data.userId !== userId) return
        if (!ledger.accept(event)) return
        applyOrderEvent(queryClient, userId, event)
        realtimeBus.emitOrder(event)
      })
    })

    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [queryClient, token, userId])
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (l) => realtimeBus.onStatus(l),
    () => realtimeBus.current,
  )
}
