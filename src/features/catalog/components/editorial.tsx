import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import type { ArtworkId } from '@/contracts'
import { NftImage } from '@/components/nft/nft-image'
import { Skeleton } from '@/components/ui/skeleton'
import { featuredQuery } from '../queries'

/** "NFT em destaque": vem da API (`GET /nfts/featured`) e reage a `nft.updated`. */
export function SpotlightBanner() {
  const { data, isPending, isError } = useQuery(featuredQuery())
  if (isError) return null
  return (
    <section aria-labelledby="spotlight-title" className="flex flex-col gap-4 pt-6">
      <div className="flex flex-col gap-4 px-5">
        <h2 id="spotlight-title" className="text-2xl leading-8 font-bold text-amber">
          NFT EM DESTAQUE
        </h2>
        <p className="text-[22px] leading-4 font-bold">OFERTA LIMITADA</p>
      </div>
      {isPending ? (
        <Skeleton className="aspect-[310/368] w-full rounded-[22px]" />
      ) : (
        <Link
          to="/nft/$nftId"
          params={{ nftId: data.spotlight.id }}
          className="group relative block overflow-hidden rounded-[22px]"
          aria-label={`Ver ${data.spotlight.name} em destaque`}
        >
          <NftImage artwork={data.spotlight.artwork} alt={`Arte do NFT ${data.spotlight.name}`} sizes="310px" className="aspect-[310/368]" />
        </Link>
      )}
    </section>
  )
}

const PROMOS: Array<{ title: string; text: string; artwork: ArtworkId; tab?: 'novos' }> = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    artwork: 'emerald-ape',
    tab: 'novos',
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    artwork: 'ivory-baron',
  },
]

export function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-7 md:grid-cols-2">
      {PROMOS.map((promo) => (
        <article key={promo.title} className="grid grid-cols-[1fr_1.05fr] overflow-hidden rounded-lg bg-card">
          <NftImage artwork={promo.artwork} alt="" sizes="(min-width: 768px) 290px, 50vw" className="h-full rounded-[18px]" />
          <div className="flex flex-col items-end justify-center gap-3 p-5 text-right lg:pr-7">
            <h2 className="text-lg leading-6 font-bold">{promo.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{promo.text}</p>
            <Link
              to="/"
              search={promo.tab ? { tab: promo.tab } : {}}
              hash="catalogo"
              className="mt-2 inline-flex h-10 items-center gap-1 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-amber"
            >
              Explorar <ArrowRight className="size-4" aria-hidden />
              <span className="sr-only">{promo.title.toLowerCase()}</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS: Array<{ date: string; read: string; title: string; text: string; artwork: ArtworkId }> = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', artwork: 'ivory-baron' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', artwork: 'emerald-ape' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', artwork: 'sage-nomad' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', artwork: 'golden-beat' },
]

export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h2 id="journal-title" className="text-[28px] leading-[37px] font-bold">
          Diário da Cunhagem
        </h2>
        <p className="text-sm text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="relative flex h-full flex-col overflow-hidden rounded-lg bg-card">
              <NftImage artwork={post.artwork} alt="" sizes="(min-width: 1024px) 268px, 50vw" className="aspect-[268/195]" />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <p className="text-xs leading-4 font-medium text-muted-foreground">
                  {post.date} | Leitura de {post.read}
                </p>
                <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
                <p className="text-xs leading-4 font-medium text-muted-foreground">{post.text}</p>
                <Link
                  to="/em-breve/$secao"
                  params={{ secao: 'diario' }}
                  className="mt-auto text-xs font-bold text-amber after:absolute after:inset-0 hover:underline"
                >
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {post.title}</span>
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
