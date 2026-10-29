import { useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Clock } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { checkoutApi } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import { Field, FormError } from '@/components/form/field'
import { MobileTopBar } from '@/components/layout/mobile'
import { Breadcrumbs, Container, ErrorState } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORKS, WALLET_PROVIDERS, collectorSchema, type CollectorForm, type Network, type Session, type Wallet, type WalletProvider } from '@/contracts'
import { useProfile, useWallets } from '@/features/account/queries'
import { requireAuth } from '@/features/auth/require-auth'
import { useSession } from '@/features/auth/session-store'
import { SummaryRows, SummarySkeleton } from '@/features/cart/components'
import { useCart } from '@/features/cart/use-cart'
import { attemptStore, draftStore } from '@/features/checkout/attempt-store'
import { QuoteLines, ReviewDialog, WalletPicker, type ConnectionState } from '@/features/checkout/components'
import { selectClass } from '@/features/checkout/format'
import { describeChange, isQuoteStale, usePlaceOrder, useQuote } from '@/features/checkout/use-checkout'
import { announce } from '@/lib/announcer'
import { applyApiErrors } from '@/lib/forms'
import { formatEth } from '@/lib/money'

export const Route = createFileRoute('/pagamento')({
  beforeLoad: requireAuth,
  component: CheckoutPage,
})

function defaultsFrom(wallet: Wallet | undefined, username: string): CollectorForm {
  return {
    displayName: wallet?.displayName ?? '',
    username,
    profileName: wallet?.profileName ?? '',
    network: wallet?.network ?? 'ethereum',
    walletAddress: wallet?.address ?? '',
    altAddress: wallet?.altAddress ?? '',
    walletProvider: wallet?.provider ?? 'metamask',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? '',
    ensName: wallet?.ensName ?? '',
    note: '',
  }
}

function CheckoutPage() {
  // Sessão encerrada nesta tela: o ciclo de vida da sessão redireciona ao login (o rascunho fica salvo).
  const session = useSession()
  return session ? <Checkout session={session} /> : null
}

function Checkout({ session }: { session: Session }) {
  const userId = session.user.id
  const navigate = useNavigate()
  const profile = useProfile()
  const wallets = useWallets()
  const walletList = useMemo(() => [wallets.data?.primary, wallets.data?.secondary].filter((w): w is Wallet => !!w), [wallets.data])

  const [walletId, setWalletId] = useState<string | null>(null)
  const [useSecondary, setUseSecondary] = useState(false)
  const [connection, setConnection] = useState<ConnectionState>('disconnected')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<CollectorForm>({ resolver: zodResolver(collectorSchema), defaultValues: defaultsFrom(undefined, session.user.username) })
  const { errors } = form.formState
  const network = useWatch({ control: form.control, name: 'network' }) as Network
  const provider = useWatch({ control: form.control, name: 'walletProvider' }) as WalletProvider

  const cart = useCart(network)
  const cartReady = !!cart.data && cart.data.lines.length > 0 && cart.data.lines.every((l) => l.issues.length === 0)
  const quote = useQuote(network, cartReady && !!walletList.length)
  const placeOrder = usePlaceOrder(userId)
  const selectedWallet = walletList.find((w) => w.id === walletId)

  // Pré-preenche com a carteira escolhida (ou com o rascunho salvo antes de uma expiração de sessão).
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || !wallets.data || !profile.data) return
    initialized.current = true
    const primary = wallets.data.primary ?? undefined
    setWalletId(primary?.id ?? null)
    const draft = draftStore.get<CollectorForm>(userId)
    form.reset(draft ?? defaultsFrom(primary, profile.data.username))
  }, [wallets.data, profile.data, userId, form])

  // Salva o rascunho continuamente (retomada após expiração/refresh).
  useEffect(
    () => form.subscribe({ formState: { values: true }, callback: ({ values }) => draftStore.set(userId, values) }),
    [form, userId],
  )

  const chooseWallet = (id: string) => {
    const wallet = walletList.find((w) => w.id === id)
    setWalletId(id)
    setUseSecondary(wallet?.slot === 'secondary')
    setConnection('disconnected')
    if (wallet && profile.data) form.reset({ ...defaultsFrom(wallet, profile.data.username), note: form.getValues('note') })
  }

  const connect = useMutation({
    mutationFn: () => checkoutApi.connectWallet(walletId!, network),
    onMutate: () => setConnection('connecting'),
    onSuccess: () => {
      setConnection('connected')
      announce('Carteira conectada.')
    },
    onError: (error) => {
      setConnection(isApiError(error, 'WALLET_REJECTED') ? 'rejected' : 'disconnected')
      toast.error(error.message)
      announce(error.message)
    },
  })
  const disconnect = useMutation({
    mutationFn: checkoutApi.disconnectWallet,
    onSettled: () => {
      setConnection('disconnected')
      announce('Carteira desconectada.')
    },
  })

  // Pedido pendente de uma tentativa anterior (refresh/queda): oferece retomada.
  const previousAttempt = attemptStore.get(userId)

  const openReview = form.handleSubmit(async () => {
    setFormError(null)
    setOrderError(null)
    if (!selectedWallet) return setFormError('Selecione uma carteira cadastrada.')
    if (quote.stale) return setFormError('Os valores mudaram. Atualize a cotação antes de continuar.')
    if (connection !== 'connected') {
      try {
        await connect.mutateAsync()
      } catch {
        return
      }
    }
    setReviewOpen(true)
  })

  const confirm = async () => {
    if (!quote.quote || !selectedWallet) return
    setOrderError(null)
    const result = await placeOrder.place({ quoteId: quote.quote.id, walletId: selectedWallet.id, collector: form.getValues() })
    if (result.order) {
      draftStore.clear(userId)
      setReviewOpen(false)
      announce('Pedido enviado. Aguardando confirmação da rede.')
      await navigate({ to: '/pedidos/$orderId', params: { orderId: result.order.id } })
      return
    }
    const error = result.error
    if (!error) return
    if (isQuoteStale(error)) {
      quote.markStale(error.details)
      setReviewOpen(false)
      announce(error.message)
      return
    }
    if (error.code === 'VALIDATION_ERROR') {
      setReviewOpen(false)
      setFormError(applyApiErrors(error, form.setError))
      return
    }
    if (error.code === 'WALLET_REJECTED') setConnection('disconnected')
    setOrderError(error.message)
  }

  const loading = wallets.isPending || profile.isPending || cart.isPending

  if (!loading && cart.data && cart.data.lines.length === 0 && !previousAttempt?.orderId) {
    return (
      <Container className="py-16">
        <ErrorState title="Seu carrinho está vazio" message="Adicione NFTs ao carrinho para finalizar uma compra." />
        <p className="mt-4 text-center">
          <Link to="/" hash="catalogo" className="font-bold text-amber hover:underline">
            Explorar NFTs
          </Link>
        </p>
      </Container>
    )
  }

  return (
    <div className="pb-16">
      <MobileTopBar title="Pagamento com carteira" fallback="/carrinho" />
      <Container className="md:pt-8">
        <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/', hash: 'catalogo' }, { label: 'Pagamento' }]} className="mb-6" />
        <h1 className="sr-only">Pagamento</h1>

        {previousAttempt?.orderId && (
          <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-primary/50 bg-secondary p-4 text-sm">
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-amber" aria-hidden /> Você tem um pedido recente em processamento.
            </span>
            <Link to="/pedidos/$orderId" params={{ orderId: previousAttempt.orderId }} className="font-bold text-amber hover:underline">
              Acompanhar pedido
            </Link>
          </div>
        )}

        {cart.data?.lines.some((l) => l.issues.length > 0) && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-coral/50 bg-coral/10 p-4 text-sm">
            Itens do carrinho mudaram de preço ou disponibilidade.
            <Link to="/carrinho" className="font-bold text-amber hover:underline">
              Revisar carrinho
            </Link>
          </div>
        )}

        {!loading && walletList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-md bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-bold">Cadastre uma carteira para pagar</h2>
            <p className="max-w-md text-sm text-muted-foreground">As compras são enviadas para uma carteira cadastrada no seu perfil.</p>
            <Button asChild>
              <Link to="/perfil/carteiras">Cadastrar carteira</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_405px] lg:gap-8">
            <form onSubmit={openReview} noValidate className="order-2 flex flex-col gap-5 lg:order-1" aria-labelledby="collector-title">
              <h2 id="collector-title" className="text-lg font-bold">
                Perfil do colecionador
              </h2>
              <FormError message={formError} />
              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2" aria-busy="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Skeleton key={i} className="h-[68px]" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Field label="Nome de exibição" required error={errors.displayName?.message}>
                    <Input autoComplete="name" {...form.register('displayName')} />
                  </Field>
                  <Field label="Nome de usuário" required error={errors.username?.message}>
                    <Input autoComplete="username" {...form.register('username')} />
                  </Field>
                  <Field label="Rede" required error={errors.network?.message}>
                    <select className={selectClass} {...form.register('network')}>
                      {NETWORKS.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nome do perfil" required error={errors.profileName?.message}>
                    <Input {...form.register('profileName')} />
                  </Field>
                  <Field label="Endereço da carteira" required error={errors.walletAddress?.message}>
                    <Input placeholder="Endereço 0x da carteira" spellCheck={false} {...form.register('walletAddress')} />
                  </Field>
                  <Field label="ENS ou carteira secundária (opcional)" error={errors.altAddress?.message} className="sm:[&>label]:invisible">
                    <Input placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} {...form.register('altAddress')} />
                  </Field>
                  <Field label="Tipo de carteira" required error={errors.walletProvider?.message}>
                    <select className={selectClass} {...form.register('walletProvider')}>
                      {WALLET_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Código de indicação" required error={errors.referralCode?.message}>
                    <Input {...form.register('referralCode')} />
                  </Field>
                  <Field label="E-mail" required error={errors.email?.message}>
                    <Input type="email" autoComplete="email" {...form.register('email')} />
                  </Field>
                  <Field label="Nome ENS" required error={errors.ensName?.message} hint="Sem o sufixo .eth">
                    <Input spellCheck={false} {...form.register('ensName')} />
                  </Field>
                </div>
              )}
              {walletList.length > 1 && (
                <label className="flex w-fit cursor-pointer items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    checked={useSecondary}
                    onChange={(e) => {
                      const target = e.target.checked ? wallets.data?.secondary : wallets.data?.primary
                      if (target) chooseWallet(target.id)
                    }}
                    className="size-4 accent-primary"
                  />
                  Usar outra carteira?
                </label>
              )}
              <Field label="Observação do colecionador (opcional)" error={errors.note?.message} className="max-w-[350px]">
                <textarea rows={5} className="rounded-sm border border-input bg-background p-3 text-sm" {...form.register('note')} />
              </Field>
              <button type="submit" className="sr-only">
                Revisar compra
              </button>
            </form>

            <aside className="order-1 flex flex-col gap-5 lg:order-2" aria-labelledby="order-title">
              <h2 id="order-title" className="text-lg font-bold">
                Seus NFTs
              </h2>
              {quote.changes.length > 0 || quote.stale ? (
                <div role="alert" className="flex flex-col gap-3 rounded-sm border border-coral/50 bg-coral/10 p-4 text-sm" data-testid="quote-stale">
                  <p className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="size-4 text-coral" aria-hidden /> Os valores mudaram desde a sua revisão
                  </p>
                  <ul className="list-disc pl-5">
                    {quote.changes.map((change) => (
                      <li key={`${change.nftId}-${change.kind}`}>{describeChange(change)}</li>
                    ))}
                    {quote.changes.length === 0 && <li>A cotação expirou.</li>}
                  </ul>
                  <Button size="sm" className="w-fit" onClick={() => quote.refresh()} disabled={quote.loading}>
                    Revisar novos valores
                  </Button>
                </div>
              ) : null}
              {quote.error && !quote.quote ? (
                <ErrorState title="Não foi possível calcular a cotação" message={quote.error.message} onRetry={quote.retry} retrying={quote.loading} />
              ) : !quote.quote ? (
                <>
                  <Skeleton className="h-[160px]" />
                  <SummarySkeleton />
                </>
              ) : (
                <>
                  <QuoteLines quote={quote.quote} />
                  <p className="text-center text-sm">
                    Tem um código promocional?{' '}
                    <Link to="/carrinho" className="text-amber hover:underline">
                      Aplique aqui
                    </Link>
                  </p>
                  <SummaryRows summary={quote.quote.summary} />
                </>
              )}
              {walletList.length > 0 && (
                <WalletPicker
                  wallets={walletList}
                  walletId={walletId}
                  onWalletChange={chooseWallet}
                  provider={provider}
                  onProviderChange={(p) => {
                    form.setValue('walletProvider', p, { shouldDirty: true })
                    setConnection('disconnected')
                  }}
                  connection={connection}
                  onConnect={() => connect.mutate()}
                  onDisconnect={() => disconnect.mutate()}
                />
              )}
              <Button
                size="lg"
                className="h-[45px]"
                onClick={() => openReview()}
                disabled={!quote.quote || quote.stale || quote.loading || connect.isPending || placeOrder.isBusy}
                data-testid="review-order"
              >
                {connect.isPending ? 'Conectando carteira…' : `Confirmar compra${quote.quote ? ` · ${formatEth(quote.quote.summary.totalEth)}` : ''}`}
              </Button>
            </aside>
          </div>
        )}
      </Container>

      {quote.quote && selectedWallet && (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          quote={quote.quote}
          wallet={selectedWallet}
          provider={provider}
          network={network}
          busy={placeOrder.isBusy}
          onConfirm={confirm}
          status={
            placeOrder.status === 'recovering' ? (
              <p role="status" className="rounded-sm bg-secondary px-3 py-2 text-sm text-amber" data-testid="order-recovering">
                O servidor demorou a responder. Verificando seu pedido com a mesma chave, sem criar outra compra…
              </p>
            ) : null
          }
          error={orderError ? <FormError message={orderError} /> : null}
        />
      )}
    </div>
  )
}
