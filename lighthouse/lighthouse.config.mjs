/**
 * Configuração versionada da auditoria Lighthouse (usada por scripts/lighthouse.mjs).
 * Build otimizado (vite build + vite preview) com o cenário padrão dos mocks.
 */
export default {
  port: 4174,
  runs: 3,
  pages: [
    { id: 'inicio', path: '/' },
    { id: 'detalhe', path: '/nft/emerald-ape-042' },
  ],
  profiles: [
    // Perfil padrão do Lighthouse: Moto G Power emulado, 4G lento (150 ms RTT, 1,6 Mbps), CPU 4x.
    { id: 'mobile', formFactor: 'mobile' },
    // Preset desktop do Lighthouse: 1350x940, 40 ms RTT, 10 Mbps, sem throttling de CPU.
    { id: 'desktop', formFactor: 'desktop' },
  ],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
}
