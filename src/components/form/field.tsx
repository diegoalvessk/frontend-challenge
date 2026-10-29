import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  /** Esconde o rótulo visualmente (mantém para leitores de tela). */
  hideLabel?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
}

/**
 * Associa rótulo, dica e mensagem de erro ao controle (`htmlFor`,
 * `aria-describedby`, `aria-invalid`), como exigido pela acessibilidade.
 */
export function Field({ label, error, hint, required, hideLabel, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-base leading-5', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="ml-0.5 text-coral" aria-hidden>
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-coral" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Mensagem de erro geral do formulário (falhas da API sem campo específico). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-sm border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">
      {message}
    </p>
  )
}
