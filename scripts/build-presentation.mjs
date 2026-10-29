// Gera docs/apresentacao-kurio.pdf a partir de docs/presentation/apresentacao.html,
// preenchendo os resultados reais (Lighthouse, testes) e as capturas de tela.
// Uso: node scripts/build-presentation.mjs
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = process.cwd()
const template = await readFile('docs/presentation/apresentacao.html', 'utf8')
const summary = JSON.parse(await readFile('lighthouse/summary.json', 'utf8'))
const deployUrl = process.env.DEPLOY_URL ?? '(adicione a URL do deploy)'
const testCount = process.env.TEST_COUNT ?? '70'

const fmt = (ms) => `${(ms / 1000).toFixed(2)} s`
const cell = (value, target) => `<td class="${value >= target ? 'ok' : 'warn'}">${value}</td>`
const t = summary.config.targets
const rows = summary.results
  .map(
    (r) => `<tr><td>${r.page === 'inicio' ? 'Início' : 'Detalhe do NFT'}</td><td>${r.profile}</td>
      ${cell(r.median.scores.performance, t.performance)}${cell(r.median.scores.accessibility, t.accessibility)}
      ${cell(r.median.scores['best-practices'], t['best-practices'])}${cell(r.median.scores.seo, t.seo)}
      <td>${fmt(r.median.metrics.LCP)}</td><td>${r.median.metrics.CLS.toFixed(3)}</td><td>${Math.round(r.median.metrics.TBT)} ms</td></tr>`,
  )
  .join('\n')

const shot = (name) => pathToFileURL(path.join(ROOT, 'tests/e2e/__screenshots__/visual.spec.ts', name)).href
const html = template
  .replaceAll('{{DEPLOY_URL}}', deployUrl)
  .replaceAll('{{TEST_COUNT}}', testCount)
  .replaceAll('{{LIGHTHOUSE_ROWS}}', rows)
  .replaceAll('{{LIGHTHOUSE_ENV}}', `Lighthouse ${summary.environment.lighthouse} · ${summary.environment.os} · Node ${summary.environment.node} · ${new Date(summary.generatedAt).toLocaleDateString('pt-BR')}`)
  .replace(/\{\{SHOT:([^}]+)\}\}/g, (_, name) => shot(name))

const out = path.join(ROOT, 'docs/presentation/.render.html')
await writeFile(out, html)
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(pathToFileURL(out).href, { waitUntil: 'networkidle' })
await page.pdf({
  path: 'docs/apresentacao-kurio.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
})
await browser.close()
console.log('PDF gerado em docs/apresentacao-kurio.pdf')
