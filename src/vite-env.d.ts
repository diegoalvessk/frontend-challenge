/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" desativa a API simulada (MSW). Padrão: ativada. */
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_API_URL?: string
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
