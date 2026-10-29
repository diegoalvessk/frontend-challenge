import './index.css'
import { markApiReady } from './lib/api-ready'

/**
 * A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS, padrão
 * "true") e fica disponível também no build de demonstração.
 *
 * Os mocks iniciam antes da aplicação: medido com Lighthouse, baixar os dois
 * em paralelo disputa banda no perfil mobile e atrasa o LCP. O
 * `socket.io-client` é importado só após `apiReady`, porque o engine.io-client
 * captura o construtor `WebSocket` ao ser avaliado e o MSW precisa
 * substituí-lo antes.
 */
const mocks =
  import.meta.env.VITE_ENABLE_MOCKS === 'false'
    ? Promise.resolve()
    : import('./mocks/browser').then(({ startMocks }) => startMocks())

void mocks
  .catch((error: unknown) => console.error('[mocks] falha ao iniciar a API simulada', error))
  .then(() => {
    markApiReady()
    return import('./app')
  })
  .then(({ renderApp }) => renderApp(document.getElementById('root')!))
