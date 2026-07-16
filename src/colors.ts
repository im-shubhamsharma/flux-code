/**
 * Minimal, dependency-free ANSI helper.
 *
 * Claude Code captures the status line command's stdout (it is not a TTY) but
 * still renders ANSI escape codes, per the official docs. So color output is
 * gated on the `useColors` config and the `NO_COLOR` convention, never on
 * `isTTY`.
 */

import type { ColorThresholds } from './types';

/** CSI introducer: ESC (char code 27) followed by "[". Built from a char code
 *  so the source stays pure ASCII and greppable. */
const ESC = `${String.fromCharCode(27)}[`;
const RESET = `${ESC}0m`;

type Sgr = string | number;

/** A palette bound to an enabled/disabled state. */
export interface Ansi {
  readonly enabled: boolean;
  /** Wrap `text` in the given SGR codes plus a reset. No-op when disabled. */
  code(text: string, ...sgr: Sgr[]): string;
  /** Raw escape sequence for the given SGR codes. Empty string when disabled. */
  seq(...sgr: Sgr[]): string;
  /** Reset sequence, or empty string when disabled. */
  reset(): string;
  bold(text: string): string;
  dim(text: string): string;
  blink(text: string): string;
  red(text: string): string;
  green(text: string): string;
  yellow(text: string): string;
  /** 256-color orange. */
  orange(text: string): string;
  blue(text: string): string;
  cyan(text: string): string;
  magenta(text: string): string;
  gray(text: string): string;
  fg256(text: string, n: number): string;
  bg256(text: string, n: number): string;
}

/** Build an {@link Ansi} palette. Pass `false` to strip all color. */
export function createAnsi(enabled: boolean): Ansi {
  const wrap = (text: string, sgr: Sgr[]): string =>
    enabled ? `${ESC}${sgr.join(';')}m${text}${RESET}` : text;

  return {
    enabled,
    code: (text, ...sgr) => wrap(text, sgr),
    seq: (...sgr) => (enabled ? `${ESC}${sgr.join(';')}m` : ''),
    reset: () => (enabled ? RESET : ''),
    bold: (t) => wrap(t, [1]),
    dim: (t) => wrap(t, [2]),
    blink: (t) => wrap(t, [5]),
    red: (t) => wrap(t, [31]),
    green: (t) => wrap(t, [32]),
    yellow: (t) => wrap(t, [33]),
    orange: (t) => wrap(t, [38, 5, 208]),
    blue: (t) => wrap(t, [34]),
    cyan: (t) => wrap(t, [36]),
    magenta: (t) => wrap(t, [35]),
    gray: (t) => wrap(t, [90]),
    fg256: (t, n) => wrap(t, [38, 5, n]),
    bg256: (t, n) => wrap(t, [48, 5, n]),
  };
}

/**
 * Map a percentage to a colorizer using the configured thresholds:
 * green &lt; yellow &le; orange &le; red. A `null` percentage renders gray.
 */
export function colorForPercent(
  ansi: Ansi,
  pct: number | null,
  th: ColorThresholds,
): (text: string) => string {
  if (pct === null) return (t) => ansi.gray(t);
  if (pct >= th.red) return (t) => ansi.red(t);
  if (pct >= th.orange) return (t) => ansi.orange(t);
  if (pct >= th.yellow) return (t) => ansi.yellow(t);
  return (t) => ansi.green(t);
}

/** 256-color code for a percentage, used for powerline segment backgrounds. */
export function bg256ForPercent(pct: number | null, th: ColorThresholds): number {
  if (pct === null) return 240; // gray
  if (pct >= th.red) return 196; // red
  if (pct >= th.orange) return 208; // orange
  if (pct >= th.yellow) return 220; // yellow
  return 34; // green
}
