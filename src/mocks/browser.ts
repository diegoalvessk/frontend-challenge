import { setupWorker } from 'msw/browser'
import { mockControl } from './control'
import { initDb } from './db'
import { resumePendingOrders } from './domain'
import { accountHandlers } from './handlers/account'
import { catalogHandlers } from './handlers/catalog'
import { commerceHandlers } from './handlers/commerce'
import { realtimeHandler } from './realtime'
import { initScenario } from './scenarios'

export const worker = setupWorker(...accountHandlers, ...catalogHandlers, ...commerceHandlers, realtimeHandler)

/** Inicializa a API simulada antes da aplicação fazer qualquer requisição. */
export async function startMocks() {
  initScenario()
  await initDb()
  resumePendingOrders()
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
  window.__KURIO_MOCK__ = mockControl
}
