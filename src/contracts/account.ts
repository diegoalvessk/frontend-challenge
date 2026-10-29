import type { IsoDateTime, Network, WalletProvider } from './common'

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  user: User
  expiresAt: IsoDateTime
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface Profile {
  userId: string
  displayName: string
  username: string
  email: string
  /** Parte do nome ENS sem o sufixo, ex.: "colecionador" -> "colecionador.eth". */
  ensName: string
  ensSuffix: '.eth'
  walletNickname: string
  avatarUrl: string | null
  updatedAt: IsoDateTime
}

export type ProfileUpdate = Pick<Profile, 'displayName' | 'username' | 'email' | 'ensName' | 'walletNickname'>

export interface AvatarUpdate {
  /** Imagem como data URL (PNG/JPEG/WebP), já redimensionada pelo cliente. */
  dataUrl: string
}

export interface PasswordChange {
  currentPassword: string
  newPassword: string
}

export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  id: string
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  /** ENS ou endereço de carteira secundária (opcional). */
  altAddress: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  updatedAt: IsoDateTime
}

export type WalletInput = Omit<Wallet, 'id' | 'slot' | 'updatedAt'>

export interface WalletsResponse {
  primary: Wallet | null
  secondary: Wallet | null
}

/** Resultado da simulação de conexão de carteira no checkout. */
export interface WalletConnection {
  walletId: string
  network: Network
  status: 'connected'
  connectedAt: IsoDateTime
}
