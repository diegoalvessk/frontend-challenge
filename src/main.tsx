import './index.css'

/**
 * A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS, padrão
 * "true") e fica disponível também no build de demonstração.
 *
 * A aplicação só é carregada DEPOIS dos mocks: o engine.io-client captura o
 * construtor `WebSocket` ao ser importado, então o MSW precisa substituí-lo
 * antes que o `socket.io-client` seja avaliado.
 */
async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await import('./app')
  renderApp(document.getElementById('root')!)
}

void bootstrap()
