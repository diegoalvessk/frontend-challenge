/**
 * Sinaliza quando a API está pronta para receber requisições. Com os mocks
 * ativos, isso acontece após o MSW registrar o service worker; sem mocks,
 * imediatamente. Permite renderizar a interface (e pintar o LCP) sem esperar
 * o carregamento da camada de mocks — as requisições aguardam este sinal.
 */
let resolveReady: () => void = () => {}

export const apiReady = new Promise<void>((resolve) => {
  resolveReady = resolve
})

export function markApiReady() {
  resolveReady()
}
