import Decimal from 'decimal.js'
import type { EthAmount } from '@/contracts'

/**
 * Aritmética de ETH com precisão decimal. Nunca use `number` para valores
 * monetários: 0.1 + 0.2 !== 0.3 em ponto flutuante.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/** Casas decimais máximas mantidas nos cálculos (gwei = 9). */
const SCALE = 9

export const eth = {
  add: (...values: EthAmount[]): EthAmount =>
    normalize(values.reduce((acc, v) => acc.plus(v), new Decimal(0))),
  sub: (a: EthAmount, b: EthAmount): EthAmount => normalize(new Decimal(a).minus(b)),
  mul: (a: EthAmount, factor: number | string): EthAmount => normalize(new Decimal(a).times(factor)),
  /** Aplica percentual (ex.: 10 -> 10%). */
  percent: (a: EthAmount, pct: number): EthAmount => normalize(new Decimal(a).times(pct).dividedBy(100)),
  max: (a: EthAmount, b: EthAmount): EthAmount => (new Decimal(a).gte(b) ? a : b),
  min: (a: EthAmount, b: EthAmount): EthAmount => (new Decimal(a).lte(b) ? a : b),
  cmp: (a: EthAmount, b: EthAmount): number => new Decimal(a).comparedTo(b),
  eq: (a: EthAmount, b: EthAmount): boolean => new Decimal(a).equals(b),
  isZero: (a: EthAmount): boolean => new Decimal(a).isZero(),
  isValid: (value: string): boolean => /^\d+(\.\d+)?$/.test(value.trim()),
}

function normalize(value: Decimal): EthAmount {
  return value.toDecimalPlaces(SCALE).toFixed()
}

/**
 * Formata um valor em ETH para exibição, mantendo ao menos 2 casas e
 * preservando as casas significativas (ex.: "26.846" e não "26.85").
 */
export function formatEth(value: EthAmount, { suffix = true }: { suffix?: boolean } = {}): string {
  const d = new Decimal(value)
  const decimals = Math.max(2, Math.min(d.decimalPlaces(), 6))
  const text = d.toFixed(decimals)
  return suffix ? `${text} ETH` : text
}
