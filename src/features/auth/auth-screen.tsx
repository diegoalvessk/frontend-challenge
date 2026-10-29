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

function SocialButtons({ onUnavailable }: { onUnavailable: () => void }) {
  return (
    <div className="flex flex-col gap-3">
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
        <Input type="email" autoComplete="email" placeholder="contato@email.com" {...form.register('email')} />
      </Field>
      <Field label="Senha" error={errors.password?.message} hideLabel>
        <PasswordInput autoComplete="current-password" placeholder="Senha" {...form.register('password')} />
      </Field>
      <button
        type="button"
        className="self-end text-sm text-amber hover:underline"
        onClick={() => setFormError('A recuperação de senha não está disponível nesta demonstração. Use as credenciais do README.')}
      >
        Esqueceu a senha?
      </button>
      <Button type="submit" size="lg" className="mt-4" disabled={login.isPending}>
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
        <Input autoComplete="username" placeholder="Nome de usuário" {...form.register('username')} />
      </Field>
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" {...form.register('email')} />
      </Field>
      <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." hideLabel>
        <PasswordInput autoComplete="new-password" placeholder="Senha" {...form.register('password')} />
      </Field>
      <Field label="Confirmar senha" error={errors.confirmPassword?.message} hideLabel>
        <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" {...form.register('confirmPassword')} />
      </Field>
      <Button type="submit" size="lg" className="mt-4" disabled={register.isPending}>
        {register.isPending ? 'Criando conta…' : 'Criar conta'}
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
  const title = mode === 'login' ? 'Entrar' : 'Criar conta'
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
          <p className="text-center text-3xl font-bold tracking-[0.1em] md:hidden" aria-hidden>
            KURIO
          </p>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <Tabs mode={mode} search={search} />
          <DialogDescription id="auth-description" className="text-center text-xs text-foreground">
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
          <p className="text-center text-sm text-sand md:hidden">
            {mode === 'login' ? (
              <Link to="/cadastro" search={search} replace className="hover:text-amber">
                Novo na Kurio? Crie uma conta
              </Link>
            ) : (
              <Link to="/entrar" search={search} replace className="hover:text-amber">
                Já tem conta? Entrar
              </Link>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
