/**
 * Pure rendering: (StatusModel, Config, RenderContext) -> string.
 *
 * No stdin, no git, no clock reads happen here, so every theme is
 * deterministic and unit-testable. The five themes map one-to-one onto the
 * documented THEME SUPPORT list; every theme renders a single line (the
 * status line row in Claude Code is one row tall, so multi-line output only
 * wastes space).
 */

import type { Ansi } from './colors';
import { bg256ForPercent, colorForPercent, createAnsi } from './colors';
import { formatCountdown, formatDuration } from './countdown';
import {
  EMOJI_ICONS,
  NERD_ICONS,
  POWERLINE_BRANCH,
  POWERLINE_SEPARATOR,
  type IconSet,
} from './icons';
import { progressBar, type BarOptions } from './progress';
import type { Config, StatusModel } from './types';
import { formatBurnRate, formatCost, formatLines, formatTokens } from './utils';

export interface RenderContext {
  /** Milliseconds since epoch, used for reset countdowns. */
  nowMs: number;
  ansi: Ansi;
}

/** Format a percentage as "82%" or the configured missing text. */
function pctLabel(value: number | null, config: Config): string {
  return value === null ? config.missingText : `${Math.round(value)}%`;
}

/**
 * Whether a percentage segment (5-hour / weekly) should render at all.
 * When `hideUnavailable` is on, a not-yet-loaded value (`null`) is hidden
 * rather than shown as `--`, so a fresh session shows no placeholder flicker.
 */
function showPct(value: number | null, config: Config): boolean {
  return value !== null || !config.hideUnavailable;
}

/** Colored "+124 −18" lines fragment, or `null` when the data is unavailable. */
function linesFragment(model: StatusModel, ansi: Ansi): string | null {
  if (model.linesAdded === null && model.linesRemoved === null) return null;
  const a = model.linesAdded ?? 0;
  const r = model.linesRemoved ?? 0;
  return `${ansi.green(`+${a}`)} ${ansi.red(`−${r}`)}`;
}

/** Elapsed session time ("2h 13m"), or `null` when the duration is unavailable. */
function sessionTimeText(model: StatusModel): string | null {
  if (model.durationMs === null) return null;
  return formatDuration(model.durationMs);
}

/** A supplementary trailing segment: an icon key plus its pre-colored text. */
interface Extra {
  icon: keyof IconSet;
  text: string;
}

/**
 * The opt-in "extra" segments (repo, git dirty, tokens, version, output style,
 * effort), each already colored. Rendered at the end of every theme; `null`
 * values are skipped so nothing shows unless both enabled and available.
 */
function extraSegments(model: StatusModel, config: Config, ansi: Ansi): Extra[] {
  const out: Extra[] = [];
  if (config.showRepo && model.repo) {
    out.push({ icon: 'repo', text: ansi.magenta(model.repo) });
  }
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    out.push({ icon: 'dirty', text: ansi.yellow(`±${model.gitDirty}`) });
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) out.push({ icon: 'tokens', text: ansi.gray(`${tokens} tok`) });
  }
  if (config.showVersion && model.version) {
    out.push({ icon: 'version', text: ansi.gray(`v${model.version}`) });
  }
  if (config.showOutputStyle && model.outputStyle) {
    out.push({ icon: 'style', text: ansi.gray(model.outputStyle) });
  }
  if (config.showEffort && model.effort) {
    out.push({ icon: 'effort', text: ansi.gray(model.effort) });
  }
  return out;
}

/**
 * Time left in the 5-hour window, shown once usage crosses
 * `countdownAfterPercent` (default 50%), e.g. "2h 13m left". Returns `null`
 * below the threshold or when the reset timestamp is unavailable, so the
 * line stays short while there is plenty of headroom.
 */
function fiveHourResetInfo(model: StatusModel, config: Config, nowMs: number): string | null {
  if (!config.showCountdown) return null;
  if (model.fiveHour === null || model.fiveHour <= config.countdownAfterPercent) return null;
  const countdown = formatCountdown(model.fiveHourResetAt, nowMs);
  if (countdown === '--') return null;
  if (countdown === 'now') return 'resets now';
  return `${countdown} left`;
}

/** Escalating warning badge: yellow, red, then blinking red past the thresholds. */
function warnBadge(pct: number | null, config: Config, ansi: Ansi, glyph: string): string {
  if (pct === null || !config.useIcons) return '';
  const { warn, danger, flash } = config.warnThresholds;
  if (pct >= flash) {
    const red = ansi.red(glyph);
    return ` ${config.flashOnCritical ? ansi.blink(red) : red}`;
  }
  if (pct >= danger) return ` ${ansi.red(glyph)}`;
  if (pct >= warn) return ` ${ansi.yellow(glyph)}`;
  return '';
}

/** Last-resort output so the status line is never blank (which hides the row). */
function fallback(model: StatusModel, config: Config, ansi: Ansi): string {
  return model.modelName ? ansi.bold(model.modelName) : config.missingText;
}

/** Single-line, pipe-separated compact layout. */
function renderCompact(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi, nowMs } = ctx;
  const paint = (pct: number | null) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments: string[] = [];

  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showWorkingDirectory && model.cwdName) segments.push(ansi.dim(model.cwdName));
  if (config.showContext) {
    segments.push(
      `Ctx ${paint(model.context)(pctLabel(model.context, config))}${warnBadge(model.context, config, ansi, EMOJI_ICONS.warn)}`,
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}${warnBadge(model.fiveHour, config, ansi, EMOJI_ICONS.warn)}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) {
    segments.push(
      `Week ${paint(model.weekly)(pctLabel(model.weekly, config))}${warnBadge(model.weekly, config, ansi, EMOJI_ICONS.warn)}`,
    );
  }
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(frag);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(ansi.gray(t));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(ansi.yellow(b));
  }
  for (const e of extraSegments(model, config, ansi)) segments.push(e.text);

  return segments.length > 0 ? segments.join(config.separator) : fallback(model, config, ansi);
}

/** Single-line terse layout with a thin separator. */
function renderMinimal(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi, nowMs } = ctx;
  const paint = (pct: number | null) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments: string[] = [];

  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showContext)
    segments.push(`Ctx ${paint(model.context)(pctLabel(model.context, config))}`);
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config))
    segments.push(`Week ${paint(model.weekly)(pctLabel(model.weekly, config))}`);
  if (config.showCost && model.cost !== null) segments.push(ansi.yellow(formatCost(model.cost)));
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(frag);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(ansi.gray(t));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(ansi.yellow(b));
  }
  for (const e of extraSegments(model, config, ansi)) segments.push(e.text);

  return segments.length > 0 ? segments.join(' │ ') : fallback(model, config, ansi);
}

interface PowerlineSegment {
  text: string;
  fg: number;
  bg: number;
}

/** Powerline layout: colored background segments chained with separators. */
function renderPowerline(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi, nowMs } = ctx;
  const segments: PowerlineSegment[] = [];
  const white = 15;

  if (config.showModel && model.modelName) {
    segments.push({ text: ` ${model.modelName} `, fg: white, bg: 24 });
  }
  if (config.showBranch && model.branch) {
    const label = config.useIcons ? `${POWERLINE_BRANCH} ${model.branch}` : model.branch;
    segments.push({ text: ` ${label} `, fg: white, bg: 240 });
  }
  const pctSeg = (label: string, pct: number | null): PowerlineSegment => ({
    text: ` ${label} ${pctLabel(pct, config)} `,
    fg: 0,
    bg: bg256ForPercent(pct, config.colorThresholds),
  });
  if (config.showContext) segments.push(pctSeg('CTX', model.context));
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    const seg = pctSeg('5H', model.fiveHour);
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg.text = `${seg.text.trimEnd()} · ${reset} `;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) segments.push(pctSeg('7D', model.weekly));
  if (config.showCost && model.cost !== null) {
    segments.push({ text: ` ${formatCost(model.cost)} `, fg: white, bg: 22 });
  }
  if (config.showLines) {
    const frag = formatLines(model.linesAdded, model.linesRemoved);
    if (frag) segments.push({ text: ` ${frag} `, fg: white, bg: 238 });
  }
  if (config.showSessionTime && model.durationMs !== null) {
    segments.push({ text: ` ${formatDuration(model.durationMs)} `, fg: white, bg: 236 });
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push({ text: ` ${b} `, fg: white, bg: 22 });
  }
  if (config.showRepo && model.repo) {
    segments.push({ text: ` ${model.repo} `, fg: white, bg: 54 });
  }
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    segments.push({ text: ` ±${model.gitDirty} `, fg: 0, bg: 130 });
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) segments.push({ text: ` ${tokens} tok `, fg: white, bg: 240 });
  }
  if (config.showVersion && model.version) {
    segments.push({ text: ` v${model.version} `, fg: white, bg: 238 });
  }
  if (config.showOutputStyle && model.outputStyle) {
    segments.push({ text: ` ${model.outputStyle} `, fg: white, bg: 238 });
  }
  if (config.showEffort && model.effort) {
    segments.push({ text: ` ${model.effort} `, fg: white, bg: 238 });
  }

  if (segments.length === 0) return fallback(model, config, ansi);
  if (!ansi.enabled) return segments.map((s) => s.text).join('');

  let out = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    out += ansi.seq(38, 5, seg.fg, 48, 5, seg.bg) + seg.text;
    const next = segments[i + 1];
    out += ansi.seq(0);
    if (next) {
      out += ansi.seq(38, 5, seg.bg, 48, 5, next.bg) + POWERLINE_SEPARATOR;
    } else {
      out += ansi.seq(38, 5, seg.bg) + POWERLINE_SEPARATOR + ansi.reset();
    }
  }
  return out;
}

/** Single-line layout using Nerd Font glyphs. */
function renderNerdFont(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi, nowMs } = ctx;
  const I = NERD_ICONS;
  const paint = (pct: number | null) => colorForPercent(ansi, pct, config.colorThresholds);
  const useIcons = config.useIcons;
  const segments: string[] = [];

  if (config.showModel && model.modelName) {
    segments.push(`${useIcons ? `${I.model} ` : ''}${ansi.bold(model.modelName)}`);
  }
  if (config.showBranch && model.branch) {
    segments.push(`${useIcons ? `${I.branch} ` : ''}${ansi.blue(model.branch)}`);
  }
  if (config.showContext) {
    segments.push(
      `${useIcons ? `${I.context} ` : 'ctx '}${paint(model.context)(pctLabel(model.context, config))}`,
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    let seg = `${useIcons ? `${I.fiveHour} ` : '5h '}${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`;
    const reset = fiveHourResetInfo(model, config, nowMs);
    if (reset) seg += ` ${ansi.cyan(reset)}`;
    segments.push(seg);
  }
  if (config.showWeekly && showPct(model.weekly, config)) {
    segments.push(
      `${useIcons ? `${I.weekly} ` : '7d '}${paint(model.weekly)(pctLabel(model.weekly, config))}`,
    );
  }
  if (config.showCost && model.cost !== null) {
    segments.push(`${useIcons ? `${I.cost} ` : ''}${ansi.yellow(formatCost(model.cost))}`);
  }
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) segments.push(`${useIcons ? `${I.lines} ` : ''}${frag}`);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) segments.push(`${useIcons ? `${I.time} ` : ''}${ansi.gray(t)}`);
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(`${useIcons ? `${I.burn} ` : ''}${ansi.yellow(b)}`);
  }
  for (const e of extraSegments(model, config, ansi)) {
    segments.push(`${useIcons ? `${I[e.icon]} ` : ''}${e.text}`);
  }

  return segments.length > 0 ? segments.join('  ') : fallback(model, config, ansi);
}

/** Plain-text layout: ASCII only, colors always off. Safe for tmux/CI/logs. */
function renderPlainText(model: StatusModel, config: Config, ctx: RenderContext): string {
  const segments: string[] = [];
  const barOpts: BarOptions = { filled: '#', empty: '-', partial: false };

  if (config.showModel && model.modelName) segments.push(model.modelName);
  if (config.showBranch && model.branch) segments.push(model.branch);
  if (config.showWorkingDirectory && model.cwdName) segments.push(model.cwdName);
  if (config.showContext) {
    segments.push(
      `Ctx ${pctLabel(model.context, config)} [${progressBar(model.context, config.progressWidth, barOpts)}]`,
    );
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    const reset = fiveHourResetInfo(model, config, ctx.nowMs);
    segments.push(`5h ${pctLabel(model.fiveHour, config)}${reset ? ` ${reset}` : ''}`);
  }
  if (config.showWeekly && showPct(model.weekly, config))
    segments.push(`Week ${pctLabel(model.weekly, config)}`);
  if (config.showCost && model.cost !== null) segments.push(formatCost(model.cost));
  if (config.showLines && (model.linesAdded !== null || model.linesRemoved !== null)) {
    segments.push(`+${model.linesAdded ?? 0} -${model.linesRemoved ?? 0}`);
  }
  if (config.showSessionTime && model.durationMs !== null) {
    segments.push(formatDuration(model.durationMs));
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) segments.push(b);
  }
  if (config.showRepo && model.repo) segments.push(model.repo);
  if (config.showGitDirty && model.gitDirty !== null && model.gitDirty > 0) {
    segments.push(`*${model.gitDirty}`);
  }
  if (config.showTokens) {
    const tokens = formatTokens(model.contextTokens);
    if (tokens) segments.push(`${tokens} tok`);
  }
  if (config.showVersion && model.version) segments.push(`v${model.version}`);
  if (config.showOutputStyle && model.outputStyle) segments.push(model.outputStyle);
  if (config.showEffort && model.effort) segments.push(model.effort);

  return segments.length > 0 ? segments.join(' | ') : (model.modelName ?? config.missingText);
}

/** Render `model` into the theme selected by `config.theme`. */
export function render(model: StatusModel, config: Config, ctx: RenderContext): string {
  // plain-text forces color off regardless of `useColors`.
  const ansi = config.theme === 'plain-text' ? createAnsi(false) : ctx.ansi;
  const themedCtx: RenderContext = { ...ctx, ansi };

  switch (config.theme) {
    case 'minimal':
      return renderMinimal(model, config, themedCtx);
    case 'powerline':
      return renderPowerline(model, config, themedCtx);
    case 'nerd-font':
      return renderNerdFont(model, config, themedCtx);
    case 'plain-text':
      return renderPlainText(model, config, themedCtx);
    case 'compact':
    default:
      return renderCompact(model, config, themedCtx);
  }
}
