/**
 * Icon sets per visual style.
 *
 * - `emoji`: broadly supported emoji, used by the default/compact/minimal themes.
 * - `nerd`: Nerd Font glyphs (require a patched font: https://www.nerdfonts.com).
 *
 * Nerd Font and Powerline glyphs live in the Unicode Private Use Area, so they
 * are built from explicit codepoints (via `String.fromCodePoint`) to keep the
 * source ASCII, greppable, and unambiguous. They render as boxes without a
 * suitable font installed.
 *
 * Icons are decorative. When `useIcons` is false, or a theme opts out, labels
 * render as plain text.
 */

const cp = (code: number): string => String.fromCodePoint(code);

export interface IconSet {
  model: string;
  branch: string;
  dir: string;
  context: string;
  fiveHour: string;
  weekly: string;
  cost: string;
  lines: string;
  time: string;
  burn: string;
  repo: string;
  tokens: string;
  version: string;
  style: string;
  effort: string;
  dirty: string;
  /** Escalating warning badge glyph. */
  warn: string;
}

export const EMOJI_ICONS: IconSet = {
  model: '🤖',
  branch: '🌿',
  dir: '📁',
  context: '🧠',
  fiveHour: '⚡',
  weekly: '📅',
  cost: '💰',
  lines: '📝',
  time: '⏱',
  burn: '🔥',
  repo: '📦',
  tokens: '🔢',
  version: '🏷',
  style: '🎨',
  effort: '🧩',
  dirty: '●',
  warn: '⚠',
};

// Nerd Fonts v3 codepoints (Font Awesome + Dev icon ranges).
export const NERD_ICONS: IconSet = {
  model: cp(0xf2db), // nf-fa-microchip
  branch: cp(0xe725), // nf-dev-git_branch
  dir: cp(0xf07b), // nf-fa-folder
  context: cp(0xf085), // nf-fa-cogs
  fiveHour: cp(0xf0e7), // nf-fa-bolt
  weekly: cp(0xf073), // nf-fa-calendar
  cost: cp(0xf155), // nf-fa-dollar
  lines: cp(0xf040), // nf-fa-pencil
  time: cp(0xf017), // nf-fa-clock_o
  burn: cp(0xf06d), // nf-fa-fire
  repo: cp(0xf1d3), // nf-fa-git_square
  tokens: cp(0xf292), // nf-fa-hashtag
  version: cp(0xf02b), // nf-fa-tag
  style: cp(0xf1fc), // nf-fa-paint_brush
  effort: cp(0xf085), // nf-fa-cogs
  dirty: cp(0xf044), // nf-fa-pencil_square_o
  warn: cp(0xf071), // nf-fa-warning
};

/** Powerline right-facing separator (U+E0B0). Requires a Powerline/Nerd Font. */
export const POWERLINE_SEPARATOR = cp(0xe0b0);
/** Powerline branch glyph (U+E0A0). */
export const POWERLINE_BRANCH = cp(0xe0a0);
