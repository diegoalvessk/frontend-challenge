import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  /** `subtle`: botões redondos escuros (linhas do carrinho no mobile). */
  variant?: 'solid' | 'subtle'
  className?: string
}

/** Seletor de quantidade inteira com limites; anuncia o valor via aria-live. */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md', variant = 'solid', className }: QuantityStepperProps) {
  const button = cn(
    'grid place-items-center rounded-full bg-primary text-primary-foreground hover:bg-amber disabled:cursor-not-allowed disabled:opacity-40',
    size === 'md' ? 'h-[41px] w-7' : 'h-[26px] w-[19px] rounded-md',
    variant === 'subtle' &&
      'max-md:size-6 max-md:rounded-full max-md:border max-md:border-primary/20 max-md:bg-ink-800 max-md:text-cream max-md:hover:bg-secondary max-md:hover:text-amber max-md:disabled:text-primary max-md:disabled:opacity-50',
  )
  return (
    <div className={cn('flex items-center gap-3', className)} role="group" aria-label={label}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Diminuir quantidade">
        <Minus className={size === 'md' ? 'size-5' : 'size-3'} aria-hidden />
      </button>
      <output className={cn('min-w-5 text-center', size === 'md' ? 'text-lg' : 'text-base')} aria-live="polite" aria-label={`Quantidade: ${value}`}>
        {value}
      </output>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Aumentar quantidade">
        <Plus className={size === 'md' ? 'size-5' : 'size-3'} aria-hidden />
      </button>
    </div>
  )
}
