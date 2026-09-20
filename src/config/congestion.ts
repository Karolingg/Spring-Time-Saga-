/**
 * The app's one congestion scale.
 *
 * Two ladders live here because the app measures congestion two ways, and
 * keeping them in one file is what stops them drifting apart again:
 *
 * - `bandFor(percent)` classifies a zone's recorded intensity (0–100) into the
 *   Critical / High / Medium / Low bands that drive pills, legends and the
 *   auto-written summaries.
 * - `heatColor(ratio)` paints the density overlays from a normalised 0–1 value.
 *   It splits the low end more finely than the bands do, because a floorplan
 *   needs more separation down there to stay readable over pastel rooms.
 *
 * Both draw from the same palette, so a cell and the legend beside it always
 * agree on what "critical" looks like.
 */

export type CongestionBandKey = 'critical' | 'high' | 'medium' | 'low'

export interface CongestionBand {
  key: CongestionBandKey
  label: string
  color: string
  /** Inclusive lower bound, as a percentage (0–100). */
  min: number
}

export const CONGESTION_BANDS: CongestionBand[] = [
  { key: 'critical', label: 'Critical', color: '#e11d48', min: 75 },
  { key: 'high',     label: 'High',     color: '#ea580c', min: 55 },
  { key: 'medium',   label: 'Medium',   color: '#f59e0b', min: 35 },
  { key: 'low',      label: 'Low',      color: '#16a34a', min: 0  },
]

/** Classify a 0–100 intensity percentage. */
export function bandFor(percent: number): CongestionBand {
  return CONGESTION_BANDS.find((band) => percent >= band.min)
    ?? CONGESTION_BANDS[CONGESTION_BANDS.length - 1]
}

const HEAT_STOPS: { min: number; color: string }[] = [
  { min: 0.78, color: '#e11d48' },
  { min: 0.55, color: '#ea580c' },
  { min: 0.32, color: '#f59e0b' },
  // Deeper green than the band palette's low — it has to hold up against the
  // light room fills on a floorplan.
  { min: 0.12, color: '#15803d' },
  { min: 0,    color: '#16a34a' },
]

/** Colour for a normalised 0–1 density value. */
export function heatColor(ratio: number): string {
  return HEAT_STOPS.find((stop) => ratio >= stop.min)?.color
    ?? HEAT_STOPS[HEAT_STOPS.length - 1].color
}

/* Risk level is a separate axis from intensity — it comes off the stored
 * `risk_level` enum rather than a percentage — so it keeps its own mapping. */
export const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

/** Text-safe counterparts — the vivid hues above stay for pill fills, but only
 *  reach ~2.2-3.8:1 as text on a light card. */
export const RISK_TEXT_COLORS: Record<string, string> = {
  CRITICAL: 'var(--status-text-red)',
  HIGH: 'var(--status-text-red)',
  MEDIUM: 'var(--status-text-amber)',
  LOW: 'var(--status-text-green)',
}
