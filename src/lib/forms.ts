import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api/client'

/**
 * Aplica no formulário os erros por campo devolvidos pela API (422/409) e
 * retorna a mensagem geral para exibição quando não houver campo associado.
 */
export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fieldMap: Record<string, Path<T>> = {}) {
  if (!(error instanceof ApiError)) return 'Erro inesperado. Tente novamente.'
  let matched = false
  for (const [field, message] of Object.entries(error.fields)) {
    const target = (fieldMap[field] ?? field) as Path<T>
    setError(target, { type: 'server', message }, { shouldFocus: !matched })
    matched = true
  }
  return matched && error.code === 'VALIDATION_ERROR' ? null : error.message
}
