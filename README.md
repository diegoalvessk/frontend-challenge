# Kurio — Marketplace de NFTs

Solução do [Desafio Frontend da Jungle Gaming](https://github.com/junglegaming/frontend-challenge): marketplace de NFTs em React + TypeScript, fiel ao [layout do Figma](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1), com API REST e tempo real totalmente simulados (MSW + Socket.IO).

- **Aplicação publicada:** _(preenchido após o deploy)_
- **Repositório:** https://github.com/diegoalvessk/frontend-challenge
- **Arquitetura, contratos e decisões:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

## Stack

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 + TypeScript 7 (Vite 8) |
| Roteamento | TanStack Router (rotas por arquivo, search params tipados) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização / componentes | Tailwind CSS 4 + shadcn/ui (Radix) |
| Formulários / validação | react-hook-form + Zod (schemas compartilhados com os mocks) |
| Mocking | MSW 2 + `@mswjs/socket.io-binding` |
| Testes E2E e visuais | Playwright + axe-core |
| Auditoria | Lighthouse 13 |

## Setup

Requisitos: **Node.js 20+** (testado com Node 26) e npm.

```bash
npm install
npx playwright install chromium   # navegador dos testes e da auditoria
npm run dev                        # http://localhost:5173 com a API simulada
```

Nenhum backend ou serviço externo é necessário: a API REST e o servidor Socket.IO rodam no navegador (MSW), inclusive no build de produção publicado.

### Variáveis de ambiente

Todas são opcionais (veja [`.env.example`](.env.example)):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a API simulada. `false` usa `VITE_API_URL`/`VITE_SOCKET_URL` reais. |
| `VITE_API_URL` | `/api` | Base das chamadas REST (Axios). |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Servidor Socket.IO (host fictício interceptado pelo MSW). |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
| --- | --- | --- | --- |
| Ana Colecionadora | `ana@kurio.dev` | `Kurio@2026` | Carteira principal cadastrada, 2 favoritos |
| Bruno Holder | `bruno@kurio.dev` | `Kurio@2026` | Sem carteiras e sem favoritos (estados vazios) |

Cupons: `KURIO10` (10%), `GENESIS25` (25%), `VERAO2025` (**expirado**). Qualquer outro código é inválido.

As senhas são guardadas apenas como `SHA-256(salt + senha)` no banco simulado.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Verificação de tipos + build otimizado (`dist/`) |
| `npm run preview` | Serve o build (com mocks) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright (desktop + mobile) contra o build de produção |
| `npm run test:e2e:update` | Atualiza as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML do último run |
| `npm run lighthouse` | Build + auditoria Lighthouse (3 medições por página/perfil) |
| `npm run assets:optimize` | Regera as variantes WebP das artes do Figma |

## Cenários da API simulada

Os cenários são determinísticos e podem ser escolhidos de três formas:

1. **Painel "Mocks"** (botão flutuante no canto da tela): troca o cenário, dispara eventos Socket.IO, derruba/restaura a conexão, expira a sessão e **reseta todos os dados**.
2. **URL:** `?scenario=<id>`, por exemplo `/?scenario=slow` (fica salvo para os próximos carregamentos).
3. **Testes:** `localStorage['kurio.mock.scenario']` ou `window.__KURIO_MOCK__.setScenario(id)`.

| Cenário (`id`) | Efeito |
| --- | --- |
| `default` | Sucesso com latência de 120 ms |
| `slow` | Todas as respostas em ~2,5 s (skeletons com shimmer) |
| `variable-latency` | Latência de 100 ms a 2,5 s derivada da URL: respostas fora de ordem |
| `offline` | Falha de rede em todas as requisições e socket sem conexão |
| `server-error` | Catálogo e detalhe respondem 500 até trocar de cenário |
| `flaky` | A 1ª leitura de cada URL responde 503; o retry automático recupera |
| `empty` | Catálogo sem resultados |
| `favorites-fail` | Favoritar/desfavoritar responde 500 (rollback otimista) |
| `session-short` | Sessões expiram 45 s após o login |
| `wallet-reject` | A carteira recusa a conexão no checkout |
| `price-change` | 4 s após abrir o pagamento, o preço do 1º item sobe (via `nft.updated`) |
| `sold-out` | Ao confirmar, a edição do 1º item esgota e o pedido é rejeitado (409) |
| `order-timeout` | O pedido é criado, mas a 1ª resposta excede o timeout; o reenvio recupera o mesmo pedido |
| `payment-declined` | O pedido fica pendente e depois é recusado |

**Reset:** painel "Mocks" → "Resetar todos os dados" (ou `window.__KURIO_MOCK__.reset()`), que restaura o seed completo e limpa sessão, carrinho de visitante e cenário.

## Como reproduzir os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Carregamento lento | Painel → "Rede lenta" → recarregue a home, o detalhe ou o carrinho |
| Erro 5xx e nova tentativa | Painel → "Erro 500 no catálogo" → recarregue → troque para "Padrão" → "Tentar novamente" |
| Sem conexão | Painel → "Sem conexão" → recarregue (erro + aviso de reconexão) |
| Respostas fora de ordem | Painel → "Latência variável" → alterne filtros rapidamente: o grid sempre corresponde aos filtros finais |
| Rollback otimista | Entre como Ana → painel → "Falha ao favoritar" → clique em "Favoritar" |
| Preço muda no checkout | Coloque um item no carrinho → "Conectar e finalizar" → painel → "Subir preço do 1º item do carrinho" (ou cenário `price-change`) |
| Edição esgotada | Painel → "Esgotar a edição do 1º item", ou cenário `sold-out` e confirme a compra |
| Pagamento recusado | Cenário `payment-declined` → confirme a compra |
| Timeout com idempotência | Cenário `order-timeout` → confirme: após ~8 s o app reenvia com a mesma chave e abre o mesmo pedido |
| Queda com pedido pendente | Confirme a compra → painel → "Derrubar socket" → recarregue a página → "Restaurar socket" |
| Sessão expirada | Logado em uma página privada → painel → "Expirar sessão agora" → navegue |
| Conflito de cadastro | Crie conta com `ana@kurio.dev` |

## Testes

```bash
npm run test:e2e                 # build + preview + 70 testes (desktop 1440 px e mobile 390 px)
npm run test:e2e:report          # relatório HTML (playwright-report/)
```

- Cada teste parte de um contexto novo do navegador, ou seja, banco simulado recém-criado a partir do seed.
- Os testes de REST passam pelos handlers MSW; os de tempo real pelo `socket.io-client`.
- Traces das falhas ficam em `test-results/` (`npx playwright show-trace <arquivo>`).
- As baselines visuais (início, detalhe, carrinho e pagamento, em desktop e mobile) estão versionadas em `tests/e2e/__screenshots__/`. Foram geradas no Windows; em outro sistema, rode `npm run test:e2e:update` uma vez, porque a renderização de fontes varia entre sistemas operacionais.
- Para rodar contra um servidor já ativo: `PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test`.

## Lighthouse

`npm run lighthouse` gera o build, sobe o `vite preview` e audita a home e o detalhe do NFT nos perfis mobile e desktop, com 3 medições cada. A saída inclui:

- `lighthouse/summary.md` e `lighthouse/summary.json`: medianas, LCP/CLS/TBT, versões e condições de execução;
- `lighthouse/reports/*.html|json`: relatórios individuais;
- `lighthouse/lighthouse.config.mjs`: configuração versionada da auditoria.

Os resultados e a análise estão em [`ARCHITECTURE.md`](ARCHITECTURE.md#performance-e-lighthouse).

## Estrutura

```
src/
  contracts/      Contratos REST/eventos e schemas Zod (compartilhados com os mocks)
  api/            Cliente Axios, endpoints por recurso e QueryClient (chaves e política de cache)
  realtime/       Cliente Socket.IO: deduplicação, versão, isolamento e reconciliação
  features/       Lógica por domínio (auth, catalog, nft, cart, checkout, favorites, account)
  components/     UI compartilhada (layout, NFT, formulários) e shadcn/ui adaptado
  routes/         Rotas do TanStack Router (uma por arquivo)
  mocks/          API simulada: banco, cenários, handlers REST e servidor Socket.IO
tests/e2e/        Playwright (specs, helpers e baselines visuais)
design/           Telas exportadas do Figma e artes originais
scripts/          Otimização de imagens e auditoria Lighthouse
```

## Deploy

Publicado na Vercel como SPA estática (`vercel.json` reescreve todas as rotas para `index.html`, permitindo acesso direto e refresh). A API simulada e o tempo real funcionam no ambiente publicado.
