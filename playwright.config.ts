import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// PLAYWRIGHT_BASE_URL permite apontar para um servidor já em execução (ex.: npm run dev).
const EXTERNAL_URL = process.env.PLAYWRIGHT_BASE_URL
const BASE_URL = EXTERNAL_URL ?? `http://localhost:${PORT}`

/**
 * E2E contra o build de produção (vite preview) com a API simulada (MSW).
 * Cada teste usa um contexto novo do navegador: localStorage vazio => o banco
 * simulado nasce do seed, garantindo estado isolado e dados estáveis.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Respeita a preferência do sistema nos testes visuais (sem animações).
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      // No mobile rodam os fluxos principais (marcados com @mobile).
      grep: /@mobile/,
    },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
