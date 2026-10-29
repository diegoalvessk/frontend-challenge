import { z } from 'zod'

/**
 * Regras de validação compartilhadas: os formulários validam no cliente e a
 * API simulada valida novamente (o servidor nunca confia no cliente).
 * Conflitos (e-mail/usuário em uso, senha atual incorreta) só o servidor detecta.
 */

const email = z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.')
const username = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres.')
  .max(20, 'Use no máximo 20 caracteres.')
  .regex(/^[a-z0-9._]+$/, 'Use apenas letras minúsculas, números, ponto e sublinhado.')
const password = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra.')
  .regex(/\d/, 'Inclua ao menos um número.')
const required = (label: string) => z.string().trim().min(1, `Informe ${label}.`)
const ensName = z
  .string()
  .trim()
  .min(3, 'O nome ENS precisa ter ao menos 3 caracteres.')
  .regex(/^[a-z0-9-]+$/, 'Use letras minúsculas, números e hífen (sem ".eth").')
const walletAddress = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Informe um endereço 0x com 40 caracteres hexadecimais.')
const network = z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' })
const provider = z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' })

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})

export const registerSchema = z
  .object({
    username,
    email,
    password,
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

export const profileSchema = z.object({
  displayName: required('o nome de exibição').max(40, 'Use no máximo 40 caracteres.'),
  username,
  email,
  ensName,
  walletNickname: required('o apelido da carteira').max(30, 'Use no máximo 30 caracteres.'),
})

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: password,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual.',
  })

export const walletSchema = z.object({
  displayName: required('o nome de exibição'),
  nickname: required('o apelido da carteira'),
  network,
  profileName: required('o nome do perfil'),
  address: walletAddress,
  altAddress: z
    .string()
    .trim()
    .refine((v) => v === '' || /^0x[0-9a-fA-F]{40}$/.test(v) || /^[a-z0-9-]+\.eth$/.test(v), 'Informe um ENS (nome.eth) ou endereço 0x válido.'),
  provider,
  referralCode: required('o código de indicação'),
  email,
  ensName,
})

export const collectorSchema = z.object({
  displayName: required('o nome de exibição'),
  username,
  profileName: required('o nome do perfil'),
  network,
  walletAddress,
  altAddress: walletSchema.shape.altAddress,
  walletProvider: provider,
  referralCode: required('o código de indicação'),
  email,
  ensName,
  note: z.string().max(280, 'Use no máximo 280 caracteres.'),
})

export type LoginForm = z.infer<typeof loginSchema>
export type RegisterForm = z.infer<typeof registerSchema>
export type ProfileForm = z.infer<typeof profileSchema>
export type PasswordChangeForm = z.infer<typeof passwordChangeSchema>
export type WalletForm = z.infer<typeof walletSchema>
export type CollectorForm = z.infer<typeof collectorSchema>

/** Converte um erro do Zod no mapa `campo -> mensagem` do contrato de erro. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    fields[key] ??= issue.message
  }
  return fields
}
