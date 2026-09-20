/** Brand teal — mirrors `--teal`. For marks, icon chips, borders and tinted
 *  fills only: it is 2.44:1 on white, so it must not carry text. */
export const ACCENT = '#2db8b0'

/** Deeper teal — mirrors `--teal-button` (5.52:1 on white). Use this wherever
 *  the teal is a surface carrying white text, or is itself text on white. */
export const ACCENT_STRONG = '#17756e'

/* Trend semantics: a metric that moved the right way vs. the wrong way. Kept as
 * RGB triplets too so callers can build matching translucent fills. */
export const TREND_IMPROVED_RGB = '34, 197, 94'
export const TREND_REGRESSED_RGB = '239, 68, 68'
export const TREND_IMPROVED = `rgb(${TREND_IMPROVED_RGB})`
export const TREND_REGRESSED = `rgb(${TREND_REGRESSED_RGB})`
