/**
 * Pure rendering: (StatusModel, Config, RenderContext) -> string.
 *
 * No stdin, no git, no clock reads happen here, so every theme is
 * deterministic and unit-testable. The six themes map one-to-one onto the
 * documented THEME SUPPORT list. Single-line themes join segments with a
 * separator; the `default` theme prints multiple rows (one per `\n`).
 */

import type { Ansi } from './colors';
import { bg256ForPercent, colorForPercent, createAnsi } from './colors';
import { formatDuration, formatResetsIn } from './countdown';
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

function barOptions(config: Config): BarOptions {
  return { partial: config.partialBlocks };
}

function iconPrefix(icon: string, config: Config): string {
  return config.useIcons && icon ? `${icon} ` : '';
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

/** Multi-line rich layout (the documented "Default"). */
function renderDefault(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi, nowMs } = ctx;
  const I = EMOJI_ICONS;
  const lines: string[] = [];
  const paint = (pct: number | null) => colorForPercent(ansi, pct, config.colorThresholds);
  const bar = (pct: number | null) =>
    paint(pct)(progressBar(pct, config.progressWidth, barOptions(config)));

  if (config.showModel && model.modelName) {
    lines.push(`${iconPrefix(I.model, config)}${ansi.bold(model.modelName)}`);
  }
  if (config.showBranch && model.branch) {
    lines.push(`${iconPrefix(I.branch, config)}${ansi.blue(model.branch)}`);
  }
  if (config.showWorkingDirectory && model.cwdPath) {
    lines.push(`${iconPrefix(I.dir, config)}${ansi.dim(model.cwdPath)}`);
  }

  if (config.showContext) {
    lines.push(
      `${iconPrefix(I.context, config)}Context${warnBadge(model.context, config, ansi, I.warn)}`,
    );
    lines.push(`${bar(model.context)} ${pctLabel(model.context, config)}`);
  }
  if (config.showFiveHour && showPct(model.fiveHour, config)) {
    lines.push(
      `${iconPrefix(I.fiveHour, config)}5-hour${warnBadge(model.fiveHour, config, ansi, I.warn)}`,
    );
    lines.push(`${bar(model.fiveHour)} ${pctLabel(model.fiveHour, config)}`);
    if (config.showCountdown) {
      const resets = formatResetsIn(model.fiveHourResetAt, nowMs);
      if (resets) lines.push(ansi.cyan(resets));
    }
  }
  if (config.showWeekly && showPct(model.weekly, config)) {
    lines.push(
      `${iconPrefix(I.weekly, config)}Weekly${warnBadge(model.weekly, config, ansi, I.warn)}`,
    );
    lines.push(`${bar(model.weekly)} ${pctLabel(model.weekly, config)}`);
    if (config.showCountdown) {
      const resets = formatResetsIn(model.weeklyResetAt, nowMs);
      if (resets) lines.push(ansi.cyan(resets));
    }
  }
  if (config.showCost && model.cost !== null) {
    lines.push(`${iconPrefix(I.cost, config)}${ansi.yellow(formatCost(model.cost))}`);
  }
  if (config.showLines) {
    const frag = linesFragment(model, ansi);
    if (frag) lines.push(`${iconPrefix(I.lines, config)}${frag}`);
  }
  if (config.showSessionTime) {
    const t = sessionTimeText(model);
    if (t) lines.push(`${iconPrefix(I.time, config)}${ansi.gray(t)}`);
  }
  if (config.showBurnRate) {
    const b = formatBurnRate(model.cost, model.durationMs);
    if (b) lines.push(`${iconPrefix(I.burn, config)}${ansi.yellow(b)}`);
  }
  for (const e of extraSegments(model, config, ansi)) {
    lines.push(`${iconPrefix(I[e.icon], config)}${e.text}`);
  }

  return lines.length > 0 ? lines.join('\n') : fallback(model, config, ansi);
}

/** Single-line, pipe-separated compact layout. */
function renderCompact(model: StatusModel, config: Config, ctx: RenderContext): string {
  const { ansi } = ctx;
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
    segments.push(
      `5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}${warnBadge(model.fiveHour, config, ansi, EMOJI_ICONS.warn)}`,
    );
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
  const { ansi } = ctx;
  const paint = (pct: number | null) => colorForPercent(ansi, pct, config.colorThresholds);
  const segments: string[] = [];

  if (config.showModel && model.modelName) segments.push(ansi.bold(model.modelName));
  if (config.showBranch && model.branch) segments.push(ansi.blue(model.branch));
  if (config.showContext)
    segments.push(`Ctx ${paint(model.context)(pctLabel(model.context, config))}`);
  if (config.showFiveHour && showPct(model.fiveHour, config))
    segments.push(`5h ${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`);
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
  const { ansi } = ctx;
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
  if (config.showFiveHour && showPct(model.fiveHour, config))
    segments.push(pctSeg('5H', model.fiveHour));
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
  const { ansi } = ctx;
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
    segments.push(
      `${useIcons ? `${I.fiveHour} ` : '5h '}${paint(model.fiveHour)(pctLabel(model.fiveHour, config))}`,
    );
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
function renderPlainText(model: StatusModel, config: Config): string {
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
  if (config.showFiveHour && showPct(model.fiveHour, config))
    segments.push(`5h ${pctLabel(model.fiveHour, config)}`);
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
    case 'compact':
      return renderCompact(model, config, themedCtx);
    case 'minimal':
      return renderMinimal(model, config, themedCtx);
    case 'powerline':
      return renderPowerline(model, config, themedCtx);
    case 'nerd-font':
      return renderNerdFont(model, config, themedCtx);
    case 'plain-text':
      return renderPlainText(model, config);
    case 'default':
    default:
      return renderDefault(model, config, themedCtx);
  }
}
