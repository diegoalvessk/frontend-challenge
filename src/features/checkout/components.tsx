import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { EllipsisVertical, Loader2, PlugZap, Unplug } from 'lucide-react'
import { NftImage } from '@/components/nft/nft-image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { NETWORKS, WALLET_PROVIDERS, type Network, type Quote, type Wallet, type WalletProvider } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { SummaryRows } from '@/features/cart/components'
import { shortAddress } from './format'

export function QuoteLines({ quote }: { quote: Quote }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="quote-lines">
      {quote.lines.map((line) => (
        <li key={`${line.nftId}-${line.editionId}`} className="flex items-center gap-3 bg-card">
          <NftImage artwork={line.artwork} alt="" sizes="70px" className="size-[70px]" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold md:truncate">{line.name}</p>
            <p className="text-[13px] text-khaki">
              ID do token: {line.tokenId} · {line.editionLabel}
            </p>
          </div>
          <p className="text-sm text-sand">(x {line.quantity})</p>
          <p className="pr-3 text-lg font-bold whitespace-nowrap text-amber">{formatEth(line.lineTotalEth)}</p>
        </li>
      ))}
    </ul>
  )
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'rejected'

/** Rádio cobre do Figma mobile (anel com ponto quando marcado); no desktop segue o nativo. */
const radioClass =
  'size-4 shrink-0 accent-primary max-md:size-[18px] max-md:appearance-none max-md:rounded-full max-md:border-[1.5px] max-md:border-primary/60 max-md:checked:border-primary max-md:checked:bg-[radial-gradient(circle,var(--color-primary)_42%,transparent_46%)]'

export function WalletPicker({
  wallets,
  walletId,
  onWalletChange,
  provider,
  onProviderChange,
  connection,
  onConnect,
  onDisconnect,
}: {
  wallets: Wallet[]
  walletId: string | null
  onWalletChange: (id: string) => void
  provider: WalletProvider
  onProviderChange: (provider: WalletProvider) => void
  connection: ConnectionState
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* O link fica no wrapper: dentro do fieldset, top-0 começaria abaixo da legend. */}
      <div className="relative">
      <fieldset className="flex flex-col gap-3 max-md:gap-4">
        <legend className="mb-3 text-base font-bold max-md:text-[15px]">Carteira conectada</legend>
        {wallets.map((wallet) => {
          const slot = wallet.slot === 'primary' ? 'Principal' : 'Reserva'
          return (
            <div key={wallet.id} className="relative">
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-xl bg-card p-4 ring-1 ring-transparent transition has-checked:ring-primary has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  'max-md:min-h-[92px] max-md:items-center max-md:pr-12 max-md:has-checked:ring-transparent',
                )}
              >
                <input type="radio" name="wallet" value={wallet.id} checked={walletId === wallet.id} onChange={() => onWalletChange(wallet.id)} className={cn(radioClass, 'mt-1 max-md:mt-0')} />
                <span className="flex flex-col gap-1 text-sm max-md:text-[13px]">
                  <span className="text-base font-bold max-md:text-[15px]">
                    {slot}
                    <span className="max-md:hidden"> · {wallet.nickname}</span>
                  </span>
                  {/* Mobile (Figma): só o ENS, ou o endereço curto quando não houver ENS. */}
                  <span className="text-sand">
                    {wallet.ensName ? `${wallet.ensName}.eth` : shortAddress(wallet.address)}
                    {wallet.ensName && <span className="max-md:hidden"> · {shortAddress(wallet.address)}</span>}
                  </span>
                  <span className="text-sand">Rede {NETWORKS.find((n) => n.id === wallet.network)?.label}</span>
                </span>
              </label>
              <Link
                to="/perfil/carteiras"
                className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-sand hover:text-amber md:hidden"
                aria-label={`Editar carteira ${slot}`}
              >
                <EllipsisVertical className="size-5" aria-hidden />
              </Link>
            </div>
          )
        })}
      </fieldset>
      <Link to="/perfil/carteiras" className="absolute top-0 right-0 text-sm font-bold text-amber hover:underline md:hidden">
        Trocar carteira
      </Link>
      </div>

      <fieldset className="flex flex-col gap-3 max-md:gap-4">
        <legend className="mb-3 text-base font-bold max-md:text-[15px]">Carteira e rede</legend>
        {WALLET_PROVIDERS.map((p) => (
          <label
            key={p.id}
            className="flex h-12 cursor-pointer items-center gap-4 rounded-sm border border-border px-4 text-base has-checked:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring max-md:h-16 max-md:gap-3 max-md:rounded-xl max-md:border-0 max-md:bg-card max-md:px-3.5 max-md:text-sm"
          >
            <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => onProviderChange(p.id)} className={cn(radioClass, 'max-md:order-last max-md:ml-auto')} />
            <span className="grid size-7 place-items-center rounded-full border border-primary/50 text-xs font-bold text-amber max-md:size-10 max-md:border-primary/30 max-md:bg-ink-800" aria-hidden>
              {p.label[0]}
            </span>
            {p.label}
          </label>
        ))}
      </fieldset>

      <div className="flex items-center justify-between gap-3 rounded-sm bg-secondary px-4 py-3 text-sm max-md:rounded-xl max-md:bg-card" role="status" data-testid="wallet-connection">
        <span className="flex items-center gap-2">
          {connection === 'connecting' && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {connection === 'connected' && <PlugZap className="size-4 text-mint" aria-hidden />}
          {(connection === 'disconnected' || connection === 'rejected') && <Unplug className="size-4 text-coral" aria-hidden />}
          {connection === 'connecting'
            ? 'Aguardando aprovação na carteira…'
            : connection === 'connected'
              ? 'Carteira conectada'
              : connection === 'rejected'
                ? 'Conexão recusada na carteira'
                : 'Carteira desconectada'}
        </span>
        {connection === 'connected' ? (
          <Button variant="link" size="sm" onClick={onDisconnect}>
            Desconectar
          </Button>
        ) : (
          <Button variant="link" size="sm" onClick={onConnect} disabled={connection === 'connecting' || !walletId}>
            {connection === 'rejected' ? 'Tentar novamente' : 'Conectar'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function ReviewDialog({
  open,
  onOpenChange,
  quote,
  wallet,
  provider,
  network,
  onConfirm,
  busy,
  status,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote
  wallet: Wallet
  provider: WalletProvider
  network: Network
  onConfirm: () => void
  busy: boolean
  status: ReactNode
  error: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-card sm:max-w-lg" data-testid="review-dialog">
        <DialogTitle>Revise sua compra</DialogTitle>
        <DialogDescription>Confira itens, carteira, rede e valores antes de confirmar. A cotação é a referência do pedido.</DialogDescription>
        <QuoteLines quote={quote} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-sand">Carteira</dt>
          <dd>
            {WALLET_PROVIDERS.find((p) => p.id === provider)?.label} · {shortAddress(wallet.address)}
          </dd>
          <dt className="text-sand">Rede</dt>
          <dd>{NETWORKS.find((n) => n.id === network)?.label}</dd>
          {quote.coupon && (
            <>
              <dt className="text-sand">Cupom</dt>
              <dd>{quote.coupon.code}</dd>
            </>
          )}
        </dl>
        <SummaryRows summary={quote.summary} />
        {error}
        {status}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Voltar e editar
          </Button>
          <Button onClick={onConfirm} disabled={busy} aria-busy={busy} data-testid="confirm-order">
            {busy ? 'Processando…' : 'Confirmar compra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
