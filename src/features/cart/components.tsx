import { useState } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { isApiError } from '@/api/client'
import { NftImage } from '@/components/nft/nft-image'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Cart, CartLine, CartSummary as Summary } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { issueText } from './issues'
import { useCartMutations } from './use-cart'

/** Resumo de valores exatamente como calculado pela API. */
export function SummaryRows({ summary, className }: { summary: Summary; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-3 text-base [&_dd]:whitespace-nowrap", className)} data-testid="cart-summary">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd className="text-lg" data-testid="summary-subtotal">
          {formatEth(summary.subtotalEth)}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Desconto do lançamento</dt>
        <dd data-testid="summary-discount">(-) {formatEth(summary.discountEth)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Taxa de rede</dt>
        <dd className="text-right text-lg">
          <span data-testid="summary-fee">{formatEth(summary.networkFeeEth)}</span>
          <span className="block text-xs text-amber">Taxa estimada</span>
        </dd>
      </div>
      <div className="mt-3 flex justify-between gap-4 border-t border-primary/30 pt-4 text-lg font-bold">
        <dt>Total</dt>
        <dd className="text-amber" data-testid="summary-total">
          {formatEth(summary.totalEth)}
        </dd>
      </div>
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando resumo" data-testid="summary-skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
      <div className="flex justify-between border-t border-primary/30 pt-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  )
}

export function CouponForm({ cart }: { cart: Cart }) {
  const { applyCoupon, removeCoupon } = useCartMutations()
  const [code, setCode] = useState('')
  const error = applyCoupon.error
  const errorMessage = error ? (isApiError(error) ? error.message : 'Não foi possível aplicar o cupom.') : null

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-primary/50 bg-secondary px-3 py-2 text-sm" data-testid="applied-coupon">
        <span>
          <span className="font-bold text-amber">{cart.coupon.code}</span> — {cart.coupon.description}
        </span>
        <button
          type="button"
          onClick={() => removeCoupon.mutate()}
          disabled={removeCoupon.isPending}
          className="grid size-8 place-items-center rounded-sm hover:text-amber"
          aria-label={`Remover cupom ${cart.coupon.code}`}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!code.trim()) return
        applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      <label htmlFor="coupon" className="max-md:sr-only text-sm font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (applyCoupon.isError) applyCoupon.reset()
          }}
          placeholder="Digite o código promocional..."
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-r-0 border-primary bg-transparent px-2 text-sm placeholder:text-khaki aria-invalid:border-coral"
        />
        <Button type="submit" className="rounded-l-none px-5" disabled={applyCoupon.isPending || !code.trim()}>
          {applyCoupon.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {errorMessage && (
        <p id="coupon-error" role="alert" className="text-sm text-coral">
          {errorMessage}
        </p>
      )}
    </form>
  )
}

/** Linha do carrinho (tabela no desktop, card no mobile). */
export function CartLineRow({ line }: { line: CartLine }) {
  const { update, remove } = useCartMutations()
  const pending =
    (update.isPending && update.variables?.nftId === line.nftId && update.variables.editionId === line.editionId) ||
    (remove.isPending && remove.variables?.nftId === line.nftId)
  const max = Math.max(1, Math.min(line.available, line.maxPerOrder))
  const issues = issueText(line)

  return (
    <li className={cn('flex flex-col bg-card transition-opacity', pending && 'opacity-60')} data-testid="cart-line" aria-busy={pending}>
      <div className="grid grid-cols-[96px_1fr_auto] items-center gap-x-3 md:grid-cols-[70px_1fr_138px_136px_118px_40px] md:gap-x-4">
        <NftImage artwork={line.artwork} alt="" sizes="96px" className="h-full rounded-l-xl md:size-[70px] md:rounded-none" />
        <div className="flex min-w-0 flex-col gap-1 py-3 md:py-0">
          <p className="text-[15px] font-bold md:truncate">{line.name}</p>
          <p className="text-[13px] text-khaki">
            <span className="hidden md:inline">ID do token: {line.tokenId} · </span>Edição: {line.editionLabel}
          </p>
          <p className="text-lg font-bold text-amber md:hidden">{formatEth(line.lineTotalEth)}</p>
        </div>
        <p className="hidden text-[15px] text-amber md:block">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(line.unitPriceEth)}
        </p>
        <div className="flex flex-col items-end gap-2 pr-3 md:items-start md:pr-0">
          <QuantityStepper
            value={Math.min(line.quantity, max)}
            max={max}
            onChange={(quantity) => update.mutate({ nftId: line.nftId, editionId: line.editionId, quantity })}
            label={`Quantidade de ${line.name}`}
            size="sm"
            disabled={pending || line.available === 0}
          />
          <button
            type="button"
            onClick={() => remove.mutate({ nftId: line.nftId, editionId: line.editionId, name: line.name })}
            className="grid size-8 place-items-center text-amber hover:text-coral md:hidden"
            aria-label={`Remover ${line.name} do carrinho`}
            disabled={pending}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <p className="hidden text-[15px] font-bold text-amber md:block">
          <span className="sr-only">Total do item: </span>
          {formatEth(line.lineTotalEth)}
        </p>
        <button
          type="button"
          onClick={() => remove.mutate({ nftId: line.nftId, editionId: line.editionId, name: line.name })}
          className="hidden size-10 place-items-center text-sand hover:text-coral md:grid"
          aria-label={`Remover ${line.name} do carrinho`}
          disabled={pending}
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-coral/30 px-4 py-2 text-sm text-coral" data-testid="cart-line-issues">
          {issues.map((text) => (
            <li key={text} className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function CartLinesSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando itens do carrinho" data-testid="cart-skeleton">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex h-[96px] items-center gap-4 bg-card md:h-[70px]">
          <Skeleton className="h-full w-[96px] rounded-none md:w-[70px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </li>
      ))}
    </ul>
  )
}
