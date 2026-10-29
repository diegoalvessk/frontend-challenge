import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { walletsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import { Field, FormError } from '@/components/form/field'
import { ErrorState } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORKS, WALLET_PROVIDERS, walletSchema, type Wallet, type WalletForm, type WalletSlot } from '@/contracts'
import { useWallets } from '@/features/account/queries'
import { useSession } from '@/features/auth/session-store'
import { selectClass } from '@/features/checkout/components'
import { announce } from '@/lib/announcer'
import { applyApiErrors } from '@/lib/forms'

export const Route = createFileRoute('/perfil/carteiras')({
  component: WalletsPage,
})

const EMPTY: WalletForm = {
  displayName: '',
  nickname: '',
  network: 'ethereum',
  profileName: '',
  address: '',
  altAddress: '',
  provider: 'metamask',
  referralCode: '',
  email: '',
  ensName: '',
}

function toForm(wallet: Wallet | null | undefined): WalletForm {
  if (!wallet) return EMPTY
  const { id: _id, slot: _slot, updatedAt: _updatedAt, ...values } = wallet
  return values
}

function WalletEditor({ slot, initial, onCancel }: { slot: WalletSlot; initial: WalletForm; onCancel?: () => void }) {
  const queryClient = useQueryClient()
  const userId = useSession()!.user.id
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletForm>({ resolver: zodResolver(walletSchema), defaultValues: initial })
  const { errors } = form.formState
  const label = slot === 'primary' ? 'principal' : 'secundária'

  const save = useMutation({
    mutationFn: (values: WalletForm) => walletsApi.save(slot, values),
    onSuccess: (wallet) => {
      queryClient.setQueryData(queryKeys.wallets(userId), (prev: { primary: Wallet | null; secondary: Wallet | null } | undefined) => ({
        primary: prev?.primary ?? null,
        secondary: prev?.secondary ?? null,
        [slot]: wallet,
      }))
      form.reset(toForm(wallet))
      toast.success(`Carteira ${label} salva.`)
      announce(`Carteira ${label} salva.`)
      onCancel?.()
    },
    onError: (error) => setFormError(applyApiErrors(error, form.setError)),
  })

  const id = `wallet-${slot}`
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        save.mutate(values)
      })}
      className="flex flex-col gap-6"
      aria-label={`Carteira ${label}`}
      data-testid={id}
    >
      <FormError message={formError} />
      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          <Input {...form.register('displayName')} />
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          <Input {...form.register('nickname')} />
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
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          <Input placeholder="Endereço 0x da carteira" spellCheck={false} {...form.register('address')} />
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" error={errors.altAddress?.message} className="lg:[&>label]:invisible">
          <Input placeholder="ENS ou carteira secundária (opcional)" spellCheck={false} {...form.register('altAddress')} />
        </Field>
        <Field label="Tipo de carteira" required error={errors.provider?.message}>
          <select className={selectClass} {...form.register('provider')}>
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
          <Input type="email" {...form.register('email')} />
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          <div className="flex gap-2.5">
            <span className="flex h-10 items-center rounded-sm border border-input px-3 text-sm" aria-hidden>
              .eth
            </span>
            <Input spellCheck={false} aria-label="Nome ENS (sem .eth)" {...form.register('ensName')} />
          </div>
        </Field>
      </div>
      <div className="flex gap-3">
        <Button type="submit" className="w-fit px-1 text-sm" disabled={save.isPending}>
          <span className="px-2">{save.isPending ? 'Salvando…' : 'Salvar carteira'}</span>
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}

function WalletsPage() {
  const queryClient = useQueryClient()
  const userId = useSession()!.user.id
  const { data, isPending, isError, error, refetch, isFetching } = useWallets()
  const [editingPrimary, setEditingPrimary] = useState(false)
  const [secondaryDraft, setSecondaryDraft] = useState<WalletForm | null>(null)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  const removeSecondary = useMutation({
    mutationFn: walletsApi.removeSecondary,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.wallets(userId), (prev: { primary: Wallet | null } | undefined) => ({ primary: prev?.primary ?? null, secondary: null }))
      toast.success('Carteira secundária removida.')
      announce('Carteira secundária removida.')
    },
    onError: (e) => toast.error(e.message),
  })

  if (isPending) {
    return (
      <div className="grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} retrying={isFetching} />

  const showPrimaryForm = !data.primary || editingPrimary

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-lg leading-none font-bold">
              Carteira principal
            </h1>
            <p className="mt-2 text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {data.primary && !editingPrimary && (
            <Button variant="link" className="text-lg font-bold" onClick={() => setEditingPrimary(true)}>
              Editar
            </Button>
          )}
        </header>
        {showPrimaryForm ? (
          <WalletEditor slot="primary" initial={toForm(data.primary)} onCancel={data.primary ? () => setEditingPrimary(false) : undefined} />
        ) : (
          <WalletSummary wallet={data.primary!} />
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="secondary-title" className="text-lg font-bold">
            Carteira secundária
          </h2>
          {!secondaryDraft && (
            <div className="flex items-center gap-4">
              {data.primary && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={sameAsPrimary} onChange={(e) => setSameAsPrimary(e.target.checked)} className="size-4 accent-primary" />
                  Igual à carteira principal
                </label>
              )}
              <Button
                variant="link"
                className="text-lg font-bold"
                disabled={!data.primary}
                onClick={() => setSecondaryDraft(sameAsPrimary ? toForm(data.primary) : data.secondary ? toForm(data.secondary) : EMPTY)}
              >
                {data.secondary ? 'Editar' : 'Adicionar'}
              </Button>
            </div>
          )}
        </header>
        {secondaryDraft ? (
          <WalletEditor slot="secondary" initial={secondaryDraft} onCancel={() => setSecondaryDraft(null)} />
        ) : data.secondary ? (
          <div className="flex flex-col gap-3">
            <WalletSummary wallet={data.secondary} />
            <Button variant="destructive" size="sm" className="w-fit" onClick={() => removeSecondary.mutate()} disabled={removeSecondary.isPending}>
              Remover carteira secundária
            </Button>
          </div>
        ) : (
          <p className="text-sm text-sand">
            {data.primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal antes de adicionar uma secundária.'}
          </p>
        )}
      </section>
    </div>
  )
}

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <dl className="grid gap-x-7 gap-y-3 rounded-md bg-card p-5 text-sm sm:grid-cols-2" data-testid={`wallet-summary-${wallet.slot}`}>
      {[
        ['Apelido', wallet.nickname],
        ['Nome de exibição', wallet.displayName],
        ['Rede', NETWORKS.find((n) => n.id === wallet.network)?.label],
        ['Tipo', WALLET_PROVIDERS.find((p) => p.id === wallet.provider)?.label],
        ['Endereço', wallet.address],
        ['ENS', wallet.ensName ? `${wallet.ensName}.eth` : '—'],
      ].map(([term, value]) => (
        <div key={term}>
          <dt className="text-sand">{term}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
