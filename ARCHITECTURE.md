# Arquitetura — Kurio

Este documento descreve as decisões técnicas, os contratos REST e de eventos, a política de sessão, o estado do carrinho, a estratégia de cache, a reconciliação entre REST e Socket.IO, as limitações e os desvios do Figma.

## Visão geral

```
            ┌──────────────────────────── navegador ─────────────────────────────┐
            │                                                                     │
  UI (React + shadcn/ui) ── hooks (TanStack Query) ── Axios ──► fetch/XHR ──┐     │
            │        ▲                                                       │     │
            │        └── realtimeBus ◄── socket.io-client ◄── WebSocket ──┐  │     │
            │                                                           │  │     │
            │      ┌──────────────────── camada de mocks (MSW) ─────────┼──┼──┐  │
            │      │  ws.link + socket.io-binding  ◄──────────────────────┘  │  │  │
            │      │  http handlers (service worker) ◄───────────────────────┘  │  │
            │      │  domínio + banco simulado (localStorage) + cenários         │  │
            │      └─────────────────────────────────────────────────────────────┘  │
            └──────────────────────────────────────────────────────────────────────┘
```

- **`src/contracts`** é a fonte única de tipos e schemas Zod. A UI, o Axios e os mocks importam os mesmos contratos, então transporte, estado e interface ficam tipados de ponta a ponta.
- **`src/api`** concentra o transporte: cliente Axios com interceptors, uma função por operação REST e o `QueryClient`, com chaves e política de cache.
- **`src/features`** agrupa a lógica por domínio (hooks de query/mutation, componentes de domínio e stores pequenos).
- **`src/routes`** guarda as rotas do TanStack Router: `validateSearch` com Zod, `beforeLoad` para as rotas privadas e loaders que apenas pré-aquecem o cache.
- **`src/realtime`** contém o cliente Socket.IO, o ledger de eventos (deduplicação e versão) e a aplicação dos eventos no cache.
- **`src/mocks`** é a API simulada. Nenhum componente, hook ou o cliente Axios contém dados fictícios ou caminhos alternativos de negócio: tudo passa pela rede (MSW).

## Contratos REST

Base: `/api`. Todos os valores em ETH trafegam como **strings decimais** e quantidades são inteiras. Os erros seguem um formato único:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" }, "details": {} } }
```

| Código | HTTP | Uso |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400/422 | Campos inválidos (`fields` por campo) |
| `INVALID_CREDENTIALS` | 401 | Login incorreto |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | 401 | Sem sessão / sessão expirada |
| `FORBIDDEN` | 403 | Recurso de outro usuário (pedido) |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | E-mail/usuário em uso; carteira secundária sem principal |
| `EDITION_UNAVAILABLE` / `QUANTITY_LIMIT` / `AVAILABILITY_CONFLICT` | 409 | Disponibilidade |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | Cupom |
| `QUOTE_STALE` | 409 | Cotação desatualizada (`details: { quote, changes[] }`) |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma chave com outro conteúdo |
| `WALLET_REJECTED` | 409/422 | Carteira recusou a conexão / não conectada |
| `SERVICE_UNAVAILABLE` / `INTERNAL_ERROR` | 503/500 | Falha transitória |

Falhas de transporte são normalizadas no cliente como `NETWORK_ERROR`, `TIMEOUT` e `CANCELED` (classe `ApiError`).

| Recurso | Operação | Endpoint | Resposta |
| --- | --- | --- | --- |
| Sessão | Cadastro | `POST /auth/register` `{username,email,password}` | `201 Session` · 409 conflito · 422 |
| | Login | `POST /auth/login` `{email,password}` | `Session` · 401 |
| | Consulta | `GET /auth/session` | `Session` · 401 expirada |
| | Logout | `POST /auth/logout` | `204` |
| NFTs | Listagem | `GET /nfts?q&tab&categories&networks&minPrice&maxPrice&sort&page&pageSize` | `CatalogResponse` (itens, paginação, facetas) |
| | Destaques | `GET /nfts/featured` | `{ hero[], spotlight }` |
| | Detalhe | `GET /nfts/:id` | `NftDetail` (edições, disponibilidade, versão) · 404 |
| | Relacionados | `GET /nfts/:id/related` | `NftSummary[]` |
| Favoritos | Consulta | `GET /me/favorites` | `{ nftIds }` |
| | Inclusão/remoção | `PUT` / `DELETE /me/favorites/:id` | `{ nftIds }` |
| Carrinho | Consulta | `GET /cart?network` | `Cart` (linhas, avisos, resumo) |
| | Inclusão | `POST /cart/items` `{nftId,editionId,quantity}` | `201 Cart` · 409 limite/esgotado |
| | Alteração/remoção | `PATCH` / `DELETE /cart/items/:nftId/:editionId` | `Cart` |
| | Aceitar mudanças | `POST /cart/acknowledge` | `Cart` (preços aceitos, quantidades ajustadas) |
| | Cupom | `POST /cart/coupon` `{code}` · `DELETE /cart/coupon` | `Cart` · 422 inválido/expirado |
| | Mesclar visitante | `POST /cart/merge` (header `X-Guest-Cart-Id`) | `Cart` |
| Cotação | Criar | `POST /checkout/quote` `{network}` | `201 Quote` (snapshot com validade de 10 min) |
| Carteira | Conectar/desconectar | `POST /wallets/connect` `{walletId,network}` · `DELETE /wallets/connection` | `WalletConnection` · `WALLET_REJECTED` |
| Pedidos | Criação idempotente | `POST /orders` + header `Idempotency-Key` `{quoteId,walletId,collector}` | `201 Order` · `200` replay (`Idempotent-Replayed: true`) · 409 `QUOTE_STALE`/`IDEMPOTENCY_CONFLICT` |
| | Consulta | `GET /orders/:id` · `GET /orders?status` | `Order` (snapshot imutável) · 403/404 |
| Perfil | Consulta/atualização | `GET` / `PATCH /me/profile` | `Profile` · 409 · 422 |
| | Avatar | `PUT /me/avatar` `{dataUrl}` · `DELETE /me/avatar` | `Profile` · 422 |
| | Senha | `POST /me/password` `{currentPassword,newPassword}` | `204` · 422 senha atual incorreta |
| Carteiras | Consulta | `GET /me/wallets` | `{ primary, secondary }` |
| | Cadastro/edição | `PUT /me/wallets/:slot` (`primary`/`secondary`) | `Wallet` · 422 · 409 |
| | Remoção | `DELETE /me/wallets/secondary` | `204` |

Os tipos completos estão em [`src/contracts`](src/contracts).

### Idempotência de pedidos

- O cliente gera a chave por **tentativa** e a persiste com o corpo (`attempt-store.ts`).
- Mesma chave e mesmo corpo: o servidor devolve o **mesmo pedido** (`200`, `Idempotent-Replayed`).
- Mesma chave com corpo diferente: `409 IDEMPOTENCY_CONFLICT`. A comparação usa o hash SHA-256 do corpo.
- Em timeout, erro de rede ou 5xx, o cliente reenvia automaticamente com a mesma chave (até 3 vezes, com backoff). Cliques repetidos são bloqueados por um guard síncrono.
- A cotação aceita é consumida pelo pedido e não pode gerar outro.

### Revalidação no checkout

Ao criar o pedido, o servidor recalcula o carrinho com preços, disponibilidade, cupom e taxa atuais e compara com a cotação. Qualquer diferença, ou a cotação expirada, gera `409 QUOTE_STALE` com uma nova cotação e a lista de mudanças. O cliente exige nova confirmação.

## Eventos Socket.IO

Envelope comum, com identidade estável, recurso afetado e versão:

```ts
{ eventId: 'nft:emerald-ape-042:v3', type: 'nft.updated', resource: { type: 'nft', id }, version: 3, occurredAt, data }
```

| Evento | Destinatários | `data` |
| --- | --- | --- |
| `nft.updated` | Todos os sockets | `priceEth`, `previousPriceEth`, `soldOut`, `editions[{id,available,priceEth}]` |
| `order.updated` | Somente os sockets autenticados do dono | `userId`, `status`, `transactionHash`, `explorerUrl`, `declineReason` |

- **Autenticação do socket:** o `auth.token` do pacote CONNECT (`40{…}`) é validado no servidor simulado. Cada sessão tem o seu socket, e logout ou troca de usuário encerra o socket anterior e todos os listeners.
- **Duplicatas e eventos antigos:** o `EventLedger` descarta `eventId`s já vistos e versões menores ou iguais à última aplicada por recurso. Além disso, o patch no cache só acontece se `event.version > cache.version`. Um estado mais novo nunca regride e efeitos como avisos não são reaplicados.
- **Isolamento:** o servidor filtra `order.updated` por usuário, e o cliente confere `data.userId` de novo.
- **Ciclo de vida:** o socket é criado num efeito do layout raiz, ligado ao token. A limpeza remove os listeners e desconecta.

### Reconciliação REST × Socket.IO

- O REST é a fonte de verdade e o socket acelera a convergência.
- `nft.updated` atualiza catálogo, destaques, relacionados e detalhe direto no cache, e **invalida o carrinho**. O servidor recalcula preços vigentes, avisos e resumo.
- `order.updated` atualiza o status e depois revalida o pedido via REST, para obter o snapshot completo.
- **Após reconectar**, `invalidateQueries({ refetchType: 'active' })` refaz as consultas ativas: eventos perdidos durante a queda são recuperados.
- **Pedido pendente:** além do evento, há polling de 5 s enquanto `pending`. Após refresh, o pedido é lido do REST. Os estados `confirmed` e `declined` são terminais.

### Transporte nos mocks e limitações

- O `socket.io-client` usa `transports: ['websocket']`. O MSW intercepta o `WebSocket` com `ws.link('wss://realtime.kurio.mock/*')` e o [`@mswjs/socket.io-binding`](https://github.com/mswjs/socket.io-binding) codifica e decodifica os protocolos Engine.IO e Socket.IO.
- **Ordem de carregamento:** o `engine.io-client` captura o construtor `WebSocket` no momento em que o módulo é avaliado. Por isso o `socket.io-client` é importado dinamicamente **depois** que o MSW inicia (`src/lib/api-ready.ts`).
- **Ping:** o binding responde ao handshake com `pingInterval` de 25 s, mas não envia pings. O servidor simulado envia `2` a cada 20 s para o cliente não encerrar a conexão.
- O binding não suporta namespaces, rooms nem broadcast. O "servidor" mantém a própria lista de conexões e filtra por usuário.
- O MSW não emite `close` quando o cliente fecha o socket ainda conectando (por exemplo, no StrictMode). Conexões fechadas são descartadas pelo `readyState`.
- O servidor simulado vive na aba. Abas diferentes têm "servidores" independentes, que compartilham o estado persistido, mas não trocam eventos entre si.
- O MSW fixa a versão 2: o binding declara `peer msw@^2.10` e ainda não suporta o MSW 3.

## Sessão

- `POST /auth/login` devolve `{ token, user, expiresAt }`. O token fica em `localStorage` (`kurio.app.session`) para a sessão sobreviver ao refresh, e é validado ao carregar (`GET /auth/session`) e a cada 60 s.
- As sessões duram 30 min (45 s no cenário `session-short`).
- Qualquer `401 SESSION_EXPIRED` ou `UNAUTHENTICATED` numa requisição autenticada encerra a sessão local (interceptor do Axios).
- **Expiração:** um aviso aparece; se a rota for privada, o usuário vai ao login com `?redirect=<rota>&motivo=expirada` e volta ao mesmo ponto após entrar. No checkout, o formulário é salvo continuamente (`sessionStorage`) e restaurado.
- As rotas privadas (`/pagamento`, `/pedidos/*`, `/perfil/*`) usam um guard no `beforeLoad`. Sem sessão, ele redireciona preservando o destino.
- **Logout ou troca de usuário:** descarta o cache `['user', id, …]` e o carrinho do usuário anterior, e fecha o socket autenticado.
- **Senhas:** o servidor simulado só guarda `SHA-256(salt + senha)`. Ao alterar a senha, as demais sessões do usuário são encerradas.

## Estado do carrinho

- O carrinho vive **no servidor** para visitantes e para usuários.
- **Visitante:** o carrinho é identificado por `X-Guest-Cart-Id`, um id aleatório no `localStorage`. Ao autenticar, `POST /cart/merge` incorpora os itens respeitando os limites e remove o carrinho de visitante.
- Cada linha guarda `acknowledgedPriceEth`, o último preço aceito pelo usuário. A resposta traz `issues` por linha (`price-changed`, `quantity-reduced`, `unavailable`). Enquanto houver avisos, o checkout fica bloqueado até o usuário aceitar (`POST /cart/acknowledge`).
- Subtotal, desconto, taxa de rede e total são **sempre os da API**. Os cálculos usam `decimal.js`, e a apresentação preserva as casas significativas (ex.: `26.846 ETH`).
- Após a confirmação, o servidor remove do carrinho **apenas** os itens e quantidades comprados. Em caso de falha, os itens são preservados.

## Cache, retries e sincronização

| Item | Política |
| --- | --- |
| Chaves | `['catalog','list', query]`, `['nft', id]`, `['cart', owner, network]`, `['user', userId, …]`: isoladas por parâmetros e por usuário |
| `staleTime` | 30 s (padrão), 10 s (carrinho), 5 min (destaques e relacionados) |
| `gcTime` | 5 min |
| Retries de leitura | Até 2, com backoff exponencial (800 ms, 1,6 s, até 3 s), **apenas** para falhas transitórias (rede, timeout, 5xx). 4xx nunca é repetido |
| Mutations | Sem retry automático. O pedido tem fluxo idempotente próprio |
| Respostas obsoletas | Cada combinação de filtros tem sua chave; o `AbortSignal` do Query cancela a requisição anterior; `placeholderData: keepPreviousData` evita "piscar" |
| Atualização otimista | Favoritos: `onMutate` aplica, `onError` faz rollback, `onSuccess` sincroniza com a resposta |
| Invalidação | Mutations do carrinho substituem o cache pela resposta. `nft.updated` invalida o carrinho, `order.updated` invalida pedido e carrinho, a reconexão invalida as consultas ativas |
| Refetch | Ao focar a janela e ao reconectar a rede |

## Mocks (MSW)

- **Banco** (`mocks/db.ts`): catálogo, usuários, sessões, favoritos, carrinhos, cotações, pedidos, idempotência e carteiras num único estado consistente, persistido em `localStorage` (`kurio.mock.db.v1`).
- **Reset** restaura o seed completo.
- Toda mutação passa por `commit()`, que persiste e publica a mudança. O servidor Socket.IO transforma isso em evento, então REST e eventos refletem sempre o mesmo dado.
- **Seed determinístico:** 60 NFTs gerados com PRNG de semente fixa. Os 9 primeiros reproduzem o Figma. São 9 categorias, 3 redes, 4 edições por NFT (algumas esgotadas), avaliações, 2 usuários e 3 cupons.
- **Liquidação de pedidos:** cada pedido guarda `settleAt`. Se a página recarregar com pedido pendente, o agendamento é retomado na inicialização.
- **Cenários** (`mocks/scenarios.ts`): latência determinística por URL (hash FNV-1a), falhas HTTP por tentativa, offline e regras de negócio (veja o README).
- **Controle** (`window.__KURIO_MOCK__`): usado pelo painel de demonstração e pelos testes. Ele altera o *estado do servidor*; a interface só percebe pela rede.
- A camada é ativada por `VITE_ENABLE_MOCKS` e incluída no build de demonstração. Ela inicia antes da aplicação, e as requisições aguardam o sinal `apiReady`.

## Testes

- 70 testes Playwright cobrindo os 12 grupos do enunciado, rodando em Chromium contra o **build de produção**.
- O projeto desktop (1440 px) roda tudo. O projeto mobile (390 px) roda os fluxos marcados com `@mobile`.
- Cada teste tem um contexto novo, ou seja, um banco simulado recém-criado.
- O relógio é controlado em `page.clock` (expiração por tempo). Latência e eventos são disparados pelo controle dos mocks.
- O `axe-core` verifica violações graves nas telas principais.
- A regressão visual compara início, detalhe, carrinho e pagamento, nos dois tamanhos.

## Acessibilidade

- Link "Pular para o conteúdo", foco visível global (`:focus-visible` com contorno âmbar) e navegação inteira por teclado.
- Diálogos e drawers (Radix) prendem o foco, fecham com Esc e devolvem o foco a quem os abriu.
- Rótulos associados, `aria-invalid` e `aria-describedby` apontando para a mensagem de erro (`components/form/field.tsx`). O primeiro campo com erro recebe foco.
- Região `aria-live` global para mutations e eventos em tempo real, além dos toasts.
- Estados não dependem só de cor: botões alternáveis usam `aria-pressed`, preços anteriores usam `<s>` com texto alternativo, edições esgotadas são riscadas e rotuladas, e avisos têm ícone e texto.
- O shimmer dos skeletons e os spinners respeitam `prefers-reduced-motion`. Os skeletons têm as dimensões do conteúdo final.

**Ajustes em relação ao layout:**
- Alguns textos secundários (`#b39463` sobre `#140d0a`) foram mantidos, por terem contraste suficiente (6,6:1).
- Placeholders foram complementados por rótulos acessíveis, já que o Figma usa só placeholder no login.
- O seletor de ordenação usa `<select>` nativo e os campos "Rede" e "Tipo de carteira" também, pelo suporte a teclado e leitores de tela.

## Performance e Lighthouse

As medianas de 3 medições por página e perfil estão em [`lighthouse/summary.md`](lighthouse/summary.md). Os relatórios HTML/JSON ficam em `lighthouse/reports/` e a configuração em `lighthouse/lighthouse.config.mjs`.

Otimizações aplicadas:
- **Artes:** de PNG de 1254 px (cerca de 2 MB cada) para WebP responsivo de 400 e 800 px (11 a 48 KB), com `srcset`/`sizes`, `width`/`height` reservados e `loading="lazy"` fora da dobra.
- **LCP:** a imagem do banner da home tem preload no `index.html` e `fetchpriority="high"`. O banner não depende da API.
- **Bundle dos mocks enxuto:** o MSW traz o `tough-cookie`, que embute a Public Suffix List (~120 KB comprimidos), apenas para guardar cookies das respostas. Esta API não usa cookies, então um substituto mínimo com a mesma interface entra por alias no Vite (`src/mocks/vendor/tough-cookie-lite.ts`). O chunk dos mocks caiu de 175 KB para 54 KB comprimidos, e a performance da home mobile subiu de 84 para 91.
- **Ordem de carregamento medida:** mocks primeiro, depois a aplicação. Baixar os dois em paralelo disputou banda no 4G simulado e piorou o LCP mobile (de 3,8 s para 4,7 s), por isso a ordem sequencial foi mantida.
- **Fonte:** o subset latino da Roboto Mono é servido de `/fonts` e pré-carregado no HTML, o que eliminou o CLS causado pela troca tardia da fonte.
- **Code splitting por rota** (`autoCodeSplitting` do TanStack Router) e fonte Roboto Mono servida localmente.
- **CLS:** os relacionados só aparecem depois do conteúdo principal, e os skeletons têm as dimensões finais.

Causas residuais:
- No perfil mobile, o LCP da home é a primeira imagem do catálogo, que depende da API. O caminho crítico é: HTML, chunk dos mocks (~54 KB comprimidos), registro do service worker, chunk da aplicação, requisição ao catálogo (120 ms simulados) e render.
- Num backend real, o chunk dos mocks não existiria. Ele não foi removido da auditoria porque o enunciado pede as funcionalidades da entrega, sem simplificações exclusivas para a pontuação.

## Decisões de UX e desvios do Figma

- **Login e cadastro:** no desktop são um diálogo modal sobre a home, como no Figma; no mobile, tela cheia.
- **Login social e "esqueceu a senha":** ficam visíveis, mas informam que não estão disponíveis, sem simular sucesso.
- **Seções fora do escopo** (Criadores, Aprenda, Atividade, Ofertas, Arquivos, Suporte, links do rodapé): levam a uma página "em breve". A newsletter informa indisponibilidade.
- **Revisão do pedido:** foi adicionado um diálogo antes da confirmação (o enunciado exige revisão; não há frame próprio).
- **Telas sem frame:** pedido pendente, pedido recusado, explorador de transações simulado, lista de favoritos ("Lista de interesse") e estados vazio, erro e "valores mudaram" seguem o mesmo padrão visual.
- **Galeria do detalhe:** o Figma repete a mesma imagem nas 4 miniaturas. Elas viraram 4 vistas da obra (inteira e recortes de detalhe).
- **Carteiras no pagamento:** o desktop do Figma mostra o formulário do colecionador e o mobile mostra cartões de carteira. A implementação une os dois: escolha da carteira cadastrada, do provedor e do formulário pré-preenchido em todas as larguras.
- **Perfil:** dados e senha têm botões separados ("Salvar" e "Alterar senha"), para que um erro de senha não bloqueie a edição dos dados.
- **Contagens das facetas:** vêm da API (dados reais do seed), não dos números estáticos do Figma.
- **Mobile:** barra superior com voltar e ações fixas no rodapé (detalhe, carrinho), como nos frames. Perfil, carteiras e confirmação foram adaptados por não terem frame mobile.
- **Assets:** as 4 artes vieram do Figma pela API e foram convertidas para WebP. Os ícones são do Lucide, mais SVGs próprios para as marcas, porque o Lucide v1 removeu os logos de terceiros.

## Limitações conhecidas

- Os pagamentos, as carteiras e a blockchain são simulados. Os hashes de transação e o "Etherscan" levam a um explorador interno de simulação.
- O estado simulado é por navegador (localStorage). Dois navegadores diferentes não compartilham dados.
- As baselines visuais foram geradas no Windows. Em outro sistema operacional, precisam ser regeneradas uma vez (diferenças de renderização de fontes).
