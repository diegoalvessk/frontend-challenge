import { z } from 'zod'

/**
 * `redirect` preserva o fluxo anterior ao login. Só aceita caminhos internos
 * (começando com "/" e sem "//"), evitando open redirect.
 */
export const authSearchSchema = z.object({
  redirect: z
    .string()
    .refine((v) => v.startsWith('/') && !v.startsWith('//'))
    .optional()
    .catch(undefined),
  motivo: z.enum(['expirada', 'protegida']).optional().catch(undefined),
})

export type AuthSearch = z.infer<typeof authSearchSchema>
