/**
 * Unicode progress bar generation.
 *
 * Full cells use "█" and empty cells "░" by default. With `partial: true` the
 * final cell uses an eighth-block glyph for sub-cell resolution, giving a
 * smoother bar. Partial fills only apply to the default "█" fill character.
 */

/** Eighth-block glyphs, index 0 (empty) through 7 (seven-eighths). */
const EIGHTHS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
const FULL_BLOCK = '█'; // █
const EMPTY_BLOCK = '░'; // ░

export interface BarOptions {
  /** Use eighth-block partial fills for the trailing cell. Default false. */
  partial?: boolean;
  /** Fill character. Default "█". */
  filled?: string;
  /** Empty character. Default "░". */
  empty?: string;
}

/**
 * Render a progress bar of `width` cells for `percent` (0-100).
 *
 * A `null`/non-finite percent renders an all-empty bar so the caller can pair
 * it with a "--" label. Percentages are clamped to [0, 100].
 */
export function progressBar(percent: number | null, width: number, opts: BarOptions = {}): string {
  const w = Math.max(1, Math.floor(width));
  const filledChar = opts.filled ?? FULL_BLOCK;
  const emptyChar = opts.empty ?? EMPTY_BLOCK;

  if (percent === null || !Number.isFinite(percent)) {
    return emptyChar.repeat(w);
  }

  const pct = Math.min(100, Math.max(0, percent));

  // Sub-cell resolution only makes sense with the default block glyph.
  if (opts.partial && filledChar === FULL_BLOCK) {
    const totalEighths = Math.round((pct / 100) * w * 8);
    const full = Math.floor(totalEighths / 8);
    const remainder = totalEighths % 8;
    const partialChar = remainder > 0 ? EIGHTHS[remainder]! : '';
    const used = full + (remainder > 0 ? 1 : 0);
    const empties = Math.max(0, w - used);
    return filledChar.repeat(full) + partialChar + emptyChar.repeat(empties);
  }

  const full = Math.min(w, Math.round((pct / 100) * w));
  return filledChar.repeat(full) + emptyChar.repeat(w - full);
}
