import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/icons'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const COLUMNS: Array<{ title: string; links: Array<{ label: string; to: string; secao?: string }> }> = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/perfil' },
      { label: 'Minha coleção', to: '/em-breve/$secao', secao: 'colecao' },
      { label: 'Atividade', to: '/em-breve/$secao', secao: 'atividade' },
      { label: 'Estúdio do criador', to: '/em-breve/$secao', secao: 'estudio' },
      { label: 'Lista de interesse', to: '/em-breve/$secao', secao: 'interesse' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', to: '/em-breve/$secao', secao: 'ajuda' },
      { label: 'Como comprar NFTs', to: '/em-breve/$secao', secao: 'como-comprar' },
      { label: 'Carteira e segurança', to: '/em-breve/$secao', secao: 'seguranca' },
      { label: 'Política do mercado', to: '/em-breve/$secao', secao: 'politica' },
      { label: 'Denunciar item', to: '/em-breve/$secao', secao: 'denuncia' },
    ],
  },
]

const COLLECTION_LINKS = [
  { label: 'Arte digital', cat: 'arte-digital' },
  { label: 'Fotografia', cat: 'fotografia' },
  { label: 'Música', cat: 'musica' },
  { label: 'Arte 3D', cat: 'arte-3d' },
  { label: 'Utilidade', cat: 'utilidade' },
] as const

const SOCIAL = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
]

export function WalletsBadge() {
  return (
    <p className="inline-flex flex-wrap items-center gap-2 rounded-sm border border-primary/40 bg-ink-700 px-2 py-1 text-[9px] font-bold tracking-wider text-amber uppercase">
      <span>MetaMask</span>
      <span aria-hidden>•</span>
      <span>WalletConnect</span>
      <span aria-hidden>•</span>
      <span>Coinbase</span>
    </p>
  )
}

function Newsletter() {
  const [status, setStatus] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        // Fora do escopo da entrega: não simulamos sucesso de inscrição.
        setStatus('A inscrição na newsletter ainda não está disponível nesta demonstração.')
      }}
    >
      <h2 className="text-lg leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
      <div className="flex h-10">
        <label htmlFor="newsletter-email" className="sr-only">
          E-mail para receber lançamentos
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="digite seu e-mail..."
          className="min-w-0 flex-1 bg-ink-800 px-3 text-sm text-foreground placeholder:text-khaki"
        />
        <button type="submit" className="bg-primary px-4 text-lg font-bold text-primary-foreground hover:bg-amber">
          Enviar
        </button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground" role="status">
        {status ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 hidden max-w-[1248px] px-6 pb-6 md:block">
      <section aria-label="Destaques da Kurio" className="grid gap-7 bg-card p-8 lg:grid-cols-[1fr_1fr_1fr_1.35fr]">
        {FEATURES.map((f) => (
          <div key={f.letter} className="flex flex-col gap-3 border-primary px-4 lg:border-r">
            <span className="grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground" aria-hidden>
              {f.letter}
            </span>
            <h2 className="text-[17px] leading-4 font-bold">{f.title}</h2>
            <p className="text-sm leading-[22px] text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <div className="px-4">
          <Newsletter />
        </div>
      </section>

      <div className="grid gap-4 bg-ink-700 px-8 py-6 text-sm sm:grid-cols-4 sm:items-center">
        <p className="font-bold tracking-[0.1em]">KURIO</p>
        <p>Feito para colecionadores, criadores e cultura</p>
        <a href="mailto:contato@email.com" className="hover:text-amber">
          contato@email.com
        </a>
        <a href="tel:+551140028922" className="hover:text-amber">
          +55 11 4002 8922
        </a>
      </div>

      <div className="grid gap-8 bg-card px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-2 text-lg font-bold">{col.title}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.secao ? (
                    <Link to="/em-breve/$secao" params={{ secao: link.secao }} className="hover:text-amber">
                      {link.label}
                    </Link>
                  ) : (
                    <Link to={link.to} className="hover:text-amber">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Coleções">
          <h2 className="mb-2 text-lg font-bold">Coleções</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {COLLECTION_LINKS.map((c) => (
              <li key={c.cat}>
                <Link to="/" search={{ cat: c.cat }} hash="catalogo" className="hover:text-amber">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {SOCIAL.map(({ label, Icon }) => (
              <li key={label}>
                {/* Perfis sociais fictícios: os links abrem a página de "em breve". */}
                <Link
                  to="/em-breve/$secao"
                  params={{ secao: 'redes-sociais' }}
                  className="grid size-8 place-items-center rounded-sm border border-primary text-amber hover:bg-secondary"
                  aria-label={`${label} da Kurio (em breve)`}
                >
                  <Icon className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="text-lg font-bold">Carteiras compatíveis</h2>
          <WalletsBadge />
        </div>
      </div>
      <p className="py-6 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
