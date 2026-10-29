// Auditoria Lighthouse: 3 medições por página e perfil, mediana por categoria,
// relatórios HTML/JSON e resumo com versões, ambiente e condições de execução.
// Uso: npm run lighthouse   (faz o build antes via "prelighthouse")
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import config from '../lighthouse/lighthouse.config.mjs'

const OUT = 'lighthouse/reports'
const BASE = `http://localhost:${config.port}`

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const { chromium } = await import('playwright')
  return chromium.executablePath()
}

function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(config.port), '--strictPort'], { shell: true, stdio: 'pipe' })
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => String(d).includes('Local') && resolve(child))
    child.on('exit', (code) => reject(new Error(`vite preview saiu com código ${code}`)))
  })
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

await mkdir(OUT, { recursive: true })
const preview = await startPreview()
const chromeExe = await chromePath()
const results = []

try {
  // LH_ONLY=inicio-mobile e LH_RUNS=1 permitem medições rápidas durante a otimização.
  const only = process.env.LH_ONLY
  const totalRuns = Number(process.env.LH_RUNS) || config.runs
  for (const page of config.pages) {
    for (const profile of config.profiles) {
      if (only && only !== `${page.id}-${profile.id}`) continue
      const runs = []
      for (let run = 1; run <= totalRuns; run++) {
        // Chrome novo a cada medição: sem cache, sem service worker prévio.
        const chrome = await chromeLauncher.launch({ chromePath: chromeExe, chromeFlags: ['--headless=new', '--no-sandbox'] })
        try {
          const result = await lighthouse(
            BASE + page.path,
            { port: chrome.port, output: ['html', 'json'], onlyCategories: config.categories, logLevel: 'error' },
            profile.formFactor === 'desktop' ? desktopConfig : undefined,
          )
          const lhr = result.lhr
          const name = `${page.id}-${profile.id}-${run}`
          await writeFile(path.join(OUT, `${name}.html`), result.report[0])
          await writeFile(path.join(OUT, `${name}.json`), result.report[1])
          const scores = Object.fromEntries(config.categories.map((c) => [c, Math.round(lhr.categories[c].score * 100)]))
          const metrics = {
            LCP: lhr.audits['largest-contentful-paint'].numericValue,
            CLS: lhr.audits['cumulative-layout-shift'].numericValue,
            TBT: lhr.audits['total-blocking-time'].numericValue,
            FCP: lhr.audits['first-contentful-paint'].numericValue,
            SI: lhr.audits['speed-index'].numericValue,
          }
          runs.push({ run, scores, metrics, lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent, throttling: lhr.configSettings.throttling, screen: lhr.configSettings.screenEmulation })
          console.log(name, scores, `LCP ${Math.round(metrics.LCP)}ms CLS ${metrics.CLS.toFixed(3)} TBT ${Math.round(metrics.TBT)}ms`)
        } finally {
          await chrome.kill()
        }
      }
      results.push({
        page: page.id,
        path: page.path,
        profile: profile.id,
        median: {
          scores: Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
          metrics: Object.fromEntries(Object.keys(runs[0].metrics).map((m) => [m, median(runs.map((r) => r.metrics[m]))])),
        },
        runs,
      })
    }
  }
} finally {
  // No Windows, `kill` encerra só o shell: derruba a árvore inteira do preview.
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'])
  else preview.kill()
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const summary = {
  generatedAt: new Date().toISOString(),
  environment: {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    node: process.version,
    lighthouse: results[0]?.runs[0]?.lighthouseVersion,
    chrome: results[0]?.runs[0]?.userAgent,
    vite: pkg.devDependencies.vite,
    server: `vite preview (build de produção) em ${BASE}`,
    mocks: 'MSW ativo, cenário "default" (latência de 120 ms por requisição)',
  },
  config,
  results,
}
await writeFile('lighthouse/summary.json', JSON.stringify(summary, null, 2))

const fmt = (ms) => `${(ms / 1000).toFixed(2)} s`
const lines = [
  '# Lighthouse — mediana de 3 medições',
  '',
  `Gerado em ${summary.generatedAt} · Lighthouse ${summary.environment.lighthouse} · Node ${summary.environment.node} · ${summary.environment.os}`,
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${r.median.scores.performance} | ${r.median.scores.accessibility} | ${r.median.scores['best-practices']} | ${r.median.scores.seo} | ${fmt(r.median.metrics.LCP)} | ${r.median.metrics.CLS.toFixed(3)} | ${Math.round(r.median.metrics.TBT)} ms |`,
  ),
  '',
  `Metas: Performance ≥ ${config.targets.performance}, Accessibility ≥ ${config.targets.accessibility}, Best Practices ≥ ${config.targets['best-practices']}, SEO ≥ ${config.targets.seo}.`,
  '',
  'Relatórios individuais (HTML/JSON) em `lighthouse/reports/`.',
]
await writeFile('lighthouse/summary.md', lines.join('\n') + '\n')
console.log('\n' + lines.join('\n'))
