import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { profileApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-client'
import { Field, FormError } from '@/components/form/field'
import { ErrorState } from '@/components/layout/page'
import { UserAvatar } from '@/components/layout/user-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Skeleton } from '@/components/ui/skeleton'
import { passwordChangeSchema, profileSchema, type PasswordChangeForm, type Profile, type ProfileForm } from '@/contracts'
import { prepareAvatar } from '@/features/account/avatar'
import { useProfile } from '@/features/account/queries'
import { sessionStore } from '@/features/auth/session-store'
import { announce } from '@/lib/announcer'
import { applyApiErrors } from '@/lib/forms'

export const Route = createFileRoute('/perfil/')({
  component: ProfilePage,
})

/** Mantém a sessão (cabeçalho/avatar) coerente com o perfil salvo. */
function useSyncSession() {
  const queryClient = useQueryClient()
  return (profile: Profile) => {
    queryClient.setQueryData(queryKeys.profile(profile.userId), profile)
    const session = sessionStore.get().session
    if (session) {
      sessionStore.update({
        ...session,
        user: { ...session.user, displayName: profile.displayName, username: profile.username, email: profile.email, avatarUrl: profile.avatarUrl },
      })
    }
  }
}

function ProfileForm({ profile }: { profile: Profile }) {
  const sync = useSyncSession()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile.displayName,
      username: profile.username,
      email: profile.email,
      ensName: profile.ensName,
      walletNickname: profile.walletNickname,
    },
  })
  const { errors, isDirty } = form.formState
  const save = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (data) => {
      sync(data)
      form.reset(form.getValues())
      toast.success('Perfil atualizado.')
      announce('Perfil atualizado com sucesso.')
    },
    onError: (error) => setFormError(applyApiErrors(error, form.setError)),
  })

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        save.mutate(values)
      })}
      className="flex flex-col gap-6"
      aria-labelledby="profile-title"
    >
      <h1 id="profile-title" className="text-base font-bold">
        Perfil do colecionador
      </h1>
      <FormError message={formError} />
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          <Input autoComplete="name" {...form.register('displayName')} />
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          <Input autoComplete="username" {...form.register('username')} />
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          <div className="flex gap-2.5">
            <span className="flex h-10 items-center rounded-sm border border-input px-3 text-sm" aria-hidden>
              .eth
            </span>
            <Input spellCheck={false} {...form.register('ensName')} aria-label="Nome ENS (sem .eth)" />
          </div>
        </Field>
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          <Input {...form.register('walletNickname')} />
        </Field>
        <AvatarField profile={profile} />
      </div>
      <Button type="submit" className="w-[131px]" disabled={save.isPending || !isDirty}>
        {save.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function AvatarField({ profile }: { profile: Profile }) {
  const sync = useSyncSession()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useMutation({
    mutationFn: async (file: File) => profileApi.setAvatar(await prepareAvatar(file)),
    onSuccess: (data) => {
      sync(data)
      setError(null)
      toast.success('Avatar atualizado.')
      announce('Avatar atualizado.')
    },
    onError: (e) => setError(e.message),
  })
  const remove = useMutation({
    mutationFn: profileApi.removeAvatar,
    onSuccess: (data) => {
      sync(data)
      announce('Avatar removido.')
    },
    onError: (e) => setError(e.message),
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base" id="avatar-label">
        Avatar
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3" role="group" aria-labelledby="avatar-label">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={`Avatar de ${profile.displayName}`} className="size-[50px] rounded-full object-cover" data-testid="avatar-image" />
        ) : (
          <UserAvatar user={profile} className="size-[50px]" />
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id="avatar-input"
          aria-describedby={error ? 'avatar-error' : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
        <Button type="button" className="w-[98px]" onClick={() => input.current?.click()} disabled={upload.isPending} aria-controls="avatar-input">
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => remove.mutate()} disabled={!profile.avatarUrl || remove.isPending}>
          Remover
        </Button>
      </div>
      {error && (
        <p id="avatar-error" role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
    </div>
  )
}

function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const change = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordChangeForm) => profileApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      form.reset()
      toast.success('Senha alterada.')
      announce('Senha alterada com sucesso.')
    },
    onError: (error) => setFormError(applyApiErrors(error, form.setError)),
  })

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        change.mutate(values)
      })}
      className="flex max-w-[417px] flex-col gap-5"
      aria-labelledby="password-title"
    >
      <h2 id="password-title" className="text-base font-bold">
        Alterar senha
      </h2>
      <FormError message={formError} />
      <Field label="Senha atual" error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
      </Field>
      <Field label="Nova senha" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
      </Field>
      <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
      </Field>
      <Button type="submit" className="w-fit" disabled={change.isPending}>
        {change.isPending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}

function ProfilePage() {
  const { data, isPending, isError, error, refetch, isFetching } = useProfile()

  if (isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} retrying={isFetching} />

  return (
    <div className="flex flex-col gap-10">
      <ProfileForm key={data.userId} profile={data} />
      <PasswordForm />
    </div>
  )
}
