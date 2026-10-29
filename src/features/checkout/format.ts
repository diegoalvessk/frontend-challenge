/** Abrevia endereços/hashes: 0xA91F…E82C. */
export function shortAddress(address: string) {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/** Select nativo com a identidade visual (seta customizada); mantém a acessibilidade do controle nativo. */
export const selectClass =
  'h-10 w-full appearance-none rounded-sm border border-input bg-background bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%23cfb28c%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[position:right_12px_center] bg-no-repeat px-3 pr-9 text-sm text-foreground aria-invalid:border-destructive'
