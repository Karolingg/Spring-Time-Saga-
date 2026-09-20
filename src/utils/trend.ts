import {
  TREND_IMPROVED,
  TREND_IMPROVED_RGB,
  TREND_REGRESSED,
  TREND_REGRESSED_RGB,
} from '@/src/config/theme'

/** Which direction a metric has to move to count as an improvement. */
export type BetterWhen = 'lower' | 'higher'

export function isImproved(delta: number, better: BetterWhen): boolean {
  if (delta === 0) return false
  return better === 'lower' ? delta < 0 : delta > 0
}

/**
 * Text color for a metric's run-over-run change. `neutral` covers both "no
 * change" and "no data", which should never read as a win or a regression.
 */
export function trendColor(
  delta: number | null,
  better: BetterWhen,
  neutral = 'var(--text-secondary)',
): string {
  if (delta == null || delta === 0) return neutral
  return isImproved(delta, better) ? TREND_IMPROVED : TREND_REGRESSED
}

/** Matching translucent fill for a pill or card carrying a trend color. */
export function trendTint(
  delta: number | null,
  better: BetterWhen,
  alpha = 0.12,
  neutral = 'transparent',
): string {
  if (delta == null || delta === 0) return neutral
  const rgb = isImproved(delta, better) ? TREND_IMPROVED_RGB : TREND_REGRESSED_RGB
  return `rgba(${rgb}, ${alpha})`
}
