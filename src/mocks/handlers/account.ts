import { HttpResponse, http } from 'msw'
import {
  fieldErrors,
  profileSchema,
  registerSchema,
  walletSchema,
  type AvatarUpdate,
  type LoginRequest,
  type PasswordChange,
  type Profile,
  type ProfileUpdate,
  type RegisterRequest,
  type Session,
  type User,
  type Wallet,
  type WalletInput,
  type WalletsResponse,
  type WalletSlot,
} from '@/contracts'
import { commit, db, randomId, sha256, type UserRecord } from '../db'
import { API, currentToken, fail, handle, readJson, requireUser } from '../http'
import { getScenario } from '../scenarios'

const DEFAULT_SESSION_TTL_SECONDS = 30 * 60
const MAX_AVATAR_BYTES = 300_000

function toUser(user: UserRecord): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  }
}

function toProfile(user: UserRecord): Profile {
  return {
    userId: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    ensSuffix: '.eth',
    walletNickname: user.walletNickname,
    avatarUrl: user.avatarUrl,
    updatedAt: user.updatedAt,
  }
}

function openSession(user: UserRecord): Session {
  const token = randomId('tok')
  const ttl = getScenario().sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()
  db().sessions[token] = { userId: user.id, expiresAt }
  commit()
  return { token, user: toUser(user), expiresAt }
}

/** Verifica unicidade de usuário/e-mail ignorando o próprio usuário. */
function assertUnique(fields: { username?: string; email?: string }, selfId?: string) {
  const conflicts: Record<string, string> = {}
  const others = db().users.filter((u) => u.id !== selfId)
  if (fields.username && others.some((u) => u.username === fields.username)) {
    conflicts.username = 'Este nome de usuário já está em uso.'
  }
  if (fields.email && others.some((u) => u.email.toLowerCase() === fields.email!.toLowerCase())) {
    conflicts.email = 'Este e-mail já está cadastrado.'
  }
  if (Object.keys(conflicts).length > 0) {
    fail(409, 'CONFLICT', 'Alguns dados já estão em uso por outra conta.', { fields: conflicts })
  }
}

export const accountHandlers = [
  http.post(
    `${API}/auth/register`,
    handle(async ({ request }) => {
      const body = await readJson<RegisterRequest>(request)
      const parsed = registerSchema.safeParse({ ...body, confirmPassword: body.password })
      if (!parsed.success) {
        fail(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields: fieldErrors(parsed.error) })
      }
      const { username, email, password } = parsed.data
      assertUnique({ username, email })
      const salt = randomId('salt')
      const user: UserRecord = {
        id: randomId('usr'),
        username,
        displayName: username,
        email: email.toLowerCase(),
        passwordHash: await sha256(salt + password),
        salt,
        ensName: '',
        walletNickname: '',
        avatarUrl: null,
        updatedAt: new Date().toISOString(),
      }
      db().users.push(user)
      db().favorites[user.id] = []
      db().wallets[user.id] = { primary: null, secondary: null }
      return HttpResponse.json(openSession(user), { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    handle(async ({ request }) => {
      const { email = '', password = '' } = await readJson<Partial<LoginRequest>>(request)
      const user = db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
      const valid = user && (await sha256(user.salt + password)) === user.passwordHash
      if (!user || !valid) fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      return HttpResponse.json(openSession(user))
    }),
  ),

  http.get(
    `${API}/auth/session`,
    handle(({ request }) => {
      const user = requireUser(request)
      const token = currentToken(request)!
      const session: Session = { token, user: toUser(user), expiresAt: db().sessions[token].expiresAt }
      return HttpResponse.json(session)
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    handle(({ request }) => {
      const token = currentToken(request)
      if (token) {
        delete db().sessions[token]
        commit()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API}/me/profile`,
    handle(({ request }) => HttpResponse.json(toProfile(requireUser(request)))),
  ),

  http.patch(
    `${API}/me/profile`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const parsed = profileSchema.safeParse(await readJson<ProfileUpdate>(request))
      if (!parsed.success) {
        fail(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields: fieldErrors(parsed.error) })
      }
      assertUnique(parsed.data, user.id)
      Object.assign(user, parsed.data, { email: parsed.data.email.toLowerCase(), updatedAt: new Date().toISOString() })
      commit()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.put(
    `${API}/me/avatar`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const { dataUrl = '' } = await readJson<Partial<AvatarUpdate>>(request)
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) {
        fail(422, 'VALIDATION_ERROR', 'Envie uma imagem PNG, JPEG ou WebP.', { fields: { avatar: 'Formato de imagem não suportado.' } })
      }
      if (dataUrl.length > MAX_AVATAR_BYTES) {
        fail(422, 'VALIDATION_ERROR', 'A imagem é muito grande.', { fields: { avatar: 'A imagem deve ter no máximo 200 KB.' } })
      }
      user.avatarUrl = dataUrl
      user.updatedAt = new Date().toISOString()
      commit()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.delete(
    `${API}/me/avatar`,
    handle(({ request }) => {
      const user = requireUser(request)
      user.avatarUrl = null
      user.updatedAt = new Date().toISOString()
      commit()
      return HttpResponse.json(toProfile(user))
    }),
  ),

  http.post(
    `${API}/me/password`,
    handle(async ({ request }) => {
      const user = requireUser(request)
      const { currentPassword = '', newPassword = '' } = await readJson<Partial<PasswordChange>>(request)
      if ((await sha256(user.salt + currentPassword)) !== user.passwordHash) {
        fail(422, 'VALIDATION_ERROR', 'A senha atual está incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
      }
      const parsed = registerSchema.shape.password.safeParse(newPassword)
      if (!parsed.success) {
        fail(422, 'VALIDATION_ERROR', 'A nova senha não atende aos requisitos.', { fields: { newPassword: parsed.error.issues[0].message } })
      }
      user.salt = randomId('salt')
      user.passwordHash = await sha256(user.salt + newPassword)
      user.updatedAt = new Date().toISOString()
      // Encerra as demais sessões do usuário, mantendo a atual.
      const token = currentToken(request)
      for (const [key, session] of Object.entries(db().sessions)) {
        if (session.userId === user.id && key !== token) delete db().sessions[key]
      }
      commit()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${API}/me/wallets`,
    handle(({ request }) => {
      const user = requireUser(request)
      const wallets: WalletsResponse = db().wallets[user.id] ?? { primary: null, secondary: null }
      return HttpResponse.json(wallets)
    }),
  ),

  http.put<{ slot: string }>(
    `${API}/me/wallets/:slot`,
    handle(async ({ request, params }) => {
      const user = requireUser(request)
      const slot = params.slot as WalletSlot
      if (slot !== 'primary' && slot !== 'secondary') fail(404, 'NOT_FOUND', 'Carteira inexistente.')
      const parsed = walletSchema.safeParse(await readJson<WalletInput>(request))
      if (!parsed.success) {
        fail(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', { fields: fieldErrors(parsed.error) })
      }
      const wallets = (db().wallets[user.id] ??= { primary: null, secondary: null })
      if (slot === 'secondary' && !wallets.primary) {
        fail(409, 'CONFLICT', 'Cadastre a carteira principal antes da secundária.')
      }
      const wallet: Wallet = {
        ...parsed.data,
        id: wallets[slot]?.id ?? randomId('wal'),
        slot,
        updatedAt: new Date().toISOString(),
      }
      wallets[slot] = wallet
      commit()
      return HttpResponse.json(wallet)
    }),
  ),

  http.delete(
    `${API}/me/wallets/secondary`,
    handle(({ request }) => {
      const user = requireUser(request)
      const wallets = (db().wallets[user.id] ??= { primary: null, secondary: null })
      wallets.secondary = null
      commit()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

