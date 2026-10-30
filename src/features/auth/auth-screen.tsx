import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { FacebookIcon, GoogleIcon } from '@/components/icons'
import { Field, FormError } from '@/components/form/field'
import { Container } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from '@/contracts'
import { Hero } from '@/features/catalog/components/hero'
import { applyApiErrors } from '@/lib/forms'
import { cn } from '@/lib/utils'
import type { AuthSearch } from './auth-search'
import { useLogin, useRegister } from './use-auth'

type Mode = 'login' | 'register'

/** Campos e botão no tamanho do Figma mobile (no desktop seguem o padrão do diálogo). */
const mobileField = 'max-md:h-[50px] max-md:rounded-[10px] max-md:border-primary/30 max-md:bg-transparent max-md:px-4'
const mobileSubmit = 'max-md:h-[60px] max-md:rounded-lg max-md:text-[15px]'

function SocialButtons({ onUnavailable }: { onUnavailable: () => void }) {
  return (
    <div className="flex flex-col gap-3 max-md:mt-4">
      <div className="flex items-center gap-3 text-xs text-foreground">
        <span className="h-px flex-1 bg-border" />
        Ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" onClick={onUnavailable} className="flex h-10 items-center justify-center gap-2 rounded-sm border border-border text-xs text-sand hover:border-primary">
        <GoogleIcon className="size-4" /> Continuar com Google
      </button>
      <button type="button" onClick={onUnavailable} className="flex h-10 items-center justify-center gap-2 rounded-sm border border-border text-xs text-sand hover:border-primary">
        <FacebookIcon className="size-4 text-[#3b5999]" /> Continuar com Facebook
      </button>
    </div>
  )
}

function LoginFormView({ search }: { search: AuthSearch }) {
  const navigate = useNavigate()
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login.mutateAsync(values)
      await navigate({ to: search.redirect ?? '/', replace: true })
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormError message={formError} />
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        <Input type="email" autoComplete="email" placeholder="contato@email.com" className={mobileField} {...form.register('email')} />
      </Field>
      <Field label="Senha" error={errors.password?.message} hideLabel>
        <PasswordInput autoComplete="current-password" placeholder="Senha" className={mobileField} {...form.register('password')} />
      </Field>
      <button
        type="button"
        className="self-end text-sm text-amber hover:underline"
        onClick={() => setFormError('A recuperação de senha não está disponível nesta demonstração. Use as credenciais do README.')}
      >
        Esqueceu a senha?
      </button>
      <Button type="submit" size="lg" className={cn('mt-4 max-md:mt-6', mobileSubmit)} disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterFormView({ search }: { search: AuthSearch }) {
  const navigate = useNavigate()
  const register = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
    setFormError(null)
    try {
      await register.mutateAsync({ username, email, password })
      await navigate({ to: search.redirect ?? '/perfil', replace: true })
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormError message={formError} />
      <Field label="Nome de usuário" error={errors.username?.message} hideLabel>
        <Input autoComplete="username" placeholder="Nome de usuário" className={mobileField} {...form.register('username')} />
      </Field>
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" className={mobileField} {...form.register('email')} />
      </Field>
      <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." hideLabel>
        <PasswordInput autoComplete="new-password" placeholder="Senha" className={mobileField} {...form.register('password')} />
      </Field>
      <Field label="Confirmar senha" error={errors.confirmPassword?.message} hideLabel>
        <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" className={mobileField} {...form.register('confirmPassword')} />
      </Field>
      <Button type="submit" size="lg" className={cn('mt-4 max-md:mt-6', mobileSubmit)} disabled={register.isPending}>
        {register.isPending ? (
          'Criando conta…'
        ) : (
          <>
            <span className="md:hidden">Criar perfil</span>
            <span className="max-md:hidden">Criar conta</span>
          </>
        )}
      </Button>
    </form>
  )
}

function Tabs({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const tab = (active: boolean) => cn('text-xl font-medium', active ? 'text-amber' : 'text-foreground hover:text-amber')
  return (
    <nav aria-label="Acesso à conta" className="flex items-center justify-center gap-2">
      <Link to="/entrar" search={search} replace className={tab(mode === 'login')} aria-current={mode === 'login' ? 'page' : undefined}>
        Entrar
      </Link>
      <span className="h-6 w-px bg-primary" aria-hidden />
      <Link to="/cadastro" search={search} replace className={tab(mode === 'register')} aria-current={mode === 'register' ? 'page' : undefined}>
        Criar conta
      </Link>
    </nav>
  )
}

/**
 * Login e cadastro: diálogo modal sobre a home no desktop (como no Figma) e
 * tela cheia no mobile. O foco fica preso no diálogo e o Esc fecha.
 */
export function AuthScreen({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const navigate = useNavigate()
  const [notice, setNotice] = useState<ReactNode>(null)
  // Mobile (Figma): só o título, sem abas nem descrição; no desktop o título fica para leitores de tela.
  const title = mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'
  const description =
    mode === 'login'
      ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
      : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'

  return (
    <>
      <Container className="hidden pt-3 md:block" aria-hidden>
        <Hero />
      </Container>
      <Dialog open onOpenChange={(open) => !open && navigate({ to: '/' })}>
        <DialogContent
          className="flex h-dvh max-w-none flex-col gap-6 overflow-y-auto rounded-none border-0 bg-background px-7 py-16 md:h-auto md:max-w-[500px] md:rounded-none md:border-b-8 md:border-b-primary md:bg-card md:px-20 md:py-12"
          aria-describedby="auth-description"
        >
          <p className="mt-[68px] mb-14 text-center text-3xl font-bold tracking-[0.1em] md:hidden" aria-hidden>
            KURIO
          </p>
          <DialogTitle className="text-center text-xl font-bold max-md:mb-2 md:sr-only">{title}</DialogTitle>
          <div className="max-md:hidden">
            <Tabs mode={mode} search={search} />
          </div>
          <DialogDescription id="auth-description" className="text-center text-xs text-foreground max-md:sr-only">
            {description}
          </DialogDescription>
          {search.motivo === 'expirada' && (
            <p role="status" className="rounded-sm border border-primary/50 bg-secondary px-3 py-2 text-sm text-amber">
              Sua sessão expirou. Entre novamente para continuar de onde parou.
            </p>
          )}
          {search.motivo === 'protegida' && (
            <p role="status" className="rounded-sm border border-primary/50 bg-secondary px-3 py-2 text-sm text-amber">
              Entre na sua conta para acessar esta página.
            </p>
          )}
          {mode === 'login' ? <LoginFormView search={search} /> : <RegisterFormView search={search} />}
          <SocialButtons onUnavailable={() => setNotice('O login social não está disponível nesta demonstração.')} />
          {notice && (
            <p role="status" className="text-center text-xs text-sand">
              {notice}
            </p>
          )}
          <p className="mt-4 text-center text-sm text-sand md:hidden">
            {mode === 'login' ? (
              <Link to="/cadastro" search={search} replace className="hover:text-amber">
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/entrar" search={search} replace className="hover:text-amber">
                Já tem uma conta? Entre
              </Link>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
